"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { LogisticsMapProps, RouteData, NodeVisualData} from '@/types/logisticsMap';
import { DEFAULT_AUTO_ZOOM_SETTINGS } from '@/constants/logisticsMap';

const INITIAL_CENTER: [number, number] = [128.1, 35.3];
const INITIAL_ZOOM = 7.8;
const INITIAL_PITCH = 60;
const PATTERN_ANIMATION_SPEED = 0.1;
const PATTERN_TARGET_FPS = 40;
const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const toRadians = (degree: number) => (degree * Math.PI) / 180;
const getHaversineDistanceKm = (from: [number, number], to: [number, number]) => {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return NaN;
  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) return NaN;
  if (lng1 < -180 || lng1 > 180 || lng2 < -180 || lng2 > 180) return NaN;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};
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
  routes,
  resetToken,
  viewportPadding,
  autoFocusKey,
  autoZoomSettings,
  onRouteLocationSelect,
  patternAnimationEnabled = false,
}: LogisticsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const lastHandledResetTokenRef = useRef<number>(typeof resetToken === 'number' ? resetToken : 0);
  const lastAutoFocusSignatureRef = useRef<string | null>(null);
  const patternPhaseRef = useRef(0);
  
  const [mapReady, setMapReady] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const routeData = useMemo(() => routes || [], [routes]);
  const resolvedAutoZoom = useMemo(() => {
    const toNumber = (value: unknown, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    return {
      singlePointZoom: clampNumber(
        toNumber(autoZoomSettings?.singlePointZoom, DEFAULT_AUTO_ZOOM_SETTINGS.singlePointZoom),
        1,
        22
      ),
      boundsMaxZoom: clampNumber(
        toNumber(autoZoomSettings?.boundsMaxZoom, DEFAULT_AUTO_ZOOM_SETTINGS.boundsMaxZoom),
        1,
        22
      ),
      durationMs: clampNumber(
        toNumber(autoZoomSettings?.durationMs, DEFAULT_AUTO_ZOOM_SETTINGS.durationMs),
        0,
        10_000
      ),
      offsetX: clampNumber(
        toNumber(autoZoomSettings?.offsetX, DEFAULT_AUTO_ZOOM_SETTINGS.offsetX),
        -1000,
        1000
      ),
      offsetY: clampNumber(
        toNumber(autoZoomSettings?.offsetY, DEFAULT_AUTO_ZOOM_SETTINGS.offsetY),
        -1000,
        1000
      ),
    };
  }, [autoZoomSettings]);
  const isValidCoords = (coords: [number, number] | undefined) =>
    Array.isArray(coords) && coords.length === 2 && coords.every((v) => Number.isFinite(v));
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

      const map = new MapLibreMap({
        container,
        style: '/map_style.json',
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
          setHoveredNodeId(null);
          return;
        }
        const hoveredNode = (object as { nodeId?: string }).nodeId;
        if (hoveredNode) {
          setHoveredNodeId(hoveredNode);
        } else {
          setHoveredNodeId(null);
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

  useEffect(() => {
    if (!mapReady || !mapRef.current || resetToken == null) return;
    if (resetToken <= lastHandledResetTokenRef.current) return;

    lastHandledResetTokenRef.current = resetToken;
    mapRef.current.flyTo({
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      pitch: INITIAL_PITCH,
      bearing: 0,
      duration: 1200,
      essential: true,
    });
  }, [mapReady, resetToken]);

  const routeRenderData = useMemo(() => {
    if (!mapReady) return null;

    const cleanedRoutes = routeData.filter(
      (d) => isValidCoords(d?.source_info?.coords) && isValidCoords(d?.target_info?.coords)
    );
    if (cleanedRoutes.length === 0) return null;

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
      return minWidth + (maxWidth - minWidth) * toRatio(count);
    };

    const routeDistances = cleanedRoutes
      .map((route) => getHaversineDistanceKm(route.source_info.coords, route.target_info.coords))
      .filter((distance) => Number.isFinite(distance) && distance > 0);
    const distanceScale = routeDistances.length > 0
      ? { min: Math.min(...routeDistances), max: Math.max(...routeDistances) }
      : { min: 0, max: 0 };
    const getScaledHeightByDistance = (source: [number, number], target: [number, number]) => {
      const minHeight = 0.30;
      const maxHeight = 0.60;
      const distance = getHaversineDistanceKm(source, target);
      if (!Number.isFinite(distance) || distance <= 0) return FALLBACK_ARC_HEIGHT;
      if (distanceScale.max <= distanceScale.min) return FALLBACK_ARC_HEIGHT;
      const ratio = (distance - distanceScale.min) / (distanceScale.max - distanceScale.min);
      return minHeight + (maxHeight - minHeight) * Math.min(1, Math.max(0, ratio));
    };

    const patternBuckets = new Map<number, RouteData[]>();
    const patternSpacingKm = 25;
    const minPatternRepeat = 4;
    const maxPatternRepeat = 72;
    cleanedRoutes.forEach((route) => {
      const distance = getHaversineDistanceKm(route.source_info.coords, route.target_info.coords);
      const rawRepeat =
        Number.isFinite(distance) && distance > 0
          ? Math.round(distance / patternSpacingKm)
          : minPatternRepeat;
      const patternRepeat = Math.max(minPatternRepeat, Math.min(maxPatternRepeat, rawRepeat));
      const bucket = patternBuckets.get(patternRepeat);
      if (bucket) bucket.push(route);
      else patternBuckets.set(patternRepeat, [route]);
    });

    const nodeMap = new globalThis.Map<string, NodeVisualData>();
    const toSafeCount = (value: unknown) => Math.max(0, Number(value ?? 0) || 0);
    const getRouteSeverity = (route: RouteData): 0 | 1 | 2 => {
      const errorCount = toSafeCount(route.errorCount);
      const cautionCount = toSafeCount(route.cautionCount);
      if (errorCount > 0) return 2;
      if (cautionCount > 0) return 1;
      return 0;
    };
    const getRouteScore = (route: RouteData, severity: 0 | 1 | 2): number => {
      if (severity === 2) return toSafeCount(route.errorCount);
      if (severity === 1) return toSafeCount(route.cautionCount);
      return toSafeCount(route.count);
    };
    const SAFE_NODE_COLOR: [number, number, number, number] = [14, 165, 233, 230];
    const ensureNode = (key: string, position: [number, number], label: string) => {
      if (nodeMap.has(key)) return;
      nodeMap.set(key, {
        nodeId: key,
        position,
        label,
        color: SAFE_NODE_COLOR,
        severity: 0,
        score: 0,
      });
    };
    const upsertTargetNode = (key: string, position: [number, number], label: string, route: RouteData) => {
      const severity = getRouteSeverity(route);
      const score = getRouteScore(route, severity);
      const color = severity === 0 ? SAFE_NODE_COLOR : getRouteColor(route);
      const existing = nodeMap.get(key);
      if (!existing) {
        nodeMap.set(key, { nodeId: key, position, label, color, severity, score });
        return;
      }
      if (severity > existing.severity || (severity === existing.severity && score > existing.score)) {
        nodeMap.set(key, { ...existing, color, severity, score });
      }
    };
    cleanedRoutes.forEach((route) => {
      const sourceKey = route.source_info.id;
      const targetKey = route.target_info.id;
      ensureNode(sourceKey, route.source_info.coords, route.source_info.name);
      ensureNode(targetKey, route.target_info.coords, route.target_info.name);
      upsertTargetNode(targetKey, route.target_info.coords, route.target_info.name, route);
    });

    return {
      cleanedRoutes,
      patternBuckets,
      nodes: Array.from(nodeMap.values()),
      getScaledWidth,
      getScaledHeightByDistance,
    };
  }, [mapReady, routeData, routeCountScale]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const nextFocusKey = (autoFocusKey || '').trim();
    if (!nextFocusKey) {
      lastAutoFocusSignatureRef.current = null;
      return;
    }
    if (!routeRenderData || routeRenderData.cleanedRoutes.length === 0) return;

    const points: [number, number][] = [];
    routeRenderData.cleanedRoutes.forEach((route) => {
      if (isValidCoords(route.source_info.coords)) points.push(route.source_info.coords);
      if (isValidCoords(route.target_info.coords)) points.push(route.target_info.coords);
    });
    if (points.length === 0) return;

    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    points.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    });
    if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return;

    const cleanedRoutes = routeRenderData.cleanedRoutes;
    let totalFlow = 0;
    let totalRisk = 0;
    let vectorLng = 0;
    let vectorLat = 0;
    let hasDanger = false;
    let hasCaution = false;

    cleanedRoutes.forEach((route) => {
      const count = Math.max(0, Number(route.count ?? 0) || 0);
      const caution = Math.max(0, Number(route.cautionCount ?? 0) || 0);
      const error = Math.max(0, Number(route.errorCount ?? 0) || 0);
      const weight = Math.max(1, count + caution + error * 2);
      const [sourceLng, sourceLat] = route.source_info.coords;
      const [targetLng, targetLat] = route.target_info.coords;

      totalFlow += count;
      totalRisk += caution + error * 2;
      if (error > 0) hasDanger = true;
      else if (caution > 0) hasCaution = true;
      vectorLng += (targetLng - sourceLng) * weight;
      vectorLat += (targetLat - sourceLat) * weight;
    });

    const routeCount = cleanedRoutes.length;
    const diagonalKmRaw = getHaversineDistanceKm([minLng, minLat], [maxLng, maxLat]);
    const diagonalKm = Number.isFinite(diagonalKmRaw) ? Math.max(0, diagonalKmRaw) : 0;
    const spanFactor = Math.log2(diagonalKm + 1);
    const flowFactor = Math.log10(Math.max(1, totalFlow + totalRisk));
    const riskBoost = hasDanger ? 0.9 : hasCaution ? 0.45 : 0;
    const paddingScale = routeCount <= 3 ? 0.78 : routeCount <= 8 ? 0.84 : 0.9;
    const padding = {
      top: Math.max(0, Math.round((Number(viewportPadding?.top ?? 0) + 24) * paddingScale)),
      bottom: Math.max(0, Math.round((Number(viewportPadding?.bottom ?? 0) + 24) * paddingScale)),
      left: Math.max(0, Math.round((Number(viewportPadding?.left ?? 0) + 24) * paddingScale)),
      right: Math.max(0, Math.round((Number(viewportPadding?.right ?? 0) + 24) * paddingScale)),
    };
    const focusSignature = [
      nextFocusKey,
      resolvedAutoZoom.singlePointZoom.toFixed(2),
      resolvedAutoZoom.boundsMaxZoom.toFixed(2),
      resolvedAutoZoom.durationMs,
      resolvedAutoZoom.offsetX,
      resolvedAutoZoom.offsetY,
      routeRenderData.cleanedRoutes.length,
      minLng.toFixed(4),
      minLat.toFixed(4),
      maxLng.toFixed(4),
      maxLat.toFixed(4),
    ].join('|');
    if (focusSignature === lastAutoFocusSignatureRef.current) return;

    const adaptiveSinglePointZoom = clampNumber(
      resolvedAutoZoom.singlePointZoom + 1.6 + riskBoost - flowFactor * 0.25 - spanFactor * 0.08,
      9,
      18
    );
    const adaptiveBoundsMaxZoom = clampNumber(
      resolvedAutoZoom.boundsMaxZoom + 2.0 + riskBoost - spanFactor * 0.55 - Math.min(0.85, flowFactor * 0.14),
      7,
      17
    );
    const adaptiveDurationMs = clampNumber(
      Math.round(
        resolvedAutoZoom.durationMs +
          Math.min(700, diagonalKm * 12) +
          Math.min(220, routeCount * 12)
      ),
      250,
      2600
    );

    const vectorNorm = Math.hypot(vectorLng, vectorLat);
    const directionLng = vectorNorm > 0 ? vectorLng / vectorNorm : 0;
    const directionLat = vectorNorm > 0 ? vectorLat / vectorNorm : 0;
    const offsetScale = clampNumber(1.3 - spanFactor * 0.12, 0.45, 1.3);
    const viewportBiasX = clampNumber((padding.left - padding.right) * 0.25, -320, 320);
    const viewportBiasY = clampNumber((padding.top - padding.bottom) * 0.22, -260, 260);
    const extraLeftShift =
      padding.right > padding.left
        ? clampNumber((padding.right - padding.left) * 0.5, 18, 72)
        : 0;
    const adaptiveOffsetX = clampNumber(
      Math.round(resolvedAutoZoom.offsetX + directionLng * 90 * offsetScale + viewportBiasX - extraLeftShift),
      -1000,
      1000
    );
    const adaptiveOffsetY = clampNumber(
      Math.round(resolvedAutoZoom.offsetY - directionLat * 70 * offsetScale + viewportBiasY),
      -1000,
      1000
    );

    lastAutoFocusSignatureRef.current = focusSignature;

    const spanLng = Math.abs(maxLng - minLng);
    const spanLat = Math.abs(maxLat - minLat);
    if (spanLng < 1e-7 && spanLat < 1e-7) {
      mapRef.current.flyTo({
        center: [minLng, minLat],
        zoom: adaptiveSinglePointZoom,
        pitch: INITIAL_PITCH,
        bearing: 0,
        duration: adaptiveDurationMs,
        offset: [adaptiveOffsetX, adaptiveOffsetY],
        essential: true,
      });
      return;
    }

    const bounds: [[number, number], [number, number]] = [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
    const camera = mapRef.current.cameraForBounds(bounds, {
      padding,
      maxZoom: adaptiveBoundsMaxZoom,
      bearing: 0,
      pitch: INITIAL_PITCH,
    });
    if (camera) {
      const zoomBoost = clampNumber(0.85 - spanFactor * 0.08, 0.28, 0.8);
      const targetZoom = clampNumber((camera.zoom ?? adaptiveBoundsMaxZoom) + zoomBoost, 0, adaptiveBoundsMaxZoom);
      mapRef.current.easeTo({
        center: camera.center,
        zoom: targetZoom,
        bearing: 0,
        pitch: INITIAL_PITCH,
        duration: adaptiveDurationMs,
        offset: [adaptiveOffsetX, adaptiveOffsetY],
        essential: true,
      });
      return;
    }

    mapRef.current.fitBounds(bounds, {
      padding,
      maxZoom: adaptiveBoundsMaxZoom,
      duration: adaptiveDurationMs,
      offset: [adaptiveOffsetX, adaptiveOffsetY],
      essential: true,
    });
  }, [autoFocusKey, mapReady, resolvedAutoZoom, routeRenderData, viewportPadding]);

  const baseLayers = useMemo(() => {
    if (!routeRenderData) return [];
    const { cleanedRoutes, nodes, getScaledWidth, getScaledHeightByDistance } = routeRenderData;
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
          if (!object || !onRouteLocationSelect) return;
          onRouteLocationSelect(object.source_info.id, object.target_info.id);
        },
      }),
      new ScatterplotLayer({
        id: 'global-route-nodes',
        data: nodes,
        getPosition: (d: NodeVisualData) => d.position,
        getFillColor: (d: NodeVisualData) => d.color,
        getRadius: (d: NodeVisualData) => (d.nodeId === hoveredNodeId ? 9 : 6),
        radiusUnits: 'pixels',
        stroked: true,
        getLineColor: (d: NodeVisualData) => d.color,
        getLineWidth: 1,
        pickable: true,
        onClick: ({ object }: { object?: NodeVisualData }) => {
          if (!object?.nodeId || !onRouteLocationSelect) return;
          onRouteLocationSelect(object.nodeId, object.nodeId);
        },
      }),
    ];
  }, [routeRenderData, onRouteLocationSelect, hoveredNodeId]);

  const createPatternLayers = useCallback((phase: number) => {
    if (!patternAnimationEnabled || !routeRenderData) return [];
    const { patternBuckets, getScaledHeightByDistance } = routeRenderData;
    return Array.from(patternBuckets.entries()).map(([patternRepeat, routesInBucket]) =>
      new PatternArcLayer<RouteData>({
        id: `global-route-arcs-pattern-${patternRepeat}`,
        patternRepeat,
        patternPhase: phase,
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
    );
  }, [patternAnimationEnabled, routeRenderData]);

  const setOverlayLayers = useCallback((phase: number) => {
    if (!overlayRef.current) return;
    const layers = patternAnimationEnabled
      ? [...baseLayers, ...createPatternLayers(phase)]
      : baseLayers;
    overlayRef.current.setProps({ layers });
  }, [baseLayers, createPatternLayers, patternAnimationEnabled]);

  useEffect(() => {
    setOverlayLayers(patternPhaseRef.current);
  }, [setOverlayLayers]);

  useEffect(() => {
    if (!mapReady || !patternAnimationEnabled || !routeRenderData || !overlayRef.current) {
      patternPhaseRef.current = 0;
      setOverlayLayers(0);
      return;
    }

    let rafId = 0;
    let last = performance.now();
    let lastRenderedAt = last;
    const frameInterval = 1000 / PATTERN_TARGET_FPS;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const nextPhase = patternPhaseRef.current + dt * PATTERN_ANIMATION_SPEED;
      patternPhaseRef.current = nextPhase >= 1 ? nextPhase - Math.floor(nextPhase) : nextPhase;

      if (now - lastRenderedAt >= frameInterval) {
        setOverlayLayers(patternPhaseRef.current);
        lastRenderedAt = now;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mapReady, patternAnimationEnabled, routeRenderData, setOverlayLayers]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
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
