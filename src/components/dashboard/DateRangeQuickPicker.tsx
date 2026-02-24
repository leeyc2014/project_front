'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type DateRangeQuickPickerProps = {
  startDate: string;
  endDate: string;
  onApply: (nextStart: string, nextEnd: string) => void;
  layout?: 'horizontal' | 'vertical';
  inline?: boolean;
};

// 'start' | 'end' | null 에서, 첫 번째 클릭인지 두 번째 클릭인지 상태를 관리하기 위해 단순화
type ActiveSide = 'start' | 'end' | null;

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateKey = (value: string | null) => {
  if (!value) return null;
  const [y, m, d] = value.split('-').map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, date.getDate());

const yearMonthTitle = (date: Date) => `${date.getFullYear() + 1}년 ${date.getMonth() + 1}월`;

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
  const [draftStart, setDraftStart] = useState<string | null>(initialStart);
  const [draftEnd, setDraftEnd] = useState<string | null>(initialEnd);
  
  // 해결 3: leftMonth, rightMonth를 통합하여 baseMonth (왼쪽 달력 기준) 하나만 관리
  const [baseMonth, setBaseMonth] = useState<Date>(
    startOfMonth(parseDateKey(initialStart) ?? new Date())
  );
  
  // 첫 번째 클릭인지(start), 두 번째 클릭인지(end) 추적. 
  // 양쪽 모두 채워져 있을 땐 null 상태로 두고, 다음 클릭 시 start를 갱신하게 함
  const [activeSide, setActiveSide] = useState<ActiveSide>(null);

  // 모달이 열릴 때/닫힐 때 외부 Props에 맞춰 초기화
  useEffect(() => {
    if (!open) {
      setDraftStart(startDate || '2024-07-25');
      setDraftEnd(endDate || '2024-07-31');
      setBaseMonth(startOfMonth(parseDateKey(startDate || '2024-07-25') ?? new Date()));
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

  // 베이스 달력(왼쪽)과 그 다음 달(오른쪽)의 데이터 생성 (항상 1개월 차이 유지)
  const leftCells = useMemo(() => buildMonthCells(baseMonth), [baseMonth]);
  const rightMonth = useMemo(() => addMonths(baseMonth, 1), [baseMonth]);
  const rightCells = useMemo(() => buildMonthCells(rightMonth), [rightMonth]);

  const startObj = parseDateKey(draftStart);
  const endObj = parseDateKey(draftEnd);

  // 1개월 이내 기간 제약 로직은 유지
  const activeConstraint = useMemo(() => {
    if (activeSide === 'start' && startObj) {
      // 시작일이 선택된 상태라면 최대 선택 가능한 날짜는 시작일 + 1개월
      return { min: startObj, max: addMonths(startObj, 1) };
    }
    return null;
  }, [activeSide, startObj]);

  const isAllowed = (dateKey: string) => {
    const d = parseDateKey(dateKey);
    if (!d) return false;
    const t = d.getTime();

    // 시작일이 찍혀있는 상태에서 종료일을 선택할 때 1개월 제한 적용
    if (activeConstraint) {
      return t >= activeConstraint.min.getTime() && t <= activeConstraint.max.getTime();
    }
    return true;
  };

  // 해결 1 & 2: 좌/우 화면 구분 없이 단일 타임라인으로 날짜 처리
  const handlePickDate = (dateKey: string) => {
    const pickedDate = parseDateKey(dateKey);
    if (!pickedDate) return;

    // 케이스 1: 아무것도 선택 안 된 상태이거나, 이미 양쪽 다 선택된 상태에서 새로 클릭한 경우
    if (activeSide === null || (draftStart && draftEnd && activeSide !== 'start')) {
      setDraftStart(dateKey);
      setDraftEnd(null); // 새로운 시작이므로 끝을 비움
      setActiveSide('start'); // 이제 종료일을 기다림
      return;
    }

    // 케이스 2: 시작일만 선택된 상태에서 종료일을 클릭한 경우 (activeSide === 'start')
    if (activeSide === 'start' && startObj) {
      // 제약조건(1개월 이내)에 맞지 않으면 무시하거나, 혹은 그 날짜를 새로운 시작일로 덮어씌울 수 있음. 
      // 여기서는 클릭한 날짜가 시작일보다 과거면, 클릭한 날짜를 새로운 시작일로 변경.
      if (pickedDate.getTime() < startObj.getTime()) {
        setDraftStart(dateKey);
        // 여전히 종료일을 기다리는 상태
        return;
      }
      
      // 클릭한 날짜가 시작일 이후이고, 1개월 이내인지 체크
      if (isAllowed(dateKey)) {
        setDraftEnd(dateKey);
        setActiveSide(null); // 선택 완료
      }
    }
  };

  const apply = () => {
    if (draftStart && draftEnd) {
      onApply(draftStart, draftEnd);
      setOpen(false);
    }
  };

  const renderMonthPanel = (
    month: Date,
    cells: Array<{ value: string | null; day: number | null }>
  ) => (
    <div className="w-64 p-2">
      <div className="flex items-center justify-between mb-4">
        {/* 달력 이동 버튼 클릭 시 baseMonth 하나만 변경하여 전체 화면이 같이 움직이게 함 */}
        <button
          onClick={() => setBaseMonth((prev) => addMonths(prev, -1))}
          className="h-7 w-7 rounded-full border border-gray-700 bg-gray-800/80 text-sm font-bold text-gray-200 hover:bg-gray-700"
          aria-label={`Previous month`}
        >
          {'<'}
        </button>
        <div className="text-sm font-bold text-gray-200">{yearMonthTitle(month)}</div>
        <button
          onClick={() => setBaseMonth((prev) => addMonths(prev, 1))}
          className="h-7 w-7 rounded-full border border-gray-700 bg-gray-800/80 text-sm font-bold text-gray-200 hover:bg-gray-700"
          aria-label={`Next month`}
        >
          {'>'}
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-xs text-gray-400 font-medium">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell.value || !cell.day) {
            return <div key={`empty-${idx}`} className="h-9 w-9" />;
          }

          const isStart = cell.value === draftStart;
          const isEnd = cell.value === draftEnd;
          
          // 시작과 끝 사이의 기간 표시 (UI 개선 옵션)
          const isBetween = draftStart && draftEnd && 
                            cell.value > draftStart && 
                            cell.value < draftEnd;

          const active = isStart || isEnd;
          const allowed = isAllowed(cell.value);

          return (
            <button
              key={cell.value}
              onClick={() => handlePickDate(cell.value as string)}
              className={`mx-auto h-9 w-9 rounded-full text-sm font-black transition-colors ${
                active
                  ? 'border-2 border-blue-400 bg-blue-500/20 text-blue-300'
                  : isBetween
                  ? 'bg-blue-900/30 text-blue-200'
                  : allowed
                  ? 'text-gray-100 hover:bg-gray-700/70'
                  : 'text-gray-500/60 hover:bg-gray-800/40 cursor-not-allowed'
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
    <div ref={rootRef} className={`relative ${inline ? '' : 'inline-block'}`}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="h-10 rounded-full border border-gray-700/70 bg-gray-900/90 px-4 text-xs font-black tracking-wide text-gray-100 shadow-xl backdrop-blur-md hover:bg-gray-800/90"
      >
        {(draftStart || '---- -- --')} ~ {(draftEnd || '---- -- --')}
      </button>

      {open && (
        <div className="relative mt-3 z-50 rounded-2xl border border-gray-700/50 bg-gray-900/95 p-4 shadow-2xl backdrop-blur-xl flex flex-col gap-4">
          <div className="text-sm font-bold text-gray-300 border-b border-gray-700 pb-2">
            Date Range: {(draftStart || '---- -- --')} ~ {(draftEnd || '---- -- --')}
          </div>

          <div className={`flex ${layout === 'vertical' ? 'flex-col' : 'flex-row'} gap-4`}>
            {/* 좌/우 구분 없이 동일한 렌더링 함수 사용. 상태는 baseMonth와 그 다음 달 */}
            {renderMonthPanel(baseMonth, leftCells)}
            <div className="w-px bg-gray-700/50 hidden md:block"></div>
            {renderMonthPanel(rightMonth, rightCells)}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
            <div className="text-xs text-gray-400">
              {activeConstraint
                ? `최대 선택 가능 범위: ${toDateKey(activeConstraint.min)} ~ ${toDateKey(activeConstraint.max)}`
                : '시작일을 먼저 선택해주세요.'}
            </div>
            <button
              onClick={apply}
              disabled={!draftStart || !draftEnd}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
