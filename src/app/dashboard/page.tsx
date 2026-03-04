"use client";

import { useState, useMemo, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useRawDashboardData } from '@/hooks/useRawDashboardData';
import { FilterState } from '@/types/dashboard';
import { DEFAULT_FILTERS } from '@/constants/dashboard';
import SerialList from '@/components/dashboard/SerialList';
import FilterPanel from '@/components/dashboard/FilterPanel';
import ChartSection, { EpcTimelineModal } from '@/components/dashboard/ChartSection';
import DashboardLoadingOverlay from '@/components/dashboard/DashboardLoadingOverlay';
import DateRangeQuickPicker from '@/components/dashboard/DateRangeQuickPicker';
import type { AutoZoomSettings,RouteData } from '@/types/logisticsMap';
import { DEFAULT_AUTO_ZOOM_SETTINGS } from '@/constants/logisticsMap';
import type { HubDefectTab } from '@/types/chartSection';
import { useAtom } from 'jotai';
import { dashboardReloadTriggerAtom } from '@/atoms/atom';
import { getAuthToken } from '@/utils/authToken';

const LogisticsMap = dynamic(() => import('@/components/dashboard/LogisticsMap'), {
  ssr: false,
  loading: () => <div style={{ background: '#000', height: '100vh' }}>Loading map...</div>
});
const Section = ({ title, children, headerRight }: any) => (
  <div className="flex flex-col h-full bg-gray-900/90 border border-gray-800 shadow-lg overflow-hidden backdrop-blur-sm text-gray-100">
    <div className="h-12 px-4 bg-gray-900/95 border-b border-gray-800 flex items-center justify-between flex-none">
      <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">{title}</h3>
      {headerRight}
    </div>
    <div className="flex-1 p-4 relative min-h-0 overflow-hidden">{children}</div>
  </div>
);

const isSameStringArray = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const isSameFilterState = (a: FilterState, b: FilterState) =>
  isSameStringArray(a.factoryLocationTypes, b.factoryLocationTypes) &&
  isSameStringArray(a.warehouseLocationTypes, b.warehouseLocationTypes) &&
  isSameStringArray(a.logisticCenterLocationTypes, b.logisticCenterLocationTypes) &&
  isSameStringArray(a.salerLocationTypes, b.salerLocationTypes) &&
  isSameStringArray(a.retailerLocationTypes, b.retailerLocationTypes) &&
  isSameStringArray(a.operatorIds, b.operatorIds) &&
  isSameStringArray(a.deviceIds, b.deviceIds) &&
  isSameStringArray(a.epcCompanies, b.epcCompanies) &&
  isSameStringArray(a.epcProducts, b.epcProducts) &&
  a.epcCode === b.epcCode &&
  a.epcLot === b.epcLot &&
  a.epcSerial === b.epcSerial &&
  a.eventTimeStart === b.eventTimeStart &&
  a.eventTimeEnd === b.eventTimeEnd &&
  a.manufactureDate === b.manufactureDate &&
  a.expiryDate === b.expiryDate;

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPage = searchParams.get('page');
  const rawSize = searchParams.get('size');
  const rawStatus = searchParams.get('status') || searchParams.get('st');
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : NaN;
  const pageParam = Number.isFinite(parsedPage) && parsedPage >= 0 ? parsedPage : undefined;
  const page = pageParam ?? 0;
  const parsedSize = rawSize ? Number.parseInt(rawSize, 10) : NaN;
  const size = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : undefined;
  const status = (rawStatus || 'ALL') as 'ALL' | 'SAFE' | 'CAUTION' | 'DANGER';

  const parseIds = (value: string | null): string[] => {
    if (!value) return [];
    return value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v !== '0' && v.length > 0);
  };

  const parseNullableNumber = (value: string | null): number | null => {
    if (!value) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return null;
    return n;
  };

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [hubDefectTab, setHubDefectTab] = useState<HubDefectTab>('error');
  const { backendEvents, filterOptions, locationList, totalPages, totalElements, isLoading } = useRawDashboardData(pageParam, size, status, filters);
  const [chartData, setChartData] = useState<any>(null);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const hubLocationMap = useMemo(() => {
    const map: Record<string, string> = {};
    (locationList || []).forEach((location) => {
      const id = String((location as any)?.locationId ?? '').trim();
      const name = String((location as any)?.locationName ?? '').trim();
      if (id && name) map[id] = name;
    });
    return map;
  }, [locationList]);

  const mapRoutes = useMemo<RouteData[]>(() => {
    const hubMoves = (chartData?.hubMoveStatsList ??
      chartData?.hubMoveStats ??
      chartData?.hub_move_stats ??
      []) as any[];
    if (!Array.isArray(hubMoves) || hubMoves.length === 0) return [];

    const locationById = new Map<string, any>();
    (locationList || []).forEach((loc: any) => {
      const id = String(loc?.locationId ?? '').trim();
      if (!id) return;
      locationById.set(id, loc);
    });

    const toCoords = (loc: any): [number, number] | null => {
      if (!loc) return null;
      const a = Number(loc?.longtitude ?? loc?.longitude ?? loc?.lng);
      const b = Number(loc?.latitude ?? loc?.lat);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      if (Math.abs(a) <= 90 && Math.abs(b) > 90) {
        return [b, a];
      }
      return [a, b];
    };

    return hubMoves
      .map((move: any) => {
        const fromId = String(move?.fromLocationId ?? move?.from_location_id ?? '').trim();
        const toId = String(move?.toLocationId ?? move?.to_location_id ?? '').trim();
        if (!fromId || !toId) return null;

        const fromLoc = locationById.get(fromId);
        const toLoc = locationById.get(toId);
        const fromCoords = toCoords(fromLoc);
        const toCoordsValue = toCoords(toLoc);
        if (!fromCoords || !toCoordsValue) return null;

        return {
          count: Number(move?.count ?? 0) || 0,
          cautionCount: Number(move?.cautionCount ?? move?.caution_count ?? 0) || 0,
          errorCount: Number(move?.errorCount ?? move?.error_count ?? 0) || 0,
          source_info: {
            id: fromId,
            name: String(fromLoc?.locationName ?? fromId),
            coords: fromCoords,
          },
          target_info: {
            id: toId,
            name: String(toLoc?.locationName ?? toId),
            coords: toCoordsValue,
          },
          epc_list: [],
        } as RouteData;
      })
      .filter((route): route is RouteData => Boolean(route));
  }, [chartData, locationList]);

  const mergedEvents = useMemo(() => {
    const merged = [...backendEvents];
    const seen = new Set<string>();
    return merged.filter((e) => {
      const key = `${e.epcCode}|${e.eventTime || ''}|${e.eventType || ''}|${e.detailIndex ?? ''}|${e.scanLocation || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [backendEvents]);

  const [activeSerial, setActiveSerial] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isPatternAnimationEnabled, setIsPatternAnimationEnabled] = useState(false);
  const [resetToken, setResetToken] = useState(0); // 원본 resetToken 복구 [cite: 179]
  const [mapPadding, setMapPadding] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  const [mapAutoZoomSettings, setMapAutoZoomSettings] = useState<AutoZoomSettings>(DEFAULT_AUTO_ZOOM_SETTINGS);
  const [timelineAutoZoomNonce, setTimelineAutoZoomNonce] = useState(0);
  const [timelineAutoZoomSerial, setTimelineAutoZoomSerial] = useState<string | null>(null);
  const [serialPhase, setSerialPhase] = useState<'shown' | 'hidden' | 'enter' | 'leave'>('shown');
  const [chartsPhase, setChartsPhase] = useState<'shown' | 'hidden' | 'enter' | 'leave'>('shown');
  const serialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChartRequestKeyRef = useRef<string>('');
  const chartRequestIdRef = useRef(0);
  const [dashboardReloadTrigger] = useAtom<number>(dashboardReloadTriggerAtom);

  const mapWrapRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const bottomChartsRef = useRef<HTMLDivElement>(null);
  const timelinePanelRef = useRef<HTMLDivElement>(null);
  const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '';
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const nextFilters: FilterState = {
      factoryLocationTypes: parseIds(params.get('factoryLocations')),
      warehouseLocationTypes: parseIds(params.get('warehouseLocations')),
      logisticCenterLocationTypes: parseIds(params.get('logisticCenterLocations')),
      salerLocationTypes: parseIds(params.get('salerLocations')),
      retailerLocationTypes: parseIds(params.get('retailerLocations')),
      operatorIds: parseIds(params.get('operators')),
      deviceIds: parseIds(params.get('devices')),
      epcCompanies: parseIds(params.get('companies')),
      epcProducts: parseIds(params.get('products')),
      epcCode: params.get('epcCode') || '',
      epcLot: parseNullableNumber(params.get('epcLot')),
      epcSerial: parseNullableNumber(params.get('epcSerial')),
      eventTimeStart: params.get('eventTimeStart') || '',
      eventTimeEnd: params.get('eventTimeEnd') || '',
      manufactureDate: params.get('manufactureDate') || '',
      expiryDate: params.get('expiryDate') || '',
    };
    setFilters((prev) => (isSameFilterState(prev, nextFilters) ? prev : nextFilters));
  }, [searchParams]);

  useEffect(() => {
    if (!backendBaseUrl) {
      setIsChartLoading(false);
      return;
    }
    const controller = new AbortController();
    const requestId = ++chartRequestIdRef.current;
    setIsChartLoading(true);

    const fetchCharts = async () => {
      try {
        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const toCsv = (list: string[] | undefined) => {
          const values = (list || [])
            .map((value) => String(value).trim())
            .filter((value) => value.length > 0 && value !== '0');
          return values.length ? values.join(',') : '';
        };
        const setIfPresent = (params: URLSearchParams, key: string, value: string) => {
          if (value) params.set(key, value);
        };

        const query = new URLSearchParams();

        setIfPresent(query, 'factoryLocations', toCsv(filters.factoryLocationTypes));
        setIfPresent(query, 'warehouseLocations', toCsv(filters.warehouseLocationTypes));
        setIfPresent(query, 'logisticCenterLocations', toCsv(filters.logisticCenterLocationTypes));
        setIfPresent(query, 'salerLocations', toCsv(filters.salerLocationTypes));
        setIfPresent(query, 'retailerLocations', toCsv(filters.retailerLocationTypes));
        setIfPresent(query, 'operators', toCsv(filters.operatorIds));
        setIfPresent(query, 'devices', toCsv(filters.deviceIds));
        setIfPresent(query, 'companies', toCsv(filters.epcCompanies));
        setIfPresent(query, 'products', toCsv(filters.epcProducts));
        setIfPresent(query, 'epcCode', (filters.epcCode || '').trim());
        setIfPresent(query, 'epcLot', filters.epcLot != null ? String(filters.epcLot) : '');
        setIfPresent(query, 'epcSerial', filters.epcSerial != null ? String(filters.epcSerial) : '');
        setIfPresent(query, 'eventTimeStart', filters.eventTimeStart || '');
        setIfPresent(query, 'eventTimeEnd', filters.eventTimeEnd || '');
        setIfPresent(query, 'manufactureDate', filters.manufactureDate || '');
        setIfPresent(query, 'expiryDate', filters.expiryDate || '');
	query.set('_t', dashboardReloadTrigger.toString());

        const queryString = query.toString();
        const url = queryString
          ? `${backendBaseUrl}/api/v1/dashboard/chart?${queryString}`
          : `${backendBaseUrl}/api/v1/dashboard/chart`;
        if (lastChartRequestKeyRef.current === url) return;

        const maxAttempts = 40;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (controller.signal.aborted) return;

          const token = getAuthToken();
          if (!token) {
            await wait(250);
            continue;
          }

          const res = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          });
          const text = await res.text();
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              await wait(300);
              continue;
            }
            lastError = new Error(`Chart API failed (${res.status}): ${text || res.statusText}`);
            break;
          }

          const data = text ? JSON.parse(text) : null;
          setChartData({
            kpi: data?.kpi ?? data?.kpiResponse ?? data?.kpi_response,
            riskyHubs: data?.hubStatsList ?? data?.riskyHubs ?? data?.risky_hubs,
            riskyEventTypes: data?.eventTypeStatsList ?? data?.riskyEventTypes ?? data?.risky_event_types,
            hubMoveStatsList: data?.hubMoveStatsList ?? data?.hubMoveStats ?? data?.hub_move_stats,
          });
          lastChartRequestKeyRef.current = url;
          return;
        }

        if (lastError) {
          throw lastError;
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.error('Chart API Error:', err);
        }
      } finally {
        if (chartRequestIdRef.current === requestId) {
          setIsChartLoading(false);
        }
      }
    };

    fetchCharts();
    return () => controller.abort();
  }, [backendBaseUrl, filters, dashboardReloadTrigger]);

  // RESET MAP 기능 (원본 로직 반영) [cite: 270, 272]
  const handleResetMap = useCallback(() => {
    setActiveSerial(null);
    setTimelineAutoZoomNonce(0);
    setTimelineAutoZoomSerial(null);
    setResetToken((prev) => prev + 1);
  }, []);

  const computeMapPadding = useCallback(() => {
    if (!mapWrapRef.current) return;
    const rect = mapWrapRef.current.getBoundingClientRect();
    const left = leftPanelRef.current?.getBoundingClientRect();
    const right = rightPanelRef.current?.getBoundingClientRect();
    const bottom = bottomChartsRef.current?.getBoundingClientRect();
    const timeline = timelinePanelRef.current?.getBoundingClientRect();
    const serialInLayout = serialPhase !== 'hidden';
    const chartsInLayout = chartsPhase !== 'hidden';
    const timelineInLayout = serialInLayout && timelineOpen && Boolean(activeSerial) && Boolean(timeline);
    const rightBySerialList = serialInLayout && right ? Math.max(0, rect.right - right.left) : 0;
    const rightByTimeline = timelineInLayout && timeline ? Math.max(0, rect.right - timeline.left) : 0;
    setMapPadding({
      top: 0,
      left: left ? left.right - rect.left : 0,
      right: Math.max(rightBySerialList, rightByTimeline),
      bottom: chartsInLayout && bottom ? rect.bottom - bottom.top : 0,
    });
  }, [activeSerial, chartsPhase, serialPhase, timelineOpen]);

  useLayoutEffect(() => {
    computeMapPadding();
    window.addEventListener('resize', computeMapPadding);
    return () => window.removeEventListener('resize', computeMapPadding);
  }, [computeMapPadding]);

  const toggleSerialList = useCallback(() => {
    if (serialTimerRef.current) clearTimeout(serialTimerRef.current);
    if (serialPhase === 'shown' || serialPhase === 'enter') {
      setSerialPhase('leave');
      serialTimerRef.current = setTimeout(() => setSerialPhase('hidden'), 300);
    } else {
      setSerialPhase('enter');
      serialTimerRef.current = setTimeout(() => setSerialPhase('shown'), 300);
    }
  }, [serialPhase]);

  const toggleCharts = useCallback(() => {
    if (chartsTimerRef.current) clearTimeout(chartsTimerRef.current);
    if (chartsPhase === 'shown' || chartsPhase === 'enter') {
      setChartsPhase('leave');
      chartsTimerRef.current = setTimeout(() => setChartsPhase('hidden'), 300);
    } else {
      setChartsPhase('enter');
      chartsTimerRef.current = setTimeout(() => setChartsPhase('shown'), 300);
    }
  }, [chartsPhase]);

  useEffect(() => {
    return () => {
      if (serialTimerRef.current) clearTimeout(serialTimerRef.current);
      if (chartsTimerRef.current) clearTimeout(chartsTimerRef.current);
    };
  }, []);

  const allEventsBySerial = useMemo(() => {
    const map: Record<string, any[]> = {};
    mergedEvents.forEach(e => {
      const key = e.epcCode || 'UNKNOWN';
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    // Sort by event_time (eventTime) ascending within each EPC
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const ta = Date.parse(a.eventTime || '');
        const tb = Date.parse(b.eventTime || '');
        const na = Number.isNaN(ta);
        const nb = Number.isNaN(tb);
        if (na && nb) {
          const ia = typeof a.detailIndex === 'number' ? a.detailIndex : Number.POSITIVE_INFINITY;
          const ib = typeof b.detailIndex === 'number' ? b.detailIndex : Number.POSITIVE_INFINITY;
          if (ia === ib) return 0;
          return ia - ib;
        }
        if (na) return 1;
        if (nb) return -1;
        return ta - tb;
      });
    });
    return map;
  }, [mergedEvents]);

  const serials = useMemo(() => {
    const selected = new Set<string>();
    mergedEvents.forEach((event) => {
      const key = event.epcCode || 'UNKNOWN';
      selected.add(key);
    });
    return Array.from(selected).sort();
  }, [mergedEvents]);

  const autoFocusSerialKey = useMemo(() => {
    if (timelineAutoZoomNonce <= 0) return null;
    const requestedSerial = String(timelineAutoZoomSerial || '').trim();
    if (!requestedSerial) return null;
    if (serials.length !== 1) return null;
    const currentSerial = String(serials[0] || '').trim();
    if (!currentSerial || currentSerial !== requestedSerial) return null;
    return `${currentSerial}|${timelineAutoZoomNonce}`;
  }, [serials, timelineAutoZoomNonce, timelineAutoZoomSerial]);

  const eventsBySerial = useMemo(() => {
    const map: Record<string, any[]> = {};
    serials.forEach((serial) => {
      map[serial] = allEventsBySerial[serial] || [];
    });
    return map;
  }, [serials, allEventsBySerial]);
  const isMapPending = isLoading || isChartLoading;

  const handlePageChange = useCallback((nextPage: number) => {
    setTimelineAutoZoomNonce(0);
    setTimelineAutoZoomSerial(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(Math.max(0, nextPage)));
    params.delete('size');
    params.delete('status');
    router.push(`/dashboard?${params.toString()}`);
  }, [router, searchParams]);

  const handleStatusChange = useCallback((nextStatus: 'ALL' | 'SAFE' | 'CAUTION' | 'DANGER') => {
    setTimelineOpen(false);
    setTimelineAutoZoomNonce(0);
    setTimelineAutoZoomSerial(null);

    const current = new URLSearchParams(searchParams.toString());
    const params = new URLSearchParams();

    if (nextStatus !== 'ALL') params.set('status', nextStatus);
    params.set('page', '0');

    for (const [key, value] of current.entries()) {
      if (key === 'status' || key === 'st' || key === 'page' || key === 'size') continue;
      params.set(key, value);
    }

    router.push(`/dashboard?${params.toString()}`);
  }, [router, searchParams]);

  const handleRouteLocationSelect = useCallback((fromLocationId: string, toLocationId: string) => {
    setTimelineOpen(false);
    setTimelineAutoZoomNonce(0);
    setTimelineAutoZoomSerial(null);
    setResetToken((prev) => prev + 1);

    const normalizeId = (value: string) => String(value || '').trim();
    const routeLocationIds = Array.from(
      new Set([normalizeId(fromLocationId), normalizeId(toLocationId)].filter((value) => value.length > 0))
    );

    const groupKeys = [
      'factoryLocationTypes',
      'warehouseLocationTypes',
      'logisticCenterLocationTypes',
      'salerLocationTypes',
      'retailerLocationTypes',
    ] as const;
    const grouped: Record<(typeof groupKeys)[number], string[]> = {
      factoryLocationTypes: [],
      warehouseLocationTypes: [],
      logisticCenterLocationTypes: [],
      salerLocationTypes: [],
      retailerLocationTypes: [],
    };

    const optionGroups: Record<(typeof groupKeys)[number], Set<string>> = {
      factoryLocationTypes: new Set((filterOptions.factoryLocationTypes || []).map((item) => String(item.key).trim())),
      warehouseLocationTypes: new Set((filterOptions.warehouseLocationTypes || []).map((item) => String(item.key).trim())),
      logisticCenterLocationTypes: new Set((filterOptions.logisticCenterLocationTypes || []).map((item) => String(item.key).trim())),
      salerLocationTypes: new Set((filterOptions.salerLocationTypes || []).map((item) => String(item.key).trim())),
      retailerLocationTypes: new Set((filterOptions.retailerLocationTypes || []).map((item) => String(item.key).trim())),
    };

    const resolveGroupKeyFromType = (rawType: string): (typeof groupKeys)[number] | null => {
      const locationType = rawType.trim().toUpperCase();
      if (!locationType) return null;
      if (locationType.includes('FACTORY') || locationType.includes('공장')) return 'factoryLocationTypes';
      if (locationType.includes('WAREHOUSE') || locationType.includes('창고')) return 'warehouseLocationTypes';
      if (locationType.includes('LOGISTIC') || locationType.includes('CENTER') || locationType.includes('물류')) {
        return 'logisticCenterLocationTypes';
      }
      if (locationType.includes('SALER') || locationType.includes('WHOLESALE') || locationType.includes('도매')) {
        return 'salerLocationTypes';
      }
      if (locationType.includes('RETAIL') || locationType.includes('소매')) return 'retailerLocationTypes';
      return null;
    };

    routeLocationIds.forEach((locationId) => {
      const matchedKeyFromOptions = groupKeys.find((key) => optionGroups[key].has(locationId));
      if (matchedKeyFromOptions) {
        grouped[matchedKeyFromOptions].push(locationId);
        return;
      }

      const locationInfo = (locationList || []).find(
        (location) => String((location as any)?.locationId ?? '').trim() === locationId
      );
      const matchedKey = resolveGroupKeyFromType(String((locationInfo as any)?.type ?? ''));
      if (matchedKey) {
        grouped[matchedKey].push(locationId);
        return;
      }

      // Fallback: type 매핑이 불가능하면 모든 location 그룹에 넣어서 from/to 둘 다 필터에 반영되게 한다.
      groupKeys.forEach((key) => grouped[key].push(locationId));
    });

    groupKeys.forEach((key) => {
      grouped[key] = Array.from(new Set(grouped[key]));
    });

    const toCsv = (list: string[]) => {
      const values = list
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0 && value !== '0');
      return values.length ? values.join(',') : '';
    };
    const setOrDelete = (params: URLSearchParams, key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    const params = new URLSearchParams();
    // Map route/node selection should reset non-location filters, but keep date filters.
    params.set('page', '0');
    setOrDelete(params, 'eventTimeStart', filters.eventTimeStart || '');
    setOrDelete(params, 'eventTimeEnd', filters.eventTimeEnd || '');
    setOrDelete(params, 'manufactureDate', filters.manufactureDate || '');
    setOrDelete(params, 'expiryDate', filters.expiryDate || '');
    setOrDelete(params, 'factoryLocations', toCsv(grouped.factoryLocationTypes));
    setOrDelete(params, 'warehouseLocations', toCsv(grouped.warehouseLocationTypes));
    setOrDelete(params, 'logisticCenterLocations', toCsv(grouped.logisticCenterLocationTypes));
    setOrDelete(params, 'salerLocations', toCsv(grouped.salerLocationTypes));
    setOrDelete(params, 'retailerLocations', toCsv(grouped.retailerLocationTypes));

    router.push(`/dashboard?${params.toString()}`);
  }, [filterOptions, filters.eventTimeEnd, filters.eventTimeStart, filters.expiryDate, filters.manufactureDate, locationList, router]);

  const handleHubLocationSelect = useCallback((locationId: string) => {
    handleRouteLocationSelect(locationId, locationId);
  }, [handleRouteLocationSelect]);

  const handleApplyFilters = useCallback((nextFilters: FilterState) => {
    setTimelineOpen(false);
    setTimelineAutoZoomNonce(0);
    setTimelineAutoZoomSerial(null);
    setFilters(nextFilters);

    const toCsv = (list: string[] | undefined) => {
      const values = (list || [])
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0 && value !== '0');
      return values.length ? values.join(',') : '';
    };

    const setOrDelete = (params: URLSearchParams, key: string, value: string) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    };

    const params = new URLSearchParams();

    params.set('page', '0');
    params.delete('size');
    params.delete('status');
    if (status !== 'ALL') {
      params.set('status', status);
    } else {
      params.delete('status');
    }

    setOrDelete(params, 'factoryLocations', toCsv(nextFilters.factoryLocationTypes));
    setOrDelete(params, 'warehouseLocations', toCsv(nextFilters.warehouseLocationTypes));
    setOrDelete(params, 'logisticCenterLocations', toCsv(nextFilters.logisticCenterLocationTypes));
    setOrDelete(params, 'salerLocations', toCsv(nextFilters.salerLocationTypes));
    setOrDelete(params, 'retailerLocations', toCsv(nextFilters.retailerLocationTypes));
    setOrDelete(params, 'operators', toCsv(nextFilters.operatorIds));
    setOrDelete(params, 'devices', toCsv(nextFilters.deviceIds));
    setOrDelete(params, 'companies', toCsv(nextFilters.epcCompanies));
    setOrDelete(params, 'products', toCsv(nextFilters.epcProducts));

    setOrDelete(params, 'epcCode', (nextFilters.epcCode || '').trim());
    setOrDelete(params, 'epcLot', nextFilters.epcLot != null ? String(nextFilters.epcLot) : '');
    setOrDelete(params, 'epcSerial', nextFilters.epcSerial != null ? String(nextFilters.epcSerial) : '');
    setOrDelete(params, 'eventTimeStart', nextFilters.eventTimeStart || '');
    setOrDelete(params, 'eventTimeEnd', nextFilters.eventTimeEnd || '');
    setOrDelete(params, 'manufactureDate', nextFilters.manufactureDate || '');
    setOrDelete(params, 'expiryDate', nextFilters.expiryDate || '');

    setResetToken((prev) => prev + 1);
    router.push(`/dashboard?${params.toString()}`);
  }, [router, status]);

  const handleApplySerialEpcFilter = useCallback((epcCode: string) => {
    const value = (epcCode || '').trim();
    if (!value) return;
    setIsChartLoading(true);
    setTimelineAutoZoomSerial(value);
    setTimelineAutoZoomNonce((prev) => prev + 1);

    const params = new URLSearchParams(searchParams.toString());
    params.set('epcCode', value);
    params.set('page', '0');
    params.delete('size');
    //params.delete('status');
    params.delete('status');

    //setTimelineOpen(false);
    setResetToken((prev) => prev + 1);
    router.push(`/dashboard?${params.toString()}`);
  }, [router, searchParams]);

  const handleClearSerialEpcFilter = useCallback(() => {
    setIsChartLoading(true);
    setTimelineAutoZoomNonce(0);
    setTimelineAutoZoomSerial(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('epcCode');
    params.set('page', '0');
    params.delete('size');

    setTimelineOpen(false);
    setResetToken((prev) => prev + 1);
    router.push(`/dashboard?${params.toString()}`);
  }, [router, searchParams]);

  const handleQuickDateRangeChange = useCallback(
    (nextStart: string, nextEnd: string) => {
      const nextFilters = { ...filters, eventTimeStart: nextStart, eventTimeEnd: nextEnd };
      setFilters(nextFilters);
      setTimelineOpen(false);
      setTimelineAutoZoomNonce(0);
      setTimelineAutoZoomSerial(null);

      const params = new URLSearchParams(searchParams.toString());
      const setOrDelete = (paramKey: 'eventTimeStart' | 'eventTimeEnd', paramValue: string) => {
        if (paramValue) {
          params.set(paramKey, paramValue);
        } else {
          params.delete(paramKey);
        }
      };
      setOrDelete('eventTimeStart', nextStart || '');
      setOrDelete('eventTimeEnd', nextEnd || '');
      params.set('page', '0');
      params.delete('size');
      params.delete('status');

      setResetToken((prev) => prev + 1);
      router.push(`/dashboard?${params.toString()}`);
    },
    [filters, router, searchParams]
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-100" ref={mapWrapRef}>
      <div className="absolute inset-0">
        <LogisticsMap
          routes={isMapPending ? [] : (mapRoutes.length > 0 ? mapRoutes : [])}
          resetToken={resetToken}
          viewportPadding={mapPadding}
          autoFocusKey={autoFocusSerialKey}
          autoZoomSettings={mapAutoZoomSettings}
          onRouteLocationSelect={handleRouteLocationSelect}
          patternAnimationEnabled={isPatternAnimationEnabled}
        />
      </div>

      {/* 왼쪽 상단 플로팅 필터 및 리셋 버튼 */}
      <div className="absolute top-6 left-20 z-20 pointer-events-none flex flex-col items-start gap-3">
        {/* 시간 필터 박스 + 애니메이션 스위치 */}
        <div className="pointer-events-auto flex items-center gap-3">
          <DateRangeQuickPicker
            startDate={filters.eventTimeStart}
            endDate={filters.eventTimeEnd}
            onApply={handleQuickDateRangeChange}
            dropdownPosition="absolute"
          />
        <button
          type="button"
          role="switch"
          aria-checked={isPatternAnimationEnabled}
          onClick={() => setIsPatternAnimationEnabled((prev) => !prev)}
          className="h-10 rounded-full border border-gray-700/70 bg-gray-900/90 px-2.5 shadow-xl backdrop-blur-md flex items-center gap-2"
        >
          <span className="text-[10px] font-black tracking-wider text-gray-200">TRACK</span>
          <span
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
              isPatternAnimationEnabled ? 'bg-green-500/80' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isPatternAnimationEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </span>
          <span className="text-[10px] font-black tracking-wider text-gray-300 w-6 text-center">
            {isPatternAnimationEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
        </div>

        {/* RESET MAP 버튼 (필터 바로 아래 배치)  */}
        <button
          onClick={handleResetMap}
          className="bg-gray-900/90 backdrop-blur shadow-lg px-5 py-2 rounded-full text-[10px] font-black text-gray-200 hover:bg-white hover:text-gray-900 transition-all active:scale-95 pointer-events-auto flex items-center gap-2 uppercase tracking-widest border border-gray-700/70"
        >
          <ResetIcon />
          RESET MAP VIEW
        </button>
      </div>

      {/* Serial filter button (top-left of map) */}
      <div className="absolute top-6 left-6 z-20 pointer-events-auto">
        <button
          onClick={() => setIsFilterOpen(true)}
          className="h-10 w-10 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-lg text-gray-700 hover:bg-gray-900 hover:text-white transition-all active:scale-95 flex items-center justify-center ring-1 ring-white/50"
          aria-label="Open filter panel"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M4 5h16l-6.5 7.5V19l-3 1v-7.5L4 5z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      </div>

      {/* Serial list show/hide button (top-right) */}
      <div className="absolute top-3.5 right-6 z-20 pointer-events-auto">
        <button
          onClick={toggleSerialList}
          className="h-9 w-9 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-lg text-gray-700 hover:bg-gray-900 hover:text-white transition-all active:scale-95 flex items-center justify-center ring-1 ring-white/50"
          aria-label="Toggle serial list"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M6 6h12M6 12h12M6 18h12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      </div>

      {/* Charts show/hide button (bottom center) */}
      <div className="absolute bottom-3 left-4 z-20 pointer-events-auto">
        <button
          onClick={toggleCharts}
          className="h-9 w-9 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-lg text-gray-700 hover:bg-gray-900 hover:text-white transition-all active:scale-95 flex items-center justify-center ring-1 ring-white/50"
          aria-label="Toggle charts"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M5 19h14M7 17V9m5 8V5m5 12v-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      </div>

      <div className="relative z-10 h-full p-2 pointer-events-none">
        <div
          className={`h-full grid grid-cols-1 lg:grid-cols-[300px_1fr_420px] ${chartsPhase === 'hidden' ? 'grid-rows-[1fr_0px]' : 'grid-rows-[1fr_240px]'} gap-2`}
        >
          {/* 좌측 상단 비움 */}
          <div className="hidden lg:block pointer-events-none" />

          {/* 중앙 상단은 플로팅 UI가 차지하므로 비워둠 */}
          <div className="hidden lg:block pointer-events-none" />

          <div
            className={`h-full lg:col-start-3 lg:row-start-1 lg:row-span-2 overflow-hidden transition-all duration-300 ${
              serialPhase === 'hidden'
                ? 'pointer-events-none opacity-0 translate-x-4'
                : 'pointer-events-auto opacity-100 translate-x-0'
            } ${
              serialPhase === 'enter'
                ? 'serial-enter'
                : serialPhase === 'leave'
                ? 'serial-leave'
                : serialPhase === 'hidden'
                ? 'serial-hidden'
                : 'serial-shown'
            }`}
            ref={rightPanelRef}
          >
              <Section title="Logistics Tracking List">
                <SerialList
                  serials={serials}
                  eventsBySerial={eventsBySerial}
                  activeSerial={activeSerial}
                  onSerialToggle={(serial) =>
                    setActiveSerial((prev) => {
                      const next = prev === serial ? null : serial;
                      setTimelineOpen(Boolean(next));
                      return next;
                    })
                  }
                  statusFilter={status}
                  onStatusChange={handleStatusChange}
                  page={page}
                  totalPages={totalPages}
                  totalElements={totalElements}
                  onPageChange={handlePageChange}
                />
              </Section>
            </div>

          <div className={`lg:col-start-1 lg:col-span-2 pointer-events-auto transition-all duration-300 ${chartsPhase === 'enter' ? 'charts-enter' : chartsPhase === 'leave' ? 'charts-leave' : chartsPhase === 'hidden' ? 'charts-hidden' : 'charts-shown'}`} ref={bottomChartsRef}>
              <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-2">
                <div className="h-full" ref={leftPanelRef}>
                  <Section title="KPI Chart">
                    <ChartSection variant="kpi" data={chartData} />
                  </Section>
                </div>
                <Section title="Hub Defect Count">
                  <ChartSection
                    variant="hub"
                    data={chartData}
                    hubLocationMap={hubLocationMap}
                    hubDefectTab={hubDefectTab}
                    onHubDefectTabChange={setHubDefectTab}
                    onHubLocationSelect={handleHubLocationSelect}
                  />
                </Section>
                <Section title="Event Type Defect Count">
                  <ChartSection variant="eventType" data={chartData} />
                </Section>
              </div>
            </div>
        </div>
      </div>

      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={handleApplyFilters}
        mapZoomSettings={mapAutoZoomSettings}
        setMapZoomSettings={setMapAutoZoomSettings}
        filterOptions={filterOptions}
      />
      <EpcTimelineModal
        open={serialPhase !== 'hidden' && timelineOpen && Boolean(activeSerial)}
        serial={activeSerial}
        events={activeSerial ? (eventsBySerial[activeSerial] || []) : []}
        onClose={() => setTimelineOpen(false)}
        onApplyEpcFilter={handleApplySerialEpcFilter}
        onClearEpcFilter={handleClearSerialEpcFilter}
        isEpcFilterApplied={Boolean((searchParams.get('epcCode') || '').trim())}
        panelRef={timelinePanelRef}
      />
      {isMapPending && <DashboardLoadingOverlay />}
    </div>
  );
}

function ResetIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
