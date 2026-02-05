'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RiskItem } from '@/types/dashboard';

type SerialListProps = {
  serials: string[];
  eventsBySerial: Record<string, RiskItem[]>;
  activeSerial: string | null;
  onSerialToggle: (serial: string) => void;
};

const PAGE_SIZE = 15;

const SerialList: React.FC<SerialListProps> = ({
  serials,
  eventsBySerial,
  activeSerial,
  onSerialToggle,
}) => {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<'ALL' | 'SAFE' | 'CAUTION' | 'DANGER'>('ALL');

  const totalPages = Math.max(1, Math.ceil(serials.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSerials = serials.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const [pageInput, setPageInput] = useState(String(safePage));

  useEffect(() => {
    setPage(1);
    setPageInput('1');
  }, [serials]);

  useEffect(() => {
    setPageInput(String(safePage));
  }, [safePage]);

  const jumpToPage = () => {
    const next = Number.parseInt(pageInput, 10);
    if (Number.isNaN(next)) return;
    const clamped = Math.min(Math.max(next, 1), totalPages);
    setPage(clamped);
  };

  const toDateText = (value: unknown) => {
    if (value == null) return '-';
    const ms = value instanceof Date ? value.getTime() : new Date(value as string | number).getTime();
    if (!Number.isFinite(ms)) return '-';
    return new Date(ms).toLocaleString();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">
          Serial List
        </h2>
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
          {(['ALL', 'SAFE', 'CAUTION', 'DANGER'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full transition-colors ${
                category === key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {pagedSerials.map((serial) => {
          const isOpen = activeSerial === serial;
          const items = (eventsBySerial[serial] || []).filter((event) => event != null);
          return (
            <div key={serial} className="border rounded-lg overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => onSerialToggle(serial)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left ${
                  isOpen ? 'bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <span className="text-[11px] font-bold text-gray-800">{serial}</span>
              </button>

              {isOpen && (
                <div className="p-2">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 text-[10px] font-semibold text-gray-600">
                      <tr>
                        <th className="p-2">Scan</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                      {items.map((event, index) => (
                        <tr
                          key={event.id ?? `${serial}-${event.eventTime ?? 'time'}-${index}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="p-2">{event.scanLocation ?? '-'}</td>
                          <td className="p-2">{event.eventType ?? '-'}</td>
                          <td className="p-2 font-mono text-[10px]">
                            {toDateText(event.eventTime)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {serials.length === 0 && (
          <div className="p-6 text-center text-xs text-gray-500">No serials found.</div>
        )}
      </div>

      {serials.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-3">
          <div className="text-[10px] text-gray-500">
            Page {safePage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              className="px-2 py-1 text-[10px] rounded bg-white border hover:bg-gray-100 disabled:opacity-50"
              disabled={safePage === 1}
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              className="px-2 py-1 text-[10px] rounded bg-white border hover:bg-gray-100 disabled:opacity-50"
              disabled={safePage === totalPages}
            >
              Next
            </button>
            <div className="flex items-center space-x-1">
              <input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') jumpToPage();
                }}
                className="w-10 px-1 py-1 text-[10px] rounded border border-gray-200 text-center bg-white"
              />
              <button
                onClick={jumpToPage}
                className="px-2 py-1 text-[10px] rounded bg-gray-900 text-white hover:bg-gray-800"
              >
                Go
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SerialList;
