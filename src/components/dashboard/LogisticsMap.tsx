'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapLibreMap, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';

// --- Types ---
export interface RouteData {
  count: number;
  cautionCount?: number;
  errorCount?: number;
  source_info: { id: string; name: string; coords: [number, number] };
  target_info: { id: string; name: string; coords: [number, number] };
  epc_list: string[];
}

export type TrackingPoint = {
  coords: [number, number];
  t: number;
  label: string;
};

type LogisticsMapProps = {
  epcFilter?: string[] | null;
  routes?: RouteData[];
  trackingPath?: TrackingPoint[] | null;
  resetToken?: number;
  viewportPadding?: { top: number; bottom: number; left: number; right: number };
  isEpcFocused?: boolean;
  onRouteStatusSelect?: (status: 'SAFE' | 'CAUTION' | 'DANGER') => void;
  patternAnimationEnabled?: boolean;
};

const INITIAL_CENTER: [number, number] = [128.1, 35.3];
const INITIAL_ZOOM = 7.5;
const INITIAL_PITCH = 60;
const patternUniforms = {
  name: 'pattern',
  vs: `uniform patternUniforms {
  float phase;
} pattern;
`,
  fs: `uniform patternUniforms {
  float phase;
} pattern;
`,
  uniformTypes: {
    phase: 'f32',
  },
} as const;

class PatternArcLayer<DataT = unknown> extends ArcLayer<
  DataT,
  { patternRepeat?: number; patternPhase?: number }
> {
  static layerName = 'PatternArcLayer';
  // 또는 static componentName = 'PatternArcLayer';
  getShaders() {
    const patternRepeat = Math.max(1, Number(this.props.patternRepeat ?? 20));
    const shaders = super.getShaders();
    return {
      ...shaders,
      modules: [...(shaders.modules || []), patternUniforms],
      inject: {
        ...(shaders.inject || {}),
        'fs:DECKGL_FILTER_COLOR': `
          float segmentU = fract((geometry.uv.x - pattern.phase) * ${patternRepeat.toFixed(1)});
          float v = geometry.uv.y;
          float edge = 0.06;
          float rectHalfV = 1.0;
          float rectHalfU = 0.12;
          float x = abs((segmentU - 0.5) / rectHalfU);
          float y = abs(v / rectHalfV);
          float rectDist = max(x, y);
          float dotMask = 1.0 - smoothstep(1.0, 1.0 + edge, rectDist);

          vec3 baseColor = color.rgb;
          vec3 patternColor = mix(baseColor, vec3(1.0), 0.68);
          color.rgb = mix(baseColor, patternColor, dotMask);
          color.a *= mix(0.0, 0.8, dotMask);
        `,
      },
    };
  }

  draw(opts: any) {
    const model = (this.state as any)?.model;
    if (model) {
      model.shaderInputs.setProps({
        pattern: {
          phase: Number(this.props.patternPhase ?? 0),
        },
      });
    }
    super.draw(opts);
  }
}

export default function LogisticsMap({
  epcFilter,
  routes,
  trackingPath,
  resetToken,
  viewportPadding,
  onRouteStatusSelect,
  patternAnimationEnabled = false,
}: LogisticsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapContainerIdRef = useRef(`logistics-map-${Math.random().toString(36).slice(2, 11)}`);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const trackingFrameRef = useRef<number | null>(null);
  
  const [mapReady, setMapReady] = useState(false);
  const [trackingTime, setTrackingTime] = useState<number | null>(null);
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);
  const [patternPhase, setPatternPhase] = useState(0);
  const isValidCoords = (coords: [number, number] | undefined) =>
    Array.isArray(coords) && coords.length === 2 && coords.every((v) => Number.isFinite(v));
  const KOREA_BOUNDS: [[number, number], [number, number]] = [[124.6, 33.1], [131.9, 38.7]];
  const getRouteColor = (route: RouteData): [number, number, number, number] => {
    const totalCount = Math.max(0, Number(route.count ?? 0) || 0);
    const cautionCount = Math.max(0, Number(route.cautionCount ?? 0) || 0);
    const errorCount = Math.max(0, Number(route.errorCount ?? 0) || 0);
    if (totalCount <= 0) return [120, 120, 120, 255];

    // "정상" 비율은 혼합에서 제외하고, caution/error 비율로만 노랑~빨강을 결정
    const cautionRatio = cautionCount / totalCount;
    const errorRatio = errorCount / totalCount;
    const riskRatio = cautionRatio + errorRatio;
    if (riskRatio <= 0) return [34, 197, 94, 255];

    const yellow = { r: 255, g: 220, b: 0 };
    const red = { r: 255, g: 0, b: 0 };

    const redWeight = Math.min(1, Math.max(0, errorRatio / riskRatio));
    const r = Math.round(yellow.r * (1 - redWeight) + red.r * redWeight);
    const g = Math.round(yellow.g * (1 - redWeight) + red.g * redWeight);
    const b = Math.round(yellow.b * (1 - redWeight) + red.b * redWeight);
    return [r, g, b, 255];
  };

  useEffect(() => {
    let rafId: number | null = null;

    const initMap = () => {
      const container = mapContainerRef.current;
      if (mapRef.current) return;
      if (!container || container.nodeType !== 1) return;
      if (!container.id) {
        container.id = mapContainerIdRef.current;
      }

      const map = new MapLibreMap({
        container: container.id,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        pitch: INITIAL_PITCH,
        bearing: 0,
      });
      mapRef.current = map;
      map.on('load', () => setMapReady(true));
    };

    initMap();
    if (!mapRef.current) {
      rafId = requestAnimationFrame(initMap);
    }

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (routes) setRouteData(routes);
  }, [routes]);

  useEffect(() => {
    if (!patternAnimationEnabled) {
      setPatternPhase(0);
      return;
    }
    let rafId = 0;
    let last = performance.now();
    const speed = 0.1;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPatternPhase((prev) => {
        const next = prev + dt * speed;
        return next >= 1 ? next - Math.floor(next) : next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [patternAnimationEnabled]);

  const filteredRoutes = useMemo(() => {
    if (!epcFilter || epcFilter.length === 0) return routeData;
    const set = new Set(epcFilter);
    return routeData
      .map((route) => {
        if (!Array.isArray(route.epc_list) || route.epc_list.length === 0) {
          return route;
        }
        const matched = route.epc_list.filter((epc) => set.has(epc));
        if (matched.length === 0) return null;
        return {
          ...route,
          epc_list: matched,
          count: matched.length,
        } as RouteData;
      })
      .filter((route): route is RouteData => Boolean(route));
  }, [routeData, epcFilter]);

  const routeCountScale = useMemo(() => {
    const counts = routeData
      .map((route) => Number(route?.count ?? 0))
      .filter((count) => Number.isFinite(count) && count >= 0);
    if (counts.length === 0) {
      return { min: 0, max: 0 };
    }
    return {
      min: Math.min(...counts),
      max: Math.max(...counts),
    };
  }, [routeData]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || overlayRef.current) return;
    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
      getTooltip: () => null,
      getCursor: ({ isHovering }: { isHovering: boolean }) => (isHovering ? 'pointer' : ''),
      onHover: ({
        x,
        y,
        object,
      }: {
        x: number;
        y: number;
        object?: {
          label?: string;
          count?: number;
          cautionCount?: number;
          errorCount?: number;
          epc_list?: string[];
          source_info?: { name?: string };
          target_info?: { name?: string };
        };
      }) => {
        if (!object) {
          setHoverInfo(null);
          return;
        }
        if (object.label) {
          setHoverInfo({ x, y, text: object.label });
          return;
        }
        const count =
          typeof object.count === 'number'
            ? object.count
            : Array.isArray(object.epc_list)
              ? object.epc_list.length
              : 0;
        const cautionCount = Number(object.cautionCount ?? 0) || 0;
        const errorCount = Number(object.errorCount ?? 0) || 0;
        const sourceName = object.source_info?.name || 'Unknown';
        const targetName = object.target_info?.name || 'Unknown';
        setHoverInfo({
          x,
          y,
          text: `${sourceName} -> ${targetName}\nCount: ${count}\nCaution: ${cautionCount}\nDanger: ${errorCount}`,
        });
        return;
      },
    });
    mapRef.current.addControl(overlay as any);
    overlayRef.current = overlay;
    return () => {
      if (mapRef.current && overlayRef.current) {
        mapRef.current.removeControl(overlayRef.current as any);
        overlayRef.current = null;
      }
    };
  }, [mapReady]);

  // --- 카메라 위치 조정 (경로를 위쪽으로 배치) ---
  useEffect(() => {
    if (!mapReady || !mapRef.current || !trackingPath || trackingPath.length < 2 || trackingTime === null) return;

    const bounds = new LngLatBounds();
    const cleaned = trackingPath.filter((p) => isValidCoords(p.coords));
    if (cleaned.length < 2) return;
    const unique = new Set(cleaned.map((p) => `${p.coords[0]}|${p.coords[1]}`));
    if (unique.size < 2) return;
    cleaned.forEach(p => bounds.extend(p.coords));

    mapRef.current.fitBounds(bounds, {
      /**
       * [수정 핵심] bottom 패딩을 크게 주면 경로가 화면의 위쪽(상단)으로 올라갑니다.
       * top은 최소한의 여백만 남겨서 호(Arc)가 잘리지 않게 합니다.
       */
      padding: viewportPadding ?? { top: 80, bottom: 350, left: 100, right: 100 },
      duration: 2500,
      pitch: 45, 
      essential: true
    });
  }, [mapReady, trackingPath, trackingTime, viewportPadding]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || resetToken == null || resetToken === 0) return;
    mapRef.current.flyTo({
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      pitch: INITIAL_PITCH,
      bearing: 0,
      duration: 1200,
      essential: true,
    });
  }, [mapReady, filteredRoutes, resetToken, viewportPadding]);

  // --- Animation (single pass) ---
  useEffect(() => {
    if (!trackingPath || trackingPath.length < 2) {
      setTrackingTime(null);
      if (trackingFrameRef.current) cancelAnimationFrame(trackingFrameRef.current);
      return;
    }

    const sorted = [...trackingPath].filter((p) => isValidCoords(p.coords)).sort((a, b) => a.t - b.t);
    if (sorted.length < 2) {
      setTrackingTime(null);
      if (trackingFrameRef.current) cancelAnimationFrame(trackingFrameRef.current);
      return;
    }
    const unique = new Set(sorted.map((p) => `${p.coords[0]}|${p.coords[1]}`));
    if (unique.size < 2) {
      setTrackingTime(null);
      if (trackingFrameRef.current) cancelAnimationFrame(trackingFrameRef.current);
      return;
    }
    const startTime = sorted[0].t;
    const endTime = sorted[sorted.length - 1].t;
    const totalDuration = 10000;
    const startPerf = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startPerf;
      const progress = Math.min(elapsed / totalDuration, 1);
      setTrackingTime(startTime + (endTime - startTime) * progress);
      if (progress < 1) {
        trackingFrameRef.current = requestAnimationFrame(tick);
      } else {
        trackingFrameRef.current = null;
      }
    };

    setTrackingTime(startTime);
    trackingFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (trackingFrameRef.current) cancelAnimationFrame(trackingFrameRef.current);
    };
  }, [trackingPath]);

  const layers = useMemo(() => {
    if (!mapReady) return [];

    if (trackingPath && trackingPath.length >= 2 && trackingTime !== null) {
      const sorted = [...trackingPath].filter((p) => isValidCoords(p.coords)).sort((a, b) => a.t - b.t);
      if (sorted.length < 2) return [];
      const unique = new Set(sorted.map((p) => `${p.coords[0]}|${p.coords[1]}`));
      if (unique.size < 2) {
        return [
          new ScatterplotLayer({
            id: 'tracking-points',
            data: sorted.map((p) => ({ position: p.coords, label: p.label })),
            getPosition: d => d.position,
            getFillColor: [0, 200, 255],
            getRadius: 6,
            radiusUnits: 'pixels',
            stroked: true,
            getLineColor: [0, 80, 255],
            getLineWidth: 1,
            pickable: true,
          }),
        ];
      }
      const nextIndex = sorted.findIndex(p => p.t > trackingTime);
      
      const completedSegments: any[] = [];
      let headPos: [number, number] = sorted[sorted.length - 1].coords;
      let activeSegment = null;

      const limit = nextIndex === -1 ? sorted.length - 1 : nextIndex - 1;
      for (let i = 0; i < limit; i++) {
        completedSegments.push({ source: sorted[i].coords, target: sorted[i + 1].coords });
      }

      if (nextIndex > 0) {
        const prev = sorted[nextIndex - 1];
        const next = sorted[nextIndex];
        const denom = next.t - prev.t;
        const ratio = denom === 0 ? 0 : (trackingTime - prev.t) / denom;
        headPos = [
          prev.coords[0] + (next.coords[0] - prev.coords[0]) * ratio,
          prev.coords[1] + (next.coords[1] - prev.coords[1]) * ratio
        ];
        activeSegment = { source: prev.coords, target: headPos };
      }

      return [
        new ScatterplotLayer({
          id: 'tracking-points',
          data: sorted.map((p) => ({ position: p.coords, label: p.label })),
          getPosition: d => d.position,
          getFillColor: [0, 200, 255],
          getRadius: 6,
          radiusUnits: 'pixels',
          stroked: true,
          getLineColor: [0, 80, 255],
          getLineWidth: 1,
          pickable: true,
        }),
        new ArcLayer({
          id: 'tracking-arc-bg',
          data: completedSegments,
          getSourcePosition: d => d.source,
          getTargetPosition: d => d.target,
          getSourceColor: [0, 150, 255],
          getTargetColor: [0, 80, 255],
          getWidth: 4,
          getHeight: 0.4,
          opacity: 0.25
        }),
        ...(activeSegment ? [
          new ArcLayer({
            id: 'tracking-arc-active',
            data: [activeSegment],
            getSourcePosition: d => d.source,
            getTargetPosition: d => d.target,
            getSourceColor: [0, 150, 255],
            getTargetColor: [255, 255, 255],
            getWidth: 6,
            getHeight: 0.4,
          })
        ] : []),
        new ScatterplotLayer({
          id: 'head-point',
          data: [{ position: headPos }],
          getPosition: d => d.position,
          getFillColor: [255, 255, 255],
          getRadius: 10,
          radiusUnits: 'pixels',
          stroked: true,
          getLineColor: [0, 150, 255],
          getLineWidth: 2,
        })
      ];
    }

    const cleanedRoutes = filteredRoutes.filter(
      (d) => isValidCoords(d?.source_info?.coords) && isValidCoords(d?.target_info?.coords)
    );
    if (cleanedRoutes.length === 0) return [];
    const FALLBACK_ARC_HEIGHT = 0.72;
    const toRatio = (count: number) => {
      const value = Number.isFinite(count) ? Math.max(0, count) : 0;
      if (routeCountScale.max <= routeCountScale.min) return 1;
      const ratio = (value - routeCountScale.min) / (routeCountScale.max - routeCountScale.min);
      return Math.min(1, Math.max(0, ratio));
    };

    const getScaledWidth = (count: number) => {
      const minWidth = 5.0;
      const maxWidth = 10.0;
      const ratio = toRatio(count);
      return minWidth + (maxWidth - minWidth) * ratio;
    };
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const getDistanceKm = (from: [number, number], to: [number, number]) => {
      // Coordinates are [lng, lat]
      const [lng1, lat1] = from;
      const [lng2, lat2] = to;
      if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return NaN;
      if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) return NaN;
      if (lng1 < -180 || lng1 > 180 || lng2 < -180 || lng2 > 180) return NaN;

      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return 6371 * c;
    };

    const routeDistances = cleanedRoutes
      .map((route) => getDistanceKm(route.source_info.coords, route.target_info.coords))
      .filter((distance) => Number.isFinite(distance) && distance > 0);
    const distanceScale = routeDistances.length > 0
      ? { min: Math.min(...routeDistances), max: Math.max(...routeDistances) }
      : { min: 0, max: 0 };
    const getScaledHeightByDistance = (source: [number, number], target: [number, number]) => {
      const minHeight = 0.30;
      const maxHeight = 0.60;
      const distance = getDistanceKm(source, target);
      if (!Number.isFinite(distance) || distance <= 0) return FALLBACK_ARC_HEIGHT;
      if (distanceScale.max <= distanceScale.min) return FALLBACK_ARC_HEIGHT;
      const ratio = (distance - distanceScale.min) / (distanceScale.max - distanceScale.min);
      const safeRatio = Math.min(1, Math.max(0, ratio));
      return minHeight + (maxHeight - minHeight) * safeRatio;
    };
    const patternSpacingKm = 25;
    const minPatternRepeat = 4;
    const maxPatternRepeat = 72;
    const patternBuckets = new Map<number, RouteData[]>();
    cleanedRoutes.forEach((route) => {
      const distance = getDistanceKm(route.source_info.coords, route.target_info.coords);
      const rawRepeat =
        Number.isFinite(distance) && distance > 0
          ? Math.round(distance / patternSpacingKm)
          : minPatternRepeat;
      const patternRepeat = Math.max(minPatternRepeat, Math.min(maxPatternRepeat, rawRepeat));
      const bucket = patternBuckets.get(patternRepeat);
      if (bucket) {
        bucket.push(route);
      } else {
        patternBuckets.set(patternRepeat, [route]);
      }
    });

    const nodeMap = new globalThis.Map<string, { position: [number, number]; label: string }>();
    cleanedRoutes.forEach((route) => {
      const sourceKey = `${route.source_info.id}:${route.source_info.coords[0]}:${route.source_info.coords[1]}`;
      const targetKey = `${route.target_info.id}:${route.target_info.coords[0]}:${route.target_info.coords[1]}`;
      if (!nodeMap.has(sourceKey)) {
        nodeMap.set(sourceKey, { position: route.source_info.coords, label: route.source_info.name });
      }
      if (!nodeMap.has(targetKey)) {
        nodeMap.set(targetKey, { position: route.target_info.coords, label: route.target_info.name });
      }
    });
    const nodes = Array.from(nodeMap.values());
    return [
      new ArcLayer<RouteData>({
        id: 'global-route-arcs-base',
        data: cleanedRoutes,
        getSourcePosition: (d) => d.source_info.coords,
        getTargetPosition: (d) => d.target_info.coords,
        getSourceColor: (d) => getRouteColor(d),
        getTargetColor: (d) => getRouteColor(d),
        getWidth: (d) => getScaledWidth(d.count || 0),
        getHeight: (d) => {
          if (d.source_info.id === d.target_info.id) return 0;
          return getScaledHeightByDistance(d.source_info.coords, d.target_info.coords);
        },
        widthUnits: 'pixels',
        opacity: 1,
        pickable: true,
        autoHighlight: true,
        onClick: ({ object }: { object?: RouteData }) => {
          if (!object || !onRouteStatusSelect) return;
          const cautionCount = Math.max(0, Number(object.cautionCount ?? 0) || 0);
          const errorCount = Math.max(0, Number(object.errorCount ?? 0) || 0);

          if (errorCount > 0) {
            onRouteStatusSelect('DANGER');
            return;
          }
          if (cautionCount > 0) {
            onRouteStatusSelect('CAUTION');
            return;
          }
          onRouteStatusSelect('SAFE');
        },
      }),
      ...(patternAnimationEnabled
        ? Array.from(patternBuckets.entries()).map(([patternRepeat, routesInBucket]) =>
            new PatternArcLayer<RouteData>({
              id: `global-route-arcs-pattern-${patternRepeat}`,
              patternRepeat,
              patternPhase,
              data: routesInBucket,
              getSourcePosition: (d) => d.source_info.coords,
              getTargetPosition: (d) => d.target_info.coords,
              getSourceColor: (d) => getRouteColor(d),
              getTargetColor: (d) => getRouteColor(d),
              getWidth: () => 7,
              getHeight: (d) => {
                if (d.source_info.id === d.target_info.id) return 0;
                return getScaledHeightByDistance(d.source_info.coords, d.target_info.coords);
              },
              widthUnits: 'pixels',
              opacity: 1,
              pickable: false,
              autoHighlight: false,
            })
          )
        : []),
      new ScatterplotLayer({
        id: 'global-route-nodes',
        data: nodes,
        getPosition: (d: { position: [number, number] }) => d.position,
        getFillColor: [14, 165, 233, 230],
        getRadius: 5,
        radiusUnits: 'pixels',
        stroked: true,
        getLineColor: [224, 242, 254, 220],
        getLineWidth: 1,
        pickable: true,
      }),
    ];
  }, [mapReady, filteredRoutes, trackingPath, trackingTime, routeCountScale, onRouteStatusSelect, patternPhase, patternAnimationEnabled]);

  useEffect(() => {
    if (overlayRef.current) overlayRef.current.setProps({ layers });
  }, [layers]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute' }}>
      <div id={mapContainerIdRef.current} ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      {hoverInfo && (
        <div
          style={{
            position: 'absolute',
            left: hoverInfo.x + 12,
            top: hoverInfo.y + 12,
            background: 'rgba(10, 20, 40, 0.9)',
            color: '#E6F0FF',
            padding: '6px 8px',
            borderRadius: 6,
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 5,
            whiteSpace: 'pre-line',
          }}
        >
          {hoverInfo.text}
        </div>
      )}
    </div>
  );
}
