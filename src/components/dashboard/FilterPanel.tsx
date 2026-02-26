"use client";

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_FILTERS, FilterState } from '@/types/dashboard';
import DateRangeQuickPicker from '@/components/dashboard/DateRangeQuickPicker';

export default function FilterPanel({ isOpen, onClose, filters, setFilters, filterOptions }: any) {
  const [draft, setDraft] = useState<FilterState>(filters as FilterState);
  const [panelPhase, setPanelPhase] = useState<'shown' | 'hidden' | 'enter' | 'leave'>(isOpen ? 'shown' : 'hidden');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) setDraft(filters as FilterState);
  }, [isOpen, filters]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isOpen) {
      setPanelPhase('enter');
      timerRef.current = setTimeout(() => setPanelPhase('shown'), 300);
    } else {
      setPanelPhase('leave');
      timerRef.current = setTimeout(() => setPanelPhase('hidden'), 300);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  const setVal = (k: keyof FilterState, v: any) => setDraft((p: any) => ({ ...p, [k]: v }));
  const toggle = (k: keyof FilterState, v: string) => {
    const curr = (draft[k] as string[]) || [];
    setVal(k, curr.includes(v) ? curr.filter(x => x !== v) : [...curr, v]);
  };
  const removeValue = (k: keyof FilterState, v: string) => {
    const curr = (draft[k] as string[]) || [];
    setVal(k, curr.filter(x => x !== v));
  };

  const resolveLabel = (list: { key: string; value: string }[] | undefined, key: string) => {
    const hit = list?.find((item) => item.key === key);
    return hit?.value || key;
  };
  const selectedChips = [
    ...((draft.factoryLocationTypes || []).map((v) => ({
      key: 'factoryLocationTypes',
      label: `Location: ${resolveLabel(filterOptions?.factoryLocationTypes, v)}`,
      value: v,
    }))),
    ...((draft.warehouseLocationTypes || []).map((v) => ({
      key: 'warehouseLocationTypes',
      label: `Location: ${resolveLabel(filterOptions?.warehouseLocationTypes, v)}`,
      value: v,
    }))),
    ...((draft.logisticCenterLocationTypes || []).map((v) => ({
      key: 'logisticCenterLocationTypes',
      label: `Location: ${resolveLabel(filterOptions?.logisticCenterLocationTypes, v)}`,
      value: v,
    }))),
    ...((draft.salerLocationTypes || []).map((v) => ({
      key: 'salerLocationTypes',
      label: `Location: ${resolveLabel(filterOptions?.salerLocationTypes, v)}`,
      value: v,
    }))),
    ...((draft.retailerLocationTypes || []).map((v) => ({
      key: 'retailerLocationTypes',
      label: `Location: ${resolveLabel(filterOptions?.retailerLocationTypes, v)}`,
      value: v,
    }))),
    ...((draft.operatorIds || []).map((v) => ({ key: 'operatorIds', label: `Operator ID: ${resolveLabel(filterOptions?.operatorIds, v)}`, value: v }))),
    ...((draft.deviceIds || []).map((v) => ({ key: 'deviceIds', label: `Device ID: ${resolveLabel(filterOptions?.deviceIds, v)}`, value: v }))),
    ...((draft.epcCompanies || []).map((v) => ({ key: 'epcCompanies', label: `EPC Company: ${resolveLabel(filterOptions?.epcCompanies, v)}`, value: v }))),
    ...((draft.epcProducts || []).map((v) => ({ key: 'epcProducts', label: `EPC Product: ${resolveLabel(filterOptions?.epcProducts, v)}`, value: v }))),
    ...(draft.epcCode ? [{ key: 'epcCode', label: `EPC Code: ${draft.epcCode}`, value: draft.epcCode }] : []),
    ...(draft.epcLot != null ? [{ key: 'epcLot', label: `EPC Lot: ${draft.epcLot}`, value: String(draft.epcLot) }] : []),
    ...(draft.epcSerial != null ? [{ key: 'epcSerial', label: `EPC Serial: ${draft.epcSerial}`, value: String(draft.epcSerial) }] : []),
    ...(draft.eventTimeStart ? [{ key: 'eventTimeStart', label: `EventTimeStart: ${draft.eventTimeStart}`, value: draft.eventTimeStart }] : []),
    ...(draft.eventTimeEnd ? [{ key: 'eventTimeEnd', label: `EventTimeEnd: ${draft.eventTimeEnd}`, value: draft.eventTimeEnd }] : []),
    ...(draft.manufactureDate ? [{ key: 'manufactureDate', label: `Manufacture Date: ${draft.manufactureDate}`, value: draft.manufactureDate }] : []),
    ...(draft.expiryDate ? [{ key: 'expiryDate', label: `Expiry Date: ${draft.expiryDate}`, value: draft.expiryDate }] : []),
  ] as { key: keyof FilterState; label: string; value: string }[];

  if (panelPhase === 'hidden') return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          panelPhase === 'leave' ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 left-0 z-[70] w-96 bg-gray-900 shadow-2xl flex flex-col ${
          panelPhase === 'enter'
            ? 'filter-enter'
            : panelPhase === 'leave'
            ? 'filter-leave'
            : 'filter-shown'
        }`}
      >
        <div className="p-6 bg-gray-950 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-white tracking-tighter">FILTER OPTIONS</h2>
            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...DEFAULT_FILTERS,
                  eventTimeStart: '2024-07-25',
                  eventTimeEnd: '2024-07-31',
                })
              }
              className="px-3 py-1.5 text-[11px] font-bold rounded-full border border-gray-800 bg-gray-950 text-white hover:text-white hover:border-gray-500"
            >
              Reset
            </button>
            <button onClick={onClose} className="p-2 text-white hover:bg-gray-800 rounded-full">×</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedChips.length === 0 ? (
              <span className="text-[16.5px] text-white">No filters selected.</span>
            ) : (
              selectedChips.map((chip) => (
                <button
                  key={`${chip.key}-${chip.value}`}
                  type="button"
                  onClick={() => {
                    if (Array.isArray(draft[chip.key])) {
                      removeValue(chip.key, chip.value);
                    } else {
                      const resetValue = chip.key === 'epcLot' || chip.key === 'epcSerial' ? null : '';
                      setVal(chip.key, resetValue);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-gray-800 text-white border border-gray-800"
                >
                  <span>{chip.label}</span>
                  <span className="ml-1 text-white">×</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <FilterDetail
            title="Date Filters"
            options={[]}
            selected={[draft.eventTimeStart, draft.eventTimeEnd, draft.manufactureDate, draft.expiryDate].filter(Boolean)}
            onToggle={() => {}}
          >
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-[10px] font-black text-white uppercase mb-2">Event Period</label>
                <DateRangeQuickPicker
                  startDate={draft.eventTimeStart}
                  endDate={draft.eventTimeEnd}
                  layout="vertical"
                  inline
                  dropdownPosition="relative"
                  onApply={(nextStart, nextEnd) => {
                    setVal('eventTimeStart', nextStart);
                    setVal('eventTimeEnd', nextEnd);
                  }}
                />
              </div>
              <DateInput label="Manufacture Date" val={draft.manufactureDate} onChange={(v:string) => setVal('manufactureDate', v)} />
              <DateInput label="Expiry Date" val={draft.expiryDate} onChange={(v:string) => setVal('expiryDate', v)} />
            </div>
          </FilterDetail>
          <FilterDetail 
            title="LOCATION: 공장" 
            options={filterOptions?.factoryLocationTypes || []} 
            selected={draft.factoryLocationTypes || []} 
            onToggle={(v:string) => toggle('factoryLocationTypes', v)} 
          />
          <FilterDetail 
            title="LOCATION: 공장창고" 
            options={filterOptions?.warehouseLocationTypes || []} 
            selected={draft.warehouseLocationTypes || []} 
            onToggle={(v:string) => toggle('warehouseLocationTypes', v)} 
          />
          <FilterDetail 
            title="LOCATION: 물류센터" 
            options={filterOptions?.logisticCenterLocationTypes || []} 
            selected={draft.logisticCenterLocationTypes || []} 
            onToggle={(v:string) => toggle('logisticCenterLocationTypes', v)} 
          />
          <FilterDetail 
            title="LOCATION: 도매" 
            options={filterOptions?.salerLocationTypes || []} 
            selected={draft.salerLocationTypes || []} 
            onToggle={(v:string) => toggle('salerLocationTypes', v)} 
          />
          <FilterDetail 
            title="LOCATION: 소매" 
            options={filterOptions?.retailerLocationTypes || []} 
            selected={draft.retailerLocationTypes || []} 
            onToggle={(v:string) => toggle('retailerLocationTypes', v)} 
          />
          <FilterDetail 
            title="EPC Product" 
            options={filterOptions?.epcProducts || []} 
            selected={draft.epcProducts || []} 
            onToggle={(v:string) => toggle('epcProducts', v)} 
          />
          <FilterDetail 
            title="EPC Company" 
            options={filterOptions?.epcCompanies || []} 
            selected={draft.epcCompanies || []} 
            onToggle={(v:string) => toggle('epcCompanies', v)} 
          />
          <FilterDetail 
            title="Operator ID" 
            options={filterOptions?.operatorIds || []} 
            selected={draft.operatorIds || []} 
            onToggle={(v:string) => toggle('operatorIds', v)} 
          />
          <FilterDetail 
            title="Device ID" 
            options={filterOptions?.deviceIds || []} 
            selected={draft.deviceIds || []} 
            onToggle={(v:string) => toggle('deviceIds', v)} 
          />
          <FilterDetail
            title="EPC Search"
            options={[]}
            selected={[draft.epcCode, draft.epcLot, draft.epcSerial]
              .filter((v) => v !== '' && v != null)
              .map(String)}
            onToggle={() => {}}
          >
            <div className="space-y-4">
              <SearchInput label="EPC Code" val={draft.epcCode} onChange={(v:string) => setVal('epcCode', v)} />
              <SearchInput label="EPC Lot" type="number" val={draft.epcLot} onChange={(v:string) => setVal('epcLot', v === '' ? null : Number(v))} />
              <SearchInput label="EPC Serial" type="number" val={draft.epcSerial} onChange={(v:string) => setVal('epcSerial', v === '' ? null : Number(v))} />
            </div>
          </FilterDetail>
        </div>

        <div className="p-4 bg-gray-950 border-t">
          <button
            onClick={() => {
              setFilters(draft);
              onClose();
            }}
            className="w-full py-4 bg-gray-800 text-white rounded-2xl font-black hover:bg-gray-700 cursor-pointer transition-all"
          >
            SEARCH
          </button>
        </div>
      </div>
    </>
  );
}

// 서브 컴포넌트 (생략 가능: 이전 구현과 동일)
function SearchInput({ label, val, onChange, type = 'text' }: any) {
  return (
    <div>
      <label className="block text-[10px] font-black text-white uppercase mb-1">{label}</label>
      <input type={type} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-sm text-white" value={val ?? ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function FilterDetail({ title, options, selected, onToggle, children }: any) {
  return (
    <details className="group bg-gray-950 rounded-2xl border border-gray-800 shadow-sm overflow-hidden">
      <summary className="cursor-pointer p-4 text-[11px] font-black text-white uppercase flex justify-between items-center list-none">
        {title} <span className="text-blue-500 font-bold">{selected?.length || 0}</span>
      </summary>
      <div className={`px-4 pb-4 ${children ? '' : 'flex flex-wrap gap-2'}`}>
        {children || options?.map((opt: { key: string; value: string }) => (
          <button key={opt.key} onClick={() => onToggle(opt.key)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${selected?.includes(opt.key) ? 'bg-white text-gray-800 border-white' : 'bg-gray-950 text-white border-gray-800 hover:border-gray-500'}`}>
            {opt.value}
          </button>
        ))}
      </div>
    </details>
  );
}

function DateInput({ label, val, onChange }: any) {
  return (
    <div>
      <label className="block text-[10px] font-black text-white uppercase mb-1">{label}</label>
      <input type="date" className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-xs font-bold text-white" value={val || ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

