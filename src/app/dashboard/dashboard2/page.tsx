"use client";

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import SerialList from '@/components/dashboard2/SerialList';
import type { RouteData } from '@/components/dashboard2/LogisticsMap';
import { RiskItem } from '@/types/dashboard';
import ApexCharts from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });
const LogisticsMap = dynamic(() => import('@/components/dashboard2/LogisticsMap'), {
  ssr: false,
  loading: () => <div style={{ background: '#000', height: '100vh' }}>Loading map...</div>
});

// A more modern color palette
const CHART_COLORS = {
  blue: '#3b82f6',
  orange: '#f97316',
  green: '#22c55e',
  red: '#ef4444',
  purple: '#8b5cf6',
  teal: '#14b8a6',
};

const Section = ({ title, children, headerRight, contentClassName }: { title: string, children: React.ReactNode, headerRight?: React.ReactNode, contentClassName?: string }) => (
  <div className="flex flex-col h-full bg-white/90 border border-gray-200 shadow-lg rounded-2xl overflow-hidden backdrop-blur-sm">
    <div className="h-12 px-4 bg-gray-50/90 border-b border-gray-200 flex items-center justify-between flex-none">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h3>
      {headerRight}
    </div>
    <div className={`flex-1 p-4 relative min-h-0${contentClassName ? ` ${contentClassName}` : ''}`}>{children}</div>
  </div>
);

type FilterState = {
  locationTypes: string[];
  operatorIds: string[];
  deviceIds: string[];
  epcCompanies: string[];
  epcProducts: string[];
  epcCode: string;
  epcLot: string;
  epcSerial: string;
  eventTimeStart: string;
  eventTimeEnd: string;
  manufactureDate: string;
  expiryDate: string;
};

const DEFAULT_FILTERS: FilterState = {
  locationTypes: [],
  operatorIds: [],
  deviceIds: [],
  epcCompanies: [],
  epcProducts: [],
  epcCode: '',
  epcLot: '',
  epcSerial: '',
  eventTimeStart: '',
  eventTimeEnd: '',
  manufactureDate: '',
  expiryDate: '',
};

const baseChartOptions: ApexCharts.ApexOptions = {
  chart: {
    toolbar: { show: false },
    animations: { enabled: true, speed: 800 },
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    foreColor: '#374151',
  },
  grid: {
    borderColor: '#e5e7eb',
    strokeDashArray: 4,
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: true } },
  },
  tooltip: {
    theme: 'dark',
    custom: function({ seriesIndex, dataPointIndex, w }) {
      const data = w.globals.initialSeries[seriesIndex]?.data?.[dataPointIndex];
      const time = data?.x != null ? new Date(data.x).toLocaleString() : '';
      const value = data?.y ?? w.globals.series?.[seriesIndex]?.[dataPointIndex] ?? '-';
      const timeRow = time ? `<div><b>Time:</b> ${time}</div>` : '';
      return `<div class="px-3 py-2">
        ${timeRow}
        <div><b>Value:</b> ${value}</div>
      </div>`;
    }
  },
  dataLabels: { enabled: false },
  legend: { show: false },
};

export default function Dashboard2Page() {
  const [backendEvents, setBackendEvents] = useState<RiskItem[]>([]);
  const [uploadedEvents, setUploadedEvents] = useState<RiskItem[]>([]);
  const [backendRoutes, setBackendRoutes] = useState<RouteData[]>([]);
  const [isBackendLoading, setIsBackendLoading] = useState(true);
  const [isUploadLoading, setIsUploadLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [activeSerial, setActiveSerial] = useState<string | null>(null);
  const [lastSelectedSerial, setLastSelectedSerial] = useState<string | null>(null);
  const [sequenceTab, setSequenceTab] = useState<'OPERATOR' | 'DEVICE'>('OPERATOR');
  const [locationCoords, setLocationCoords] = useState<Record<string, { lat: number; lon: number }>>({});
  const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '';
  const hasBackend = Boolean(backendBaseUrl);
  const backendEventsUrl = backendBaseUrl ? `${backendBaseUrl}/events` : '/api/epcis/events';
  const backendRoutesUrl = backendBaseUrl ? `${backendBaseUrl}/routes` : '/api/map/routes';

  useEffect(() => {
    if (!hasBackend) {
      setIsBackendLoading(false);
      return;
    }
    const fetchBackendEvents = async () => {
      setIsBackendLoading(true);
      try {
        const response = await fetch(backendEventsUrl);
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data)) {
          setBackendEvents(data as RiskItem[]);
        } else if (Array.isArray(data?.items)) {
          setBackendEvents(data.items as RiskItem[]);
        }
      } catch (error) {
        console.error('Failed to load backend events:', error);
      } finally {
        setIsBackendLoading(false);
      }
    };

    void fetchBackendEvents();
  }, [backendEventsUrl, hasBackend]);

  useEffect(() => {
    const fetchBackendRoutes = async () => {
      try {
        const response = await fetch(backendRoutesUrl);
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data)) {
          setBackendRoutes(data as RouteData[]);
        }
      } catch (error) {
        console.error('Failed to load backend routes:', error);
      }
    };

    void fetchBackendRoutes();
  }, []);

  useEffect(() => {
    const fetchUploadedEvents = async () => {
      setIsUploadLoading(true);
      try {
        const response = await fetch('/api/epcis/events?raw=true');
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data)) {
          setUploadedEvents(data as RiskItem[]);
        }
      } catch (error) {
        console.error('Failed to load uploaded events:', error);
      } finally {
        setIsUploadLoading(false);
      }
    };

    void fetchUploadedEvents();
  }, []);

  const safe = (val: unknown) => (val == null ? '' : String(val).trim());
  const normalizeEventType = (value: unknown) => safe(value).toUpperCase().replace(/[-\s]/g, '_');
  const normalizeLocationName = (value: unknown) => safe(value).replace(/\s+/g, ' ').trim();
  const primaryEvents = useMemo(() => {
    const merged = [...backendEvents, ...uploadedEvents].filter((event) => event != null);
    if (merged.length === 0) return [];
    const seen = new Set<string>();
    return merged.filter((event) => {
      const key = [
        safe(event.epcCode),
        safe(event.eventTime),
        safe(event.eventType),
        safe(event.deviceId),
        safe(event.operatorId),
        safe(event.locationId),
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [backendEvents, uploadedEvents]);
  const isLoading = isBackendLoading && isUploadLoading && primaryEvents.length === 0;
  const toDateMs = (value: unknown) => {
    if (value == null) return null;
    const ms = value instanceof Date ? value.getTime() : new Date(value as string | number).getTime();
    return Number.isFinite(ms) ? ms : null;
  };

  const getLocationType = (event: RiskItem) => {
    const normalized = normalizeEventType(event.eventType);
    if (['AGGREGATION', 'WMS_INBOUND', 'WMS_OUTBOUND'].includes(normalized)) return '공장';
    if (['HUB_INBOUND', 'HUB_OUTBOUND'].includes(normalized)) return '물류센터';
    if (['W_STOCK_INBOUND', 'W_STOCK_OUTBOUND'].includes(normalized)) return '도매';
    if (['R_STOCK_INBOUND', 'R_STOCK_OUTBOUND', 'POS_SELL'].includes(normalized)) return '소매';
    return '';
  };

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const response = await fetch('/data/location_list2.csv');
        if (!response.ok) return;
        const text = await response.text();
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return;
        const map: Record<string, { lat: number; lon: number }> = {};
        for (let i = 1; i < lines.length; i++) {
          const [locationId, scanLocation, lat, lon] = lines[i].split(',');
          const name = safe(scanLocation);
          const latNum = Number.parseFloat(lat);
          const lonNum = Number.parseFloat(lon);
          if (!name || Number.isNaN(latNum) || Number.isNaN(lonNum)) continue;
          map[name] = { lat: latNum, lon: lonNum };
        }
        setLocationCoords(map);
      } catch (error) {
        console.error('Failed to load location list:', error);
      }
    };

    void loadLocations();
  }, []);

  const filterOptions = useMemo(() => {
    const uniq = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort();

    const operatorIds = uniq(primaryEvents.map((e) => safe(e.operatorId)));
    const deviceIds = uniq(primaryEvents.map((e) => safe(e.deviceId)));
    const epcCompanies = uniq(primaryEvents.map((e) => safe(e.epcCompany)));
    const epcProducts = uniq(primaryEvents.map((e) => safe(e.epcProduct)));

    const typeLabels = ['공장', '물류센터', '도매', '소매'];
    const typeCounts = new Map<string, number>();
    typeLabels.forEach((t) => typeCounts.set(t, 0));
    primaryEvents.forEach((e) => {
      const type = getLocationType(e);
      if (type && typeCounts.has(type)) {
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      }
    });

    const locationTypes = typeLabels.map((label) => ({
      label,
      count: typeCounts.get(label) || 0,
    }));

    const times = primaryEvents
      .map((e) => new Date(e.eventTime))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    let min = '';
    let max = '';
    let defaultStart = '';
    let defaultEnd = '';
    if (times.length > 0) {
      min = times[0].toISOString().slice(0, 10);
      max = times[times.length - 1].toISOString().slice(0, 10);
      const end = times[times.length - 1];
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      defaultStart = start.toISOString().slice(0, 10);
      defaultEnd = end.toISOString().slice(0, 10);
    }

    return {
      locationTypes,
      operatorIds,
      deviceIds,
      epcCompanies,
      epcProducts,
      eventTime: { min, max, defaultStart, defaultEnd },
    };
  }, [primaryEvents]);

  useEffect(() => {
    if (!filters.eventTimeStart && !filters.eventTimeEnd) {
      if (filterOptions.eventTime.defaultStart && filterOptions.eventTime.defaultEnd) {
        setFilterValue('eventTimeStart', filterOptions.eventTime.defaultStart);
        setFilterValue('eventTimeEnd', filterOptions.eventTime.defaultEnd);
      }
    }
  }, [filterOptions.eventTime.defaultStart, filterOptions.eventTime.defaultEnd]);

  const toggleFilter = (field: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const current = prev[field];
      if (!Array.isArray(current)) return prev;
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter((item) => item !== value) } as FilterState;
      }
      return { ...prev, [field]: [...current, value] } as FilterState;
    });
  };

  const setFilterValue = (field: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const filteredEvents = useMemo(() => {
    const codeQuery = filters.epcCode.toLowerCase();
    const lotQuery = filters.epcLot.toLowerCase();
    const serialQuery = filters.epcSerial.toLowerCase();
    const manufactureQuery = filters.manufactureDate;
    const expiryQuery = filters.expiryDate;
    const startDate = filters.eventTimeStart;
    const endDate = filters.eventTimeEnd;

    return primaryEvents.filter((event) => {
      const locationType = getLocationType(event);

      if (filters.locationTypes.length > 0 && !filters.locationTypes.includes(locationType)) return false;
      if (filters.operatorIds.length > 0 && !filters.operatorIds.includes(safe(event.operatorId))) return false;
      if (filters.deviceIds.length > 0 && !filters.deviceIds.includes(safe(event.deviceId))) return false;
      if (filters.epcCompanies.length > 0 && !filters.epcCompanies.includes(safe(event.epcCompany))) return false;
      if (filters.epcProducts.length > 0 && !filters.epcProducts.includes(safe(event.epcProduct))) return false;

      const epcCode = safe(event.epcCode).toLowerCase();
      const epcLot = safe(event.epcLot).toLowerCase();

      if (codeQuery && !epcCode.includes(codeQuery)) return false;
      if (lotQuery && !epcLot.includes(lotQuery)) return false;
      if (serialQuery && !epcCode.includes(serialQuery)) return false;

      if (manufactureQuery) {
        const mfg = safe(event.manufactureDate);
        if (!mfg.startsWith(manufactureQuery)) return false;
      }
      if (expiryQuery) {
        const exp = safe(event.expiryDate);
        if (!exp.startsWith(expiryQuery)) return false;
      }

      if (startDate || endDate) {
        const eventDate = new Date(event.eventTime);
        if (Number.isNaN(eventDate.getTime())) return false;
        const iso = eventDate.toISOString().slice(0, 10);
        if (startDate && iso < startDate) return false;
        if (endDate && iso > endDate) return false;
      }

      return true;
    });
  }, [primaryEvents, filters]);

  const eventsBySerial = useMemo(() => {
    const map: Record<string, RiskItem[]> = {};
    filteredEvents.forEach((event) => {
      const key = safe(event.epcCode) || 'UNKNOWN';
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });

    Object.values(map).forEach((items) => {
      items.sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());
    });

    return map;
  }, [filteredEvents]);

  const serials = useMemo(() => {
    return Object.keys(eventsBySerial).sort();
  }, [eventsBySerial]);

  useEffect(() => {
    if (activeSerial) {
      setLastSelectedSerial(activeSerial);
    }
  }, [activeSerial]);

  const selectedEvents = useMemo(() => {
    const serial = lastSelectedSerial;
    if (!serial) return [];
    const items = eventsBySerial[serial] || [];
    return [...items].sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());
  }, [lastSelectedSerial, eventsBySerial]);

  const aggregationFactoryChartData = useMemo(() => {
    const labels = ['구미공장', '양산공장', '인천공장', '화성공장'];
    const counts = labels.map(() => 0);
    filteredEvents.forEach((event) => {
      if (normalizeEventType(event.eventType) !== 'AGGREGATION') return;
      const loc = safe(event.scanLocation);
      const idx = labels.indexOf(loc);
      if (idx >= 0) counts[idx] += 1;
    });
    const series = [{ name: 'Aggregation Count', data: counts }];
    const options: ApexCharts.ApexOptions = {
      ...baseChartOptions,
      chart: { ...baseChartOptions.chart, type: 'bar' },
      colors: [CHART_COLORS.teal],
      plotOptions: { bar: { borderRadius: 6, columnWidth: '60%' } },
      xaxis: { categories: labels },
      yaxis: { title: { text: 'Count' } },
      tooltip: { theme: 'dark' },
    };
    return { series, options };
  }, [filteredEvents]);

  const operatorDeviceCountChartData = useMemo(() => {
    const isOperator = sequenceTab === 'OPERATOR';
    const minorThreshold = 10000;
    const map = new Map<string, Set<string>>();
    filteredEvents.forEach((event) => {
      const id = safe(isOperator ? event.operatorId : event.deviceId);
      const epc = safe(event.epcCode);
      if (!id || !epc) return;
      if (!map.has(id)) map.set(id, new Set());
      map.get(id)?.add(epc);
    });
    const entries = Array.from(map.entries()).map(([id, set]) => ({
      id,
      count: set.size,
    }));
    let categories: string[] = [];
    let counts: number[] = [];
    const shouldGroup = entries.length > 20;
    if (shouldGroup) {
      const majors = entries.filter((entry) => entry.count > minorThreshold).sort((a, b) => a.id.localeCompare(b.id));
      const minors = entries.filter((entry) => entry.count <= minorThreshold);
      const minorSum = minors.reduce((acc, entry) => acc + entry.count, 0);
      categories = majors.map((entry) => entry.id);
      counts = majors.map((entry) => entry.count);
      if (minorSum > 0) {
        categories.push('기타');
        counts.push(minorSum);
      }
    } else {
      categories = entries.map((entry) => entry.id).sort();
      counts = categories.map((id) => map.get(id)?.size || 0);
    }
    const series = [{ name: isOperator ? 'Operator Count' : 'Device Count', data: counts }];
    const options: ApexCharts.ApexOptions = {
      ...baseChartOptions,
      chart: { ...baseChartOptions.chart, type: 'bar' },
      colors: [isOperator ? CHART_COLORS.red : CHART_COLORS.purple],
      plotOptions: { bar: { borderRadius: 6, columnWidth: '60%' } },
      xaxis: { categories, labels: { rotate: -45, trim: true } },
      yaxis: { title: { text: 'EPC Count' } },
      tooltip: { theme: 'dark' },
    };
    return { series, options };
  }, [filteredEvents, sequenceTab, filters]);

  const swappedTimelineChartData = useMemo(() => {
    if (selectedEvents.length === 0) return { series: [], options: {} };
    const categories: string[] = [];
    const points: number[] = [];
    selectedEvents.forEach((event) => {
      const time = toDateMs(event.eventTime);
      const type = normalizeEventType(event.eventType);
      if (time == null || !type) return;
      categories.push(type);
      points.push(time);
    });
    const series = [{
      name: 'Event Time',
      data: points,
    }];
    const options: ApexCharts.ApexOptions = {
      ...baseChartOptions,
      chart: { ...baseChartOptions.chart, type: 'line' },
      stroke: { curve: 'straight', width: 2 },
      xaxis: {
        type: 'category',
        categories,
        tickAmount: Math.max(categories.length, 1),
        labels: {
          formatter: (val: string) => safe(val),
          rotate: -45,
          rotateAlways: true,
          hideOverlappingLabels: false,
          showDuplicates: true,
          trim: false,
          maxHeight: 100,
          style: { fontSize: '8px' },
          offsetY: 2,
        },
      },
      yaxis: {
        labels: { formatter: (val: number) => new Date(val).toLocaleString() },
      },
      grid: {
        ...baseChartOptions.grid,
        padding: { bottom: 0 },
      },
      markers: { size: 7, hover: { sizeOffset: 3 } },
      colors: [CHART_COLORS.blue],
      tooltip: {
        theme: 'dark',
        x: {
          formatter: (_val: string, opts?: { dataPointIndex?: number }) => {
            const idx = opts?.dataPointIndex ?? -1;
            return idx >= 0 && idx < categories.length ? categories[idx] : 'N/A';
          },
        },
        y: { formatter: (val: number) => new Date(val).toLocaleString() },
      },
    };
    return { series, options };
  }, [selectedEvents]);

  const speedChartData = useMemo(() => {
    if (selectedEvents.length < 2) return { series: [], options: {} };
    const labels: string[] = [];
    const speeds: number[] = [];

    const toRadians = (deg: number) => (deg * Math.PI) / 180;
    const haversineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
      const R = 6371;
      const dLat = toRadians(b.lat - a.lat);
      const dLon = toRadians(b.lon - a.lon);
      const lat1 = toRadians(a.lat);
      const lat2 = toRadians(b.lat);
      const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
      return 2 * R * Math.asin(Math.sqrt(h));
    };

    for (let i = 1; i < selectedEvents.length; i++) {
      const prev = selectedEvents[i - 1];
      const curr = selectedEvents[i];
      const prevLoc = safe(prev.scanLocation);
      const currLoc = safe(curr.scanLocation);
      if (!prevLoc || !currLoc) continue;
      if (prevLoc === currLoc) continue;
      const prevType = normalizeEventType(prev.eventType);
      const currType = normalizeEventType(curr.eventType);
      const prevCoord = locationCoords[prevLoc];
      const currCoord = locationCoords[currLoc];
      if (!prevCoord || !currCoord) continue;
      const prevTime = toDateMs(prev.eventTime);
      const currTime = toDateMs(curr.eventTime);
      if (prevTime == null || currTime == null) continue;
      const hours = (currTime - prevTime) / 36e5;
      if (hours <= 0) continue;
      const distanceKm = haversineKm(prevCoord, currCoord);
      const speed = distanceKm / hours;
      labels.push(currLoc);
      speeds.push(Number.isFinite(speed) ? speed : 0);
    }

    const series = [{ name: 'Speed (km/h)', data: speeds }];
    const options: ApexCharts.ApexOptions = {
      ...baseChartOptions,
      chart: { ...baseChartOptions.chart, type: 'bar' },
      colors: [CHART_COLORS.orange],
      plotOptions: { bar: { borderRadius: 6, columnWidth: '60%' } },
      xaxis: {
        categories: labels,
        labels: {
          show: true,
          rotate: 0,
          trim: true,
          style: { fontSize: '10px' },
        },
      },
      yaxis: { title: { text: 'km/h' }, labels: { formatter: (val: number) => val.toFixed(2) } },
      tooltip: { theme: 'dark', y: { formatter: (val: number) => `${val.toFixed(2)} km/h` } },
    };
    return { series, options };
  }, [selectedEvents, locationCoords]);

  const filteredEpcs = useMemo(() => {
    const set = new Set<string>();
    filteredEvents.forEach((event) => {
      const code = safe(event.epcCode);
      if (code) set.add(code);
    });
    return Array.from(set);
  }, [filteredEvents]);

  const epcFilter = activeSerial
    ? [activeSerial]
    : lastSelectedSerial
      ? [lastSelectedSerial]
      : filteredEpcs;

  const renderChartPlaceholder = (message: string) => (
    <div className="h-full flex items-center justify-center text-sm text-gray-500">{message}</div>
  );

  return (
    <>
      <div className="relative h-full w-full overflow-hidden bg-gray-100">
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          <LogisticsMap epcFilter={epcFilter} routes={backendRoutes.length > 0 ? backendRoutes : undefined} />
        </div>

        <div className="relative z-10 h-full p-4 pointer-events-none">
          <div className="h-full grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr_minmax(320px,380px)] grid-rows-[minmax(0,1fr)_minmax(180px,260px)] gap-4">
            <div className="h-full lg:row-span-2 pointer-events-auto">
              <div className="h-full grid grid-rows-2 gap-4">
                <Section title="AGGREGATION BY FACTORY">
                  {isLoading || filteredEvents.length === 0 ? renderChartPlaceholder("No data for selected filters.") : (
                    <Chart options={aggregationFactoryChartData.options} series={aggregationFactoryChartData.series} type="bar" height="100%" />
                  )}
                </Section>

                <Section
                  title="OPERATOR / DEVICE COUNT"
                  headerRight={
                    <div className="flex items-center space-x-2 text-xs font-bold">
                      <button
                        className={`px-3 py-1.5 rounded-lg transition-all ${sequenceTab === 'OPERATOR' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        onClick={() => setSequenceTab('OPERATOR')}
                      >
                        Operator
                      </button>
                      <button
                        className={`px-3 py-1.5 rounded-lg transition-all ${sequenceTab === 'DEVICE' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        onClick={() => setSequenceTab('DEVICE')}
                      >
                        Device
                      </button>
                    </div>
                  }
                >
                  {isLoading || filteredEvents.length === 0 ? renderChartPlaceholder("No data for selected filters.") : (
                    <Chart options={operatorDeviceCountChartData.options} series={operatorDeviceCountChartData.series} type="bar" height="100%" />
                  )}
                </Section>
              </div>
            </div>

            <div className="hidden lg:block pointer-events-none">
              <div className="h-full flex justify-end items-start">
                <div className="w-full max-w-[170px] bg-white/90 border border-gray-200 shadow-md rounded-lg px-2 py-1.5 backdrop-blur-sm pointer-events-auto">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-gray-600">
                      시작
                      <input
                        type="date"
                        className="mt-0.5 w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px]"
                        min={filterOptions.eventTime.min || undefined}
                        max={filters.eventTimeEnd || filterOptions.eventTime.max || undefined}
                        value={filters.eventTimeStart}
                        onChange={(e) => setFilterValue('eventTimeStart', e.target.value)}
                      />
                    </label>
                    <label className="block text-[10px] font-semibold text-gray-600">
                      종료
                      <input
                        type="date"
                        className="mt-0.5 w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px]"
                        min={filters.eventTimeStart || filterOptions.eventTime.min || undefined}
                        max={filterOptions.eventTime.max || undefined}
                        value={filters.eventTimeEnd}
                        onChange={(e) => setFilterValue('eventTimeEnd', e.target.value)}
                      />
                    </label>
                    <div className="flex items-center justify-between pt-0.5">
                      <button
                        type="button"
                        className="text-[10px] font-bold text-gray-500 hover:text-gray-800"
                        onClick={() => {
                          setFilterValue('eventTimeStart', '');
                          setFilterValue('eventTimeEnd', '');
                        }}
                      >
                        전체
                      </button>
                      <div className="text-[9px] text-gray-400">
                        {filterOptions.eventTime.min && filterOptions.eventTime.max
                          ? `${filterOptions.eventTime.min} ~ ${filterOptions.eventTime.max}`
                          : '날짜 없음'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-full lg:row-span-2 pointer-events-auto">
              <Section
                title="SERIAL LIST"
                headerRight={
                  <div className="flex items-center space-x-3">
                    <div className="flex flex items-end gap-3">
                      <button
                        type="button"
                        className="text-[10px] font-bold text-gray-500 hover:text-gray-800 disabled:opacity-50"
                        onClick={() => {
                          setActiveSerial(null);
                          setLastSelectedSerial(null);
                        }}
                        disabled={!activeSerial && !lastSelectedSerial}
                      >
                        RESET MAP
                      </button>
                      <span className="text-sm font-bold text-blue-600">TOTAL {serials.length}</span>                     
                    </div>
                    <button
                      className="px-2.5 py-1.5 text-xs font-bold rounded-lg text-gray-800 transition-all cursor-pointer"
                      onClick={() => setIsFilterOpen((prev) => !prev)}
                      aria-label="Filter"
                      title="Filter"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path
                          d="M3 6h18M3 12h18M3 18h18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                    </button>
                  </div>
                }
              >
                <SerialList
                  serials={serials}
                  eventsBySerial={eventsBySerial}
                  activeSerial={activeSerial}
                  onSerialToggle={(serial) => setActiveSerial((prev) => (prev === serial ? null : serial))}
                />
              </Section>
            </div>

            <div className="lg:col-start-2 lg:row-start-2 min-h-0 pointer-events-auto">
              <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title="EVENT TIMELINE" contentClassName="pt-3">
                  {isLoading || selectedEvents.length === 0 ? renderChartPlaceholder("Select a serial to view timeline.") : (
                    <Chart options={swappedTimelineChartData.options} series={swappedTimelineChartData.series} type="line" height="100%" />
                  )}
                </Section>

                <Section title="SPEED BY LOCATION">
                  {isLoading || selectedEvents.length === 0 ? renderChartPlaceholder("Select a serial to view speed.") : (
                    <Chart options={speedChartData.options} series={speedChartData.series} type="bar" height="100%" />
                  )}
                </Section>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isFilterOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)} />
          <div className="fixed z-50 top-16 bottom-16 right-4 w-[380px] bg-white/95 shadow-2xl rounded-2xl border border-gray-200 flex flex-col">
            <div className="h-14 px-4 border-b flex items-center justify-between bg-gray-50/95 flex-none">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Filters</h3>
              <button className="text-gray-500 hover:text-gray-800" onClick={() => setIsFilterOpen(false)}>Close</button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {isLoading && <div className="text-sm text-gray-500">Loading filter options...</div>}

              <details className="rounded-xl border border-gray-200 bg-white" open>
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">Location ID</summary>
                <div className="p-3">
                  {filterOptions.locationTypes.length === 0 ? <p className="text-sm text-gray-400">No data</p> : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {filterOptions.locationTypes.map((item) => (
                        <label key={item.label} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100">
                          <input type="checkbox" className="h-4 w-4 rounded accent-blue-600" checked={filters.locationTypes.includes(item.label)} onChange={() => toggleFilter('locationTypes', item.label)} />
                          <span>{item.label} ({item.count})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              <details className="rounded-xl border border-gray-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">Operator ID</summary>
                <div className="p-3">
                  {filterOptions.operatorIds.length === 0 ? <p className="text-sm text-gray-400">No data</p> : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {filterOptions.operatorIds.map((value) => (
                        <label key={value} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100">
                          <input type="checkbox" className="h-4 w-4 rounded accent-blue-600" checked={filters.operatorIds.includes(value)} onChange={() => toggleFilter('operatorIds', value)} />
                          <span className="truncate">{value}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              <details className="rounded-xl border border-gray-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">Device ID</summary>
                <div className="p-3">
                  {filterOptions.deviceIds.length === 0 ? <p className="text-sm text-gray-400">No data</p> : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {filterOptions.deviceIds.map((value) => (
                        <label key={value} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100">
                          <input type="checkbox" className="h-4 w-4 rounded accent-blue-600" checked={filters.deviceIds.includes(value)} onChange={() => toggleFilter('deviceIds', value)} />
                          <span className="truncate">{value}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              <details className="rounded-xl border border-gray-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">EPC Company</summary>
                <div className="p-3">
                  {filterOptions.epcCompanies.length === 0 ? <p className="text-sm text-gray-400">No data</p> : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {filterOptions.epcCompanies.map((value) => (
                        <label key={value} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100">
                          <input type="checkbox" className="h-4 w-4 rounded accent-blue-600" checked={filters.epcCompanies.includes(value)} onChange={() => toggleFilter('epcCompanies', value)} />
                          <span className="truncate">{value}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              <details className="rounded-xl border border-gray-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">EPC Product</summary>
                <div className="p-3">
                  {filterOptions.epcProducts.length === 0 ? <p className="text-sm text-gray-400">No data</p> : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {filterOptions.epcProducts.map((value) => (
                        <label key={value} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100">
                          <input type="checkbox" className="h-4 w-4 rounded accent-blue-600" checked={filters.epcProducts.includes(value)} onChange={() => toggleFilter('epcProducts', value)} />
                          <span className="truncate">{value}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              <details className="rounded-xl border border-gray-200 bg-white" open>
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">EPC Code / Lot / Serial</summary>
                <div className="p-3 space-y-3">
                  <label className="block text-xs font-semibold text-gray-600">
                    EPC Code
                    <input
                      type="text"
                      value={filters.epcCode}
                      onChange={(e) => setFilterValue('epcCode', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                      placeholder="검색어 입력"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    EPC Lot
                    <input
                      type="text"
                      value={filters.epcLot}
                      onChange={(e) => setFilterValue('epcLot', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                      placeholder="검색어 입력"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    EPC Serial
                    <input
                      type="text"
                      value={filters.epcSerial}
                      onChange={(e) => setFilterValue('epcSerial', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                      placeholder="검색어 입력"
                    />
                  </label>
                </div>
              </details>

              <details className="rounded-xl border border-gray-200 bg-white" open>
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">Event Time</summary>
                <div className="p-3 space-y-3">
                  <label className="block text-xs font-semibold text-gray-600">
                    시작일
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                      min={filterOptions.eventTime.min || undefined}
                      max={filters.eventTimeEnd || filterOptions.eventTime.max || undefined}
                      value={filters.eventTimeStart}
                      onChange={(e) => setFilterValue('eventTimeStart', e.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    종료일
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                      min={filters.eventTimeStart || filterOptions.eventTime.min || undefined}
                      max={filterOptions.eventTime.max || undefined}
                      value={filters.eventTimeEnd}
                      onChange={(e) => setFilterValue('eventTimeEnd', e.target.value)}
                    />
                  </label>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="text-[11px] font-bold text-gray-500 hover:text-gray-800"
                      onClick={() => {
                        setFilterValue('eventTimeStart', filterOptions.eventTime.defaultStart || '');
                        setFilterValue('eventTimeEnd', filterOptions.eventTime.defaultEnd || '');
                      }}
                    >
                      기본값 적용
                    </button>
                    <button
                      type="button"
                      className="text-[11px] font-bold text-gray-500 hover:text-gray-800"
                      onClick={() => {
                        setFilterValue('eventTimeStart', '');
                        setFilterValue('eventTimeEnd', '');
                      }}
                    >
                      초기화
                    </button>
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-gray-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">Manufacture Date</summary>
                <div className="p-3">
                  <label className="block text-xs font-semibold text-gray-600">
                    제조일
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                      value={filters.manufactureDate}
                      onChange={(e) => setFilterValue('manufactureDate', e.target.value)}
                    />
                  </label>
                </div>
              </details>

              <details className="rounded-xl border border-gray-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">Expiry Date</summary>
                <div className="p-3">
                  <label className="block text-xs font-semibold text-gray-600">
                    유효기간
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                      value={filters.expiryDate}
                      onChange={(e) => setFilterValue('expiryDate', e.target.value)}
                    />
                  </label>
                </div>
              </details>
            </div>
          </div>
        </>
      )}
    </>
  );
}
