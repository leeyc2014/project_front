'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type DateRangeQuickPickerProps = {
  startDate: string;
  endDate: string;
  onApply: (nextStart: string, nextEnd: string) => void;
  layout?: 'horizontal' | 'vertical';
  inline?: boolean;
};

type ActiveSide = 'start' | 'end' | null;

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateKey = (value: string) => {
  if (!value) return null;
  const [y, m, d] = value.split('-').map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
const monthTitle = (date: Date) => `${date.getMonth() + 1}월`;

function buildMonthCells(month: Date) {
  const first = startOfMonth(month);
  const firstDay = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<{ value: string | null; day: number | null }> = [];

  for (let i = 0; i < firstDay; i += 1) cells.push({ value: null, day: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(month.getFullYear(), month.getMonth(), day);
    cells.push({ value: toDateKey(d), day });
  }
  while (cells.length % 7 !== 0) cells.push({ value: null, day: null });
  return cells;
}

export default function DateRangeQuickPicker({
  startDate,
  endDate,
  onApply,
  layout = 'horizontal',
  inline = false,
}: DateRangeQuickPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const initialStart = startDate || '2024-07-25';
  const initialEnd = endDate || '2024-07-31';

  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [leftMonth, setLeftMonth] = useState(startOfMonth(parseDateKey(initialStart) ?? new Date()));
  const [rightMonth, setRightMonth] = useState(startOfMonth(parseDateKey(initialEnd) ?? addMonths(new Date(), 1)));
  const [activeSide, setActiveSide] = useState<ActiveSide>(null);

  useEffect(() => {
    if (!open) {
      const nextStart = startDate || '2024-07-25';
      const nextEnd = endDate || '2024-07-31';
      setDraftStart(nextStart);
      setDraftEnd(nextEnd);
      setLeftMonth(startOfMonth(parseDateKey(nextStart) ?? new Date()));
      setRightMonth(startOfMonth(parseDateKey(nextEnd) ?? addMonths(new Date(), 1)));
      setActiveSide(null);
    }
  }, [open, startDate, endDate]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const leftCells = useMemo(() => buildMonthCells(leftMonth), [leftMonth]);
  const rightCells = useMemo(() => buildMonthCells(rightMonth), [rightMonth]);

  const startObj = parseDateKey(draftStart);
  const endObj = parseDateKey(draftEnd);

  const activeConstraint = useMemo(() => {
    if (activeSide === 'start' && startObj) {
      return { min: startObj, max: addMonths(startObj, 1) };
    }
    if (activeSide === 'end' && endObj) {
      return { min: addMonths(endObj, -1), max: endObj };
    }
    return null;
  }, [activeSide, startObj, endObj]);

  const isAllowed = (dateKey: string, side: 'left' | 'right') => {
    const d = parseDateKey(dateKey);
    if (!d) return false;
    const t = d.getTime();
    if (activeConstraint) {
      return t >= activeConstraint.min.getTime() && t <= activeConstraint.max.getTime();
    }
    return true;
  };

  const pickStart = (picked: Date) => {
    setDraftStart(toDateKey(picked));
    setDraftEnd('');
    setActiveSide('start');
    setRightMonth(startOfMonth(addMonths(picked, 1)));
  };

  const pickEnd = (picked: Date) => {
    setDraftEnd(toDateKey(picked));
    setDraftStart('');
    setActiveSide('end');
    setLeftMonth(startOfMonth(addMonths(picked, -1)));
  };

  const handlePickDate = (dateKey: string, side: 'left' | 'right') => {
    const picked = parseDateKey(dateKey);
    if (!picked) return;
    const allowed = isAllowed(dateKey, side);

    if (side === 'left') {
      if (activeSide === 'end') {
        if (allowed) {
          setDraftStart(dateKey);
          return;
        }
        pickStart(picked);
        return;
      }
      if (activeSide === 'start') {
        if (allowed) {
          setDraftStart(dateKey);
          return;
        }
        pickStart(picked);
        return;
      }
      pickStart(picked);
      return;
    }

    if (activeSide === 'start') {
      if (allowed) {
        setDraftEnd(dateKey);
        return;
      }
      pickEnd(picked);
      return;
    }
    if (activeSide === 'end') {
      if (allowed) {
        setDraftEnd(dateKey);
        return;
      }
      pickEnd(picked);
      return;
    }
    pickEnd(picked);
  };

  const apply = () => {
    onApply(draftStart, draftEnd);
    setOpen(false);
  };

  const renderMonthPanel = (
    side: 'left' | 'right',
    month: Date,
    setMonth: (value: Date | ((prev: Date) => Date)) => void,
    cells: Array<{ value: string | null; day: number | null }>
  ) => (
    <div className="w-[250px]">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((prev) => addMonths(prev, -1))}
          className="h-7 w-7 rounded-full border border-gray-700 bg-gray-800/80 text-sm font-bold text-gray-200 hover:bg-gray-700"
          aria-label={`Previous month (${side})`}
        >
          {'<'}
        </button>
        <div className="text-xl font-black text-gray-100">{monthTitle(month)}</div>
        <button
          type="button"
          onClick={() => setMonth((prev) => addMonths(prev, 1))}
          className="h-7 w-7 rounded-full border border-gray-700 bg-gray-800/80 text-sm font-bold text-gray-200 hover:bg-gray-700"
          aria-label={`Next month (${side})`}
        >
          {'>'}
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-2 text-center text-[11px] font-bold text-gray-400">
        {DAY_NAMES.map((name) => (
          <div key={`${side}-${monthTitle(month)}-${name}`}>{name}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-y-2 text-center">
        {cells.map((cell, idx) => {
          if (!cell.value || !cell.day) {
            return <div key={`${side}-${monthTitle(month)}-empty-${idx}`} className="h-9" />;
          }

          const isStart = cell.value === draftStart;
          const isEnd = cell.value === draftEnd;
          const active = side === 'left' ? isStart : isEnd;
          const allowed = isAllowed(cell.value, side);

          return (
            <button
              key={`${side}-${cell.value}`}
              type="button"
              onClick={() => handlePickDate(cell.value as string, side)}
              className={`mx-auto h-9 w-9 rounded-full text-sm font-black transition-colors ${
                active
                  ? 'border-2 border-blue-400 bg-blue-500/20 text-blue-300'
                  : allowed
                  ? 'text-gray-100 hover:bg-gray-700/70'
                  : 'text-gray-500/60 hover:bg-gray-800/40'
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative pointer-events-auto" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="h-10 rounded-full border border-gray-700/70 bg-gray-900/90 px-4 text-xs font-black tracking-wide text-gray-100 shadow-xl backdrop-blur-md hover:bg-gray-800/90"
      >
        {(draftStart || '---- -- --')} ~ {(draftEnd || '---- -- --')}
      </button>

      {open && (
        <div
          className={`${inline ? 'relative mt-3' : 'absolute left-0 top-14 z-[80]'} rounded-2xl border border-gray-700 bg-gray-900/95 shadow-2xl backdrop-blur-md ${
            layout === 'vertical' ? 'w-[300px]' : 'w-[620px]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="text-xs font-black uppercase tracking-widest text-gray-300">Date Range</div>
            <div className="text-xs font-bold text-blue-300">
              {(draftStart || '---- -- --')} ~ {(draftEnd || '---- -- --')}
            </div>
          </div>

          <div
            className={`px-5 py-5 ${
              layout === 'vertical'
                ? 'flex flex-col items-center gap-6'
                : 'flex items-start justify-between'
            }`}
          >
            {renderMonthPanel('left', leftMonth, setLeftMonth, leftCells)}
            {renderMonthPanel('right', rightMonth, setRightMonth, rightCells)}
          </div>

          <div className="flex items-center justify-between border-t border-gray-800 px-5 py-4">
            <div className="text-xs font-bold text-gray-400">
              {activeConstraint
                ? `Selectable: ${toDateKey(activeConstraint.min)} ~ ${toDateKey(activeConstraint.max)}`
                : 'Start is fixed on left calendar, End is fixed on right calendar.'}
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={!draftStart || !draftEnd}
              className="rounded-xl border border-blue-400/60 bg-blue-500/20 px-5 py-2 text-sm font-black text-blue-100 hover:bg-blue-500/30"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
