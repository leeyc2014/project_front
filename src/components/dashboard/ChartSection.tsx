"use client";

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { RiskItem } from '@/types/dashboard';
import { EVENT_TYPE_LABELS } from '@/constants/eventType';
import type {
  BarOptionsConfig,
  ChartSectionProps,
  TimelineModalProps,
  XAxisCategory,
} from '@/types/chartSection';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const KPI_LABELS = [
  { key: 'unregisteredEpc', label: '미등록 EPC' },
  { key: 'integrityErrorEpc', label: '무결성 오류 EPC' },
  { key: 'clonedEpc', label: '복제 EPC' },
  { key: 'duplicateEpc', label: '중복 EPC' },
  { key: 'invalidHubMove', label: '허용되지 않는 거점 이동' },
  { key: 'impossibleSpeed', label: '불가능한 이동 속도' },
] as const;


const EVENT_TYPE_DISPLAY_ORDER = [
  '공장',
  '공장창고(In)',
  '공장창고(Out)',
  '물류센터(In)',
  '물류센터(Out)',
  '도매(In)',
  '도매(Out)',
  '소매(In)',
  '소매(Out)',
  '판매완료',
] as const;

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeKpi = (kpi: any) => {
  if (Array.isArray(kpi)) {
    const byStatus = new Map<string, number>();
    kpi.forEach((item: any) => {
      const status = String(item?.status ?? '').trim();
      if (!status) return;
      byStatus.set(status, toNumber(item?.ratio));
    });
    const pick = (...aliases: string[]) => {
      for (const alias of aliases) {
        if (byStatus.has(alias)) return toNumber(byStatus.get(alias));
      }
      return 0;
    };
    return {
      unregisteredEpc: pick('unregisteredEpc', 'unregistered_epc', 'missingEpc', 'missing_epc'),
      integrityErrorEpc: pick('integrityErrorEpc', 'integrity_error_epc', 'integrityEpc'),
      clonedEpc: pick('clonedEpc', 'cloned_epc', 'replicaEpc', 'replica_epc'),
      duplicateEpc: pick('duplicateEpc', 'duplicate_epc', 'duplicatedEpc', 'duplicated_epc', 'redundantEpc', 'redundant_epc'),
      invalidHubMove: pick('invalidHubMove', 'invalid_hub_move', 'invalidHubMovement', 'invalidLocationMove', 'invalid_location_move'),
      impossibleSpeed: pick('impossibleSpeed', 'impossible_speed', 'impossibleSpewed', 'speedImpossible'),
    };
  }

  return {
    unregisteredEpc: toNumber(kpi?.unregisteredEpc ?? kpi?.unregistered_epc ?? kpi?.missingEpc ?? kpi?.missing_epc),
    integrityErrorEpc: toNumber(kpi?.integrityErrorEpc ?? kpi?.integrity_error_epc ?? kpi?.integrityEpc),
    clonedEpc: toNumber(kpi?.clonedEpc ?? kpi?.cloned_epc ?? kpi?.replicaEpc ?? kpi?.replica_epc),
    duplicateEpc: toNumber(kpi?.duplicateEpc ?? kpi?.duplicate_epc ?? kpi?.duplicatedEpc ?? kpi?.duplicated_epc ?? kpi?.redundantEpc ?? kpi?.redundant_epc),
    invalidHubMove: toNumber(kpi?.invalidHubMove ?? kpi?.invalid_hub_move ?? kpi?.invalidHubMovement ?? kpi?.invalidLocationMove ?? kpi?.invalid_location_move),
    impossibleSpeed: toNumber(kpi?.impossibleSpeed ?? kpi?.impossibleSpewed ?? kpi?.impossible_speed ?? kpi?.speedImpossible),
  };
};

const normalizeLocationId = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return String(parsed);
  return raw;
};

const toTwoLineLabel = (value: string): XAxisCategory => {
  if (!value) return value;
  const trimmed = value.trim();
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace <= 0 || firstSpace >= trimmed.length - 1) return trimmed;
  return [trimmed.slice(0, firstSpace), trimmed.slice(firstSpace + 1)];
};

const resolveEventTypeLabel = (raw: string) => {
  const source = String(raw ?? '').trim();
  if (!source) return 'Other';
  const normalized = source
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return EVENT_TYPE_LABELS[normalized] || EVENT_TYPE_LABELS[normalized.replace(/_/g, '')] || source;
};

const buildBarOptions = (
  categories: XAxisCategory[],
  yTitle: string,
  formatter?: (value: number) => string,
  config: BarOptionsConfig = {}
) => ({
  chart: {
    type: 'bar',
    toolbar: { show: false },
    zoom: { enabled: false },
    foreColor: '#cbd5f5',
    parentHeightOffset: 0,
    ...(config.stacked ? { stacked: true, stackType: 'normal' as const } : {}),
  },
  plotOptions: {
    bar: {
      horizontal: Boolean(config.horizontal),
      borderRadius: 6,
      columnWidth: config.columnWidth ?? (config.compact ? '70%' : '55%'),
      ...(config.showStackTotal
        ? {
            dataLabels: {
              total: {
                enabled: true,
                offsetY: -4,
                style: { fontSize: '10px', fontWeight: 800, color: '#f8fafc' },
              },
            },
          }
        : {}),
    },
  },
  xaxis: {
    categories,
    labels: {
      style: { fontSize: '10px', fontWeight: 600 },
      rotate: config.xLabelRotate ?? 0,
      formatter: config.xLabelFormatter,
      trim: false,
      hideOverlappingLabels: false,
      minHeight: config.xLabelMaxHeight ? Math.min(60, config.xLabelMaxHeight) : undefined,
      maxHeight: config.xLabelMaxHeight,
    },
    axisBorder: { color: '#334155' },
    axisTicks: { color: '#334155' },
  },
  yaxis: {
    title: { text: yTitle, style: { fontSize: '10px', fontWeight: 700 } },
    labels: {
      formatter: config.horizontal
        ? ((value: string | number) => String(value))
        : (formatter ?? ((value: number) => Math.round(value).toString())),
    },
  },
  grid: {
    borderColor: '#1f2937',
    padding: {
      top: config.gridPaddingTop ?? (config.compact ? -14 : -4),
      bottom: config.gridPaddingBottom ?? (config.compact ? -10 : 0),
      left: 0,
      right: 0,
    },
  },
  tooltip: {
    theme: 'dark',
  },
  legend: {
    inverseOrder: false,
  },
  dataLabels: {
    enabled: Boolean(config.dataLabelsEnabled),
    offsetY: -6,
    style: { fontSize: '10px', fontWeight: 700 },
    formatter: config.dataLabelFormatter ?? ((value: number) => Math.round(value).toString()),
  },
  colors: config.colors ?? ['#38bdf8'],
});

export default function ChartSection({ variant, data, hubLocationMap }: ChartSectionProps) {
  const { series, options, emptyLabel } = useMemo(() => {
    if (variant === 'kpi') {
      const kpi = normalizeKpi(data?.kpi ?? (data as any)?.kpiResponse ?? (data as any)?.kpi_response);
      const values = KPI_LABELS.map(({ key }) => kpi[key]);
      const normalized = values;

      return {
        series: [{ name: 'Ratio (%)', data: normalized }],
        options: buildBarOptions(
          KPI_LABELS.map(({ label }) => toTwoLineLabel(label)),
          'Ratio (%)',
          (value) => `${value.toFixed(2)}%`,
          {
            compact: true,
            xLabelRotate: 0,
            xLabelMaxHeight: 120,
            dataLabelsEnabled: true,
            dataLabelFormatter: (value) => `${value.toFixed(2)}%`,
            colors: ['#ef4444'],
          }
        ),
        emptyLabel: 'No KPI data',
      };
    }

    if (variant === 'hub') {
      const hubs = ((data as any)?.hubStatsList ?? data?.riskyHubs ?? (data as any)?.risky_hubs ?? []) as any[];
      const aggregated: Record<string, { count: number; caution: number; error: number }> = {};

      hubs.forEach((hub) => {
        const locationId = normalizeLocationId(hub?.locationId ?? hub?.location_id);
        if (!locationId) return;
        if (!aggregated[locationId]) aggregated[locationId] = { count: 0, caution: 0, error: 0 };
        aggregated[locationId].count += toNumber(hub?.count);
        aggregated[locationId].caution += toNumber(hub?.cautionCount ?? hub?.caution_count);
        aggregated[locationId].error += toNumber(hub?.errorCount ?? hub?.error_count);
      });

      const topHubsByDefect = Object.entries(aggregated)
        .filter(([, stats]) => stats.error > 0 || stats.caution > 0)
        .sort((a, b) => {
          const errorDiff = b[1].error - a[1].error;
          if (errorDiff !== 0) return errorDiff;
          const cautionDiff = b[1].caution - a[1].caution;
          if (cautionDiff !== 0) return cautionDiff;
          return a[0].localeCompare(b[0], undefined, { numeric: true });
        })
        .slice(0, 5);

      const categories = topHubsByDefect.map(([locationId]) => {
        const mapped = hubLocationMap?.[locationId];
        return mapped || locationId;
      });
      const cautionPoints = topHubsByDefect.map(([, stats]) => stats.caution);
      const errorPoints = topHubsByDefect.map(([, stats]) => stats.error);

      return {
        series: [
          { name: 'Error Count', data: errorPoints },
          { name: 'Caution Count', data: cautionPoints },
        ],
        options: buildBarOptions(categories, 'Defect Count', undefined, {
          xLabelRotate: 0,
          xLabelMaxHeight: 80,
          dataLabelsEnabled: true,
          stacked: true,
          showStackTotal: true,
          columnWidth: '72%',
          gridPaddingTop: -18,
          gridPaddingBottom: -14,
          colors: ['#ef4444', '#facc15'],
          horizontal: true,
        }),
        emptyLabel: 'No hub defect data',
      };
    }

    const eventTypes = (data?.riskyEventTypes ?? (data as any)?.risky_event_types ?? (data as any)?.eventTypeStatsList ?? []) as any[];
    const aggregated: Record<string, { count: number; caution: number; error: number }> = {};

    eventTypes.forEach((event) => {
      const label = resolveEventTypeLabel(String(event?.eventType ?? event?.event_type ?? ''));
      if (!aggregated[label]) aggregated[label] = { count: 0, caution: 0, error: 0 };
      aggregated[label].count += toNumber(event?.count);
      aggregated[label].caution += toNumber(event?.cautionCount ?? event?.caution_count);
      aggregated[label].error += toNumber(event?.errorCount ?? event?.error_count);
    });

    const orderedLabels = EVENT_TYPE_DISPLAY_ORDER.filter((label) => aggregated[label]);
    const extraLabels = Object.keys(aggregated).filter((label) => !orderedLabels.includes(label as any));
    const categories = [...orderedLabels, ...extraLabels];
    const cautionPoints = categories.map((label) => aggregated[label]?.caution ?? 0);
    const errorPoints = categories.map((label) => aggregated[label]?.error ?? 0);

    return {
      series: [
        { name: 'Error Count', data: errorPoints },
        { name: 'Caution Count', data: cautionPoints },
      ],
      options: {
        ...buildBarOptions(categories, 'Defect Count', undefined, {
          compact: true,
          xLabelRotate: -45,
          xLabelMaxHeight: 80,
          dataLabelsEnabled: false,
          stacked: true,
          showStackTotal: true,
          columnWidth: '50%',
          colors: ['#ef4444', '#facc15'],
        }),
        tooltip: {
          theme: 'dark',
          shared: true,
          intersect: false,
          custom: ({ dataPointIndex, w }: any) => {
            const category = w?.globals?.labels?.[dataPointIndex] ?? '';
            const error = w?.config?.series?.[0]?.data?.[dataPointIndex] ?? 0;
            const caution = w?.config?.series?.[1]?.data?.[dataPointIndex] ?? 0;
            return `
              <div style="padding:8px 10px;font-size:11px;">
                <div style="font-weight:700;margin-bottom:4px;">${category}</div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="width:8px;height:8px;background:#facc15;border-radius:2px;display:inline-block;"></span>
                  <span>Caution Count: ${caution}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="width:8px;height:8px;background:#ef4444;border-radius:2px;display:inline-block;"></span>
                  <span>Error Count: ${error}</span>
                </div>
              </div>
            `;
          },
        },
      },
      emptyLabel: 'No event type data',
    };
  }, [data, hubLocationMap, variant]);

  if (!series[0]?.data?.length) {
    return (
      <div className="h-full flex items-center justify-center text-xs font-bold text-white">
        {emptyLabel}
      </div>
    );
  }

  return <Chart options={options as any} series={series} type="bar" height="100%" />;
}

export function EpcTimelineModal({
  open,
  serial,
  events,
  onClose,
  onApplyEpcFilter,
  onClearEpcFilter,
  isEpcFilterApplied = false,
}: TimelineModalProps) {
  const serialLabel = useMemo(() => {
    const first = events.find((event) => event != null);
    if (!first) return serial || '-';
    const productName = first?.productName || '-';
    const lot = first?.epcLot ?? '-';
    const epcSerial = first?.epcSerial ?? '-';
    return `${productName}(LOT: ${lot}, SERIAL: ${epcSerial})`;
  }, [events, serial]);
  const targetEpcCode = useMemo(() => {
    const first = events.find((event) => event?.epcCode);
    return (first?.epcCode || serial || '').trim();
  }, [events, serial]);

  const { series, options } = useMemo(() => {
    const valid = (events || []).filter((event) => event?.eventTime);
    const sorted = [...valid].sort((a, b) => {
      const ta = Date.parse(a.eventTime || '');
      const tb = Date.parse(b.eventTime || '');
      return ta - tb;
    });
    const getEventType = (event: RiskItem) => {
      const value = String(event?.eventType ?? '').trim();
      return value || 'Unknown';
    };
    const eventTypes = Array.from(new Set(sorted.map((event) => getEventType(event))));
    const getTimelineLabel = (axisValue: number) => {
      if (eventTypes.length === 0) return '';
      const index = Math.max(0, Math.min(eventTypes.length - 1, Math.round(axisValue)));
      return resolveEventTypeLabel(eventTypes[index] || '');
    };
    const firstTime = sorted.length > 0 ? Date.parse(sorted[0].eventTime || '') : NaN;
    const lastTime = sorted.length > 0 ? Date.parse(sorted[sorted.length - 1].eventTime || '') : NaN;
    const hasValidTimeRange = Number.isFinite(firstTime) && Number.isFinite(lastTime);
    const range = hasValidTimeRange ? Math.max(0, lastTime - firstTime) : 0;
    const timePadding = range > 0 ? Math.max(60 * 60 * 1000, Math.floor(range * 0.08)) : 24 * 60 * 60 * 1000;
    const xAxisMin = hasValidTimeRange ? firstTime - timePadding : undefined;
    const xAxisMax = hasValidTimeRange ? lastTime + timePadding : undefined;
    const seriesData = sorted.map((event) => ({
      x: new Date(event.eventTime).getTime(),
      y: eventTypes.indexOf(getEventType(event)),
      meta: event,
    }));

    return {
      series: [
        {
          name: 'Event Timeline',
          data: seriesData,
        },
      ],
      options: {
        chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false }, foreColor: '#e5e7eb' },
        xaxis: {
          type: 'datetime',
          min: xAxisMin,
          max: xAxisMax,
          labels: { style: { fontSize: '10px', fontWeight: 600 } },
        },
        yaxis: {
          labels: {
            formatter: (value: number) => getTimelineLabel(value),
            style: { fontSize: '10px', fontWeight: 600 },
            offsetX: -15,
            minWidth: 64,
            maxWidth: 76,
          },
          min: 0,
          max: Math.max(0, eventTypes.length - 1),
          tickAmount: eventTypes.length > 1 ? eventTypes.length - 1 : 1,
          forceNiceScale: false,
          decimalsInFloat: 0,
        },
        grid: {
          borderColor: '#1f2937',
          padding: { left: -8, right: 8 },
        },
        stroke: { width: 2, curve: 'straight' },
        markers: { size: 4, colors: ['#fbbf24'] },
        tooltip: {
          theme: 'dark',
          custom: ({ seriesIndex, dataPointIndex, w }: any) => {
            const point = w?.config?.series?.[seriesIndex]?.data?.[dataPointIndex];
            if (!point?.meta) return '';
            const timeText = new Date(point.meta.eventTime).toLocaleString();
            const eventType = point.meta.eventType || 'Unknown';
            return `
              <div style="padding:8px 10px;font-size:11px;">
                <div style="font-weight:700;margin-bottom:4px;">${EVENT_TYPE_LABELS[eventType.toUpperCase()]}</div>
                <div>${timeText}</div>
              </div>
            `;
          },
        },
      },
    };
  }, [events]);

  if (!open) return null;

  return (
    <div className="fixed right-[450px] top-24 z-40 w-[240px] max-w-[85vw] scale-150 origin-top-right">
      <div className="rounded-2xl border border-gray-700 bg-gray-900/95 p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-white uppercase tracking-widest">Event Timeline</div>
            <div className="text-xs font-bold text-white">{serialLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-700 px-3 py-1 text-[11px] font-bold text-white hover:bg-gray-800"
          >
            Close
          </button>
        </div>
        <div className="h-[260px]">
          {events.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-bold text-white">
              No timeline data
            </div>
          ) : (
            <Chart options={options as any} series={series} type="line" height="100%" />
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            disabled={!isEpcFilterApplied || !onClearEpcFilter}
            onClick={() => {
              if (!onClearEpcFilter) return;
              onClearEpcFilter();
            }}
            className="rounded-full border border-gray-600 bg-gray-800/40 px-3 py-1 text-[11px] font-bold text-white hover:bg-gray-700/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            적용 해제
          </button>
          <button
            type="button"
            disabled={!targetEpcCode || !onApplyEpcFilter}
            onClick={() => {
              if (!targetEpcCode || !onApplyEpcFilter) return;
              onApplyEpcFilter(targetEpcCode);
            }}
            className="rounded-full border border-amber-500/70 bg-amber-500/20 px-3 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            필터 적용
          </button>
        </div>
      </div>
    </div>
  );
}
