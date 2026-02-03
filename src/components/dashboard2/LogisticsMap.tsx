// components/LogisticsMap.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Map } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ArcLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import routesData from '../../../public/data/rich_routes.json';

// 데이터 포맷 정의
export interface RouteData {
  count: number;
  source_info: { id: string; name: string; coords: [number, number] };
  target_info: { id: string; name: string; coords: [number, number] };
  epc_list: string[];
}

export type TrackingPoint = {
  coords: [number, number];
  t: number;
};

type LogisticsMapProps = {
  epcFilter?: string[] | null;
  routes?: RouteData[];
  trackingPath?: TrackingPoint[] | null;
};

export default function LogisticsMap({ epcFilter, routes, trackingPath }: LogisticsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const fallbackData = useMemo(
    () => (Array.isArray(routesData) && routesData.length > 0 ? (routesData as RouteData[]) : []),
    []
  );
  const [routeData, setRouteData] = useState<RouteData[]>(fallbackData);
  const [trackingTime, setTrackingTime] = useState<number | null>(null);
  const trackingFrameRef = useRef<number | null>(null);
  const normalizeRoutes = (data: RouteData[]) =>
    data
      .filter((d) => d != null)
      .filter((d) => d.source_info && d.target_info)
      .filter((d) => {
        const src = d.source_info.coords;
        const tgt = d.target_info.coords;
        return (
          Array.isArray(src) &&
          Array.isArray(tgt) &&
          src.length === 2 &&
          tgt.length === 2 &&
          Number.isFinite(src[0]) &&
          Number.isFinite(src[1]) &&
          Number.isFinite(tgt[0]) &&
          Number.isFinite(tgt[1])
        );
      })
      .map((d) => ({
        ...d,
        epc_list: Array.isArray(d.epc_list) ? d.epc_list : [],
      }));

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // 1. 지도 초기화
    const map = new Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [127.6, 36.4],
      zoom: 8,
      pitch: 50,
      bearing: 15,
      //antialias: true
    });

    mapRef.current = map;

    map.on('load', () => {
      setMapReady(true);

      if (!routes || routes.length === 0) {
        const loadRoutes = async () => {
          try {
            const response = await fetch('/api/map/routes');
            if (!response.ok) return;
            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) return;
            setRouteData(normalizeRoutes(data as RouteData[]));
          } catch (error) {
            console.error('Failed to load route data:', error);
          }
        };

        void loadRoutes();
      }
    });

    return () => map.remove();
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const createDeckOverlay = (data: RouteData[]) => {
      const safeData = normalizeRoutes(data);
      if (safeData.length === 0) return null;
      const maxCount = Math.max(...safeData.map(d => d.count));

      return new MapboxOverlay({
        interleaved: true,
        layers: [
          new ArcLayer({
            id: 'logistics-arc-layer',
            data: safeData,
            pickable: true,
            getSourcePosition: (d: RouteData) => d.source_info.coords,
            getTargetPosition: (d: RouteData) => d.target_info.coords,
            getSourceColor: (d: RouteData) => (d.count / maxCount > 0.5 ? [255, 50, 50] : [0, 200, 255]),
            getTargetColor: [0, 255, 100],
            getWidth: (d: RouteData) => Math.max(1, (d.count / maxCount) * 12),
            getHeight: (d: RouteData) => 0.5 + (d.count / maxCount) * 2,
          })
        ],
        getTooltip: (info: any) => {
          const object = info.object as RouteData;
          if (!object) return null;
          const maxShow = 5;
          const epcList = object.epc_list || [];
          const totalEpc = epcList.length;
          let epcHtml = epcList.slice(0, maxShow).map(code => `- ${code}`).join('<br>');
          if (totalEpc > maxShow) epcHtml += `<br><span style="color:#aaa;">...외 ${totalEpc - maxShow}건</span>`;

          return {
            html: `
              <div style="width: 250px; font-family: sans-serif;">
                <div style="border-bottom: 1px solid #555; padding-bottom: 8px; margin-bottom: 8px;">
                  <strong style="font-size: 1.1em; color: #fff;">총 이동량 ${object.count.toLocaleString()}건</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <div style="color: #00e5ff;"><small>FROM</small><br><b>${object.source_info.name}</b></div>
                  <div style="color: #ff0055; text-align: right;"><small>TO</small><br><b>${object.target_info.name}</b></div>
                </div>
                <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 4px;">
                  <strong style="color: #ffd700;">포함된 EPC (샘플)</strong><br>
                  <div style="margin-top: 4px; line-height: 1.4; color: #ddd;">${epcHtml}</div>
                </div>
              </div>`,
            style: {
              backgroundColor: 'rgba(20, 20, 20, 0.95)',
              color: 'white',
              borderRadius: '8px',
              padding: '12px'
            }
          };
        }
      });
    };

    const hasFilter = epcFilter != null;
    const filterSet = hasFilter && epcFilter.length > 0 ? new Set(epcFilter) : null;
    const filtered = hasFilter
      ? filterSet
        ? routeData.filter(route => Array.isArray(route.epc_list) && route.epc_list.some(epc => filterSet.has(epc)))
        : []
      : routeData;

    if (overlayRef.current) {
      mapRef.current.removeControl(overlayRef.current as any);
      overlayRef.current = null;
    }

    const nextOverlay = createDeckOverlay(filtered);
    if (nextOverlay) {
      mapRef.current.addControl(nextOverlay as any);
      overlayRef.current = nextOverlay;
    }
  }, [mapReady, routeData, epcFilter]);

  useEffect(() => {
    if (!routes || routes.length === 0) return;
    setRouteData(normalizeRoutes(routes));
  }, [routes]);

  return <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />;
}


