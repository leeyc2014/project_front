'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';

// --- Types ---
export interface RouteData {
  count: number;
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
};

export default function LogisticsMap({ epcFilter, routes, trackingPath, resetToken, viewportPadding }: LogisticsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const trackingFrameRef = useRef<number | null>(null);
  
  const [mapReady, setMapReady] = useState(false);
  const [trackingTime, setTrackingTime] = useState<number | null>(null);
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);
  const isValidCoords = (coords: [number, number] | undefined) =>
    Array.isArray(coords) && coords.length === 2 && coords.every((v) => Number.isFinite(v));
  const KOREA_BOUNDS: [[number, number], [number, number]] = [[124.6, 33.1], [131.9, 38.7]];

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = new Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [127.6, 36.4],
      zoom: 7,
      pitch: 40,
      bearing: 0,
    });
    mapRef.current = map;
    map.on('load', () => setMapReady(true));
    return () => map.remove();
  }, []);

  useEffect(() => {
    if (routes) setRouteData(routes);
  }, [routes]);

  const filteredRoutes = useMemo(() => {
    if (!epcFilter || epcFilter.length === 0) return routeData;
    const set = new Set(epcFilter);
    return routeData
      .map((route) => {
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

  useEffect(() => {
    if (!mapReady || !mapRef.current || overlayRef.current) return;
    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
      getTooltip: () => null,
      getCursor: ({ isHovering }: { isHovering: boolean }) => (isHovering ? 'pointer' : ''),
      onHover: ({ x, y, object }: { x: number; y: number; object?: { label?: string; count?: number; epc_list?: string[] } }) => {
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
        setHoverInfo({ x, y, text: `총 경로 수: ${count}` });
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
    if (!mapReady || !mapRef.current || !trackingPath || trackingPath.length < 2) return;

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
  }, [mapReady, trackingPath, viewportPadding]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || resetToken == null) return;
    const cleanedRoutes = filteredRoutes.filter(
      (d) => isValidCoords(d?.source_info?.coords) && isValidCoords(d?.target_info?.coords)
    );
    const resetPadding = viewportPadding ?? 60;
    if (cleanedRoutes.length === 0) {
      mapRef.current.fitBounds(KOREA_BOUNDS, {
        padding: resetPadding,
        duration: 1200,
        pitch: 50,
        bearing: 0,
        essential: true,
      });
      return;
    }

    const bounds = new LngLatBounds();
    cleanedRoutes.forEach((route) => {
      bounds.extend(route.source_info.coords);
      bounds.extend(route.target_info.coords);
    });
    mapRef.current.fitBounds(bounds, {
      padding: resetPadding,
      duration: 1600,
      pitch: 100,
      bearing: 0,
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
    return [
        new ArcLayer({
          id: 'global-arc-layer',
          data: cleanedRoutes,
          getSourcePosition: (d: RouteData) => d.source_info.coords,
          getTargetPosition: (d: RouteData) => d.target_info.coords,
          getSourceColor: [0, 180, 255],
          getTargetColor: [0, 255, 150],
        getWidth: (d: RouteData) => {
          const count = d.count || 0;
          const weight = Math.sqrt(Math.max(count, 1));
          return Math.min(4, 1 + weight * 2.2);
        },
        getHeight: 0.6,
        pickable: true,
        autoHighlight: true,
        pickingRadius: 12,
      })
    ];
  }, [mapReady, filteredRoutes, trackingPath, trackingTime]);

  useEffect(() => {
    if (overlayRef.current) overlayRef.current.setProps({ layers });
  }, [layers]);

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
