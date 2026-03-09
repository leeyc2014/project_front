'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { convertMessage } from '@/utils/aiMessageUtil';
import { useAtom } from 'jotai';
import { User } from '@/types/user';
import { loginUserAtom } from '@/atoms/atom';
import { EVENT_TYPE_LABELS } from '@/constants/eventType';
import { getAuthToken } from '@/utils/authToken';
import type { InspectionFormProps, ReportAnomalyByLocation, SerialListProps } from '@/types/serialList';
import { getBackendUrl } from '@/utils/apiUtil';

function formatTimestamp6(date: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

const InspectionForm: React.FC<InspectionFormProps> = ({
  isOpen,
  serialNumber,
  anomalyByLocation,
  onClose,
}) => {
  const locationOptions = useMemo(
    () =>
      anomalyByLocation.length > 0
        ? anomalyByLocation
        : [{ location: '-', messages: [{ text: '-', severity: 'NONE' as const, logisMoveId: null }] }],
    [anomalyByLocation]
  );
  const [selectedLocation, setSelectedLocation] = useState(locationOptions[0].location);
  const selectedLocationItem =
    locationOptions.find((item) => item.location === selectedLocation) ?? locationOptions[0];
  const messageOptions = selectedLocationItem.messages.length > 0 ? selectedLocationItem.messages : [{ text: '-', severity: 'NONE' as const, logisMoveId: null }];
  const [selectedMessage, setSelectedMessage] = useState(messageOptions[0].text);
  const [detailMessage, setDetailMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const nextLocation = locationOptions[0].location;
    setSelectedLocation(nextLocation);
  }, [isOpen, locationOptions]); // reopen 시 초기화

  useEffect(() => {
    const nextMessage =
      (locationOptions.find((item) => item.location === selectedLocation)?.messages || [])[0]?.text ?? '-';
    setSelectedMessage(nextMessage);
  }, [selectedLocation, locationOptions]); // 위치 변경 시 문구 초기화

  const selectedMessageObj =
    messageOptions.find((message) => message.text === selectedMessage) ?? messageOptions[0];
  const locationBgClass =
    selectedMessageObj.severity === 'DANGER'
      ? 'border-red-700 bg-red-900/40 text-red-100'
      : selectedMessageObj.severity === 'CAUTION'
        ? 'border-yellow-700 bg-yellow-900/35 text-yellow-100'
        : 'border-gray-700 bg-gray-800 text-white';
  const initialDetailMessage = `${selectedMessageObj.text || '-'}\n`;

  useEffect(() => {
    setDetailMessage(initialDetailMessage);
  }, [initialDetailMessage]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (selectedMessageObj.logisMoveId == null) {
      alert('보고 대상 이벤트를 찾을 수 없습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const backendBaseUrl = getBackendUrl() || '';
      const token = getAuthToken();
      const payload = {
        logisMoveId: selectedMessageObj.logisMoveId,
        detail: detailMessage.replace(/\r?\n$/, '') || (convertMessage(selectedMessageObj.text) || selectedMessageObj.text),
        result: '',
        completed: false,
        reportDate: formatTimestamp6(new Date()),
      };
      console.info('anomaly report create payload:', payload);
      const res = await fetch(`${backendBaseUrl}/api/v1/anomaly-reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}${errorText ? ` - ${errorText}` : ''} (logisMoveId=${selectedMessageObj.logisMoveId})`);
      }
      alert('보고서가 정상적으로 제출되었습니다.');
      onClose();
    } catch (error) {
      console.error('anomaly report post failed:', error);
      const message = error instanceof Error ? error.message : 'unknown error';
      alert(`보고서 제출에 실패했습니다.\n${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h2 className="text-lg font-black text-white">이상 징후 발견 보고서</h2>
          <button onClick={onClose} className="text-white hover:text-gray-300 text-2xl leading-none" aria-label="닫기">
            ×
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-bold text-white">1. EPC Code</label>
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-white">
              {serialNumber}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-white">2. 이상 발생 위치</label>
            {locationOptions.length > 1 ? (
              <select
                className={`w-full rounded-lg px-3 py-2 text-sm ${locationBgClass}`}
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                {locationOptions.map((item, index) => (
                  <option key={`${item.location}-${index}`} value={item.location} className="bg-gray-900 text-white">
                    {item.location}
                  </option>
                ))}
              </select>
            ) : (
              <div className={`rounded-lg px-3 py-2 text-sm ${locationBgClass}`}>
                {selectedLocationItem.location}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-white">3. 이상 분류</label>
            {messageOptions.length > 1 ? (
              <select
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                value={selectedMessage}
                onChange={(e) => setSelectedMessage(e.target.value)}
              >
                {messageOptions.map((message, index) => (
                  <option key={`${index}`} value={message.text} className="bg-gray-900 text-white">
                    {convertMessage(message.text)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white">
                {convertMessage(messageOptions[0].text)}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-white">4. 상세 오류 내용 (입력)</label>
            <textarea
              placeholder="공장 정보, 발생 시점 및 구체적인 상황을 입력하세요."
              className="min-h-24 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-400"
              value={detailMessage}
              onChange={(e) => setDetailMessage(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-800 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '제출 중...' : '조치 요청 제출'}
          </button>
        </div>
      </div>
    </div>
  );
};


const SerialList: React.FC<SerialListProps> = ({
  serials,
  eventsBySerial,
  activeSerial,
  onSerialToggle,
  statusFilter,
  onStatusChange,
  page,
  totalPages,
  totalElements = 0,
  onPageChange,
}) => {
  const [loginUser] = useAtom<User | null>(loginUserAtom);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    serial: string;
    anomalyByLocation: ReportAnomalyByLocation;
  } | null>(null);
  const safePage = Math.min(Math.max(page + 1, 1), Math.max(1, totalPages));
  const [pageInput, setPageInput] = useState(String(safePage));
  const pagedSerials = serials;
  const isListVisible = serials.length > 0

  useEffect(() => {
    setPageInput(String(safePage));
  }, [serials, safePage]);

  const jumpToPage = () => {
    const next = Number.parseInt(pageInput, 10);
    if (Number.isNaN(next)) return;
    const clamped = Math.min(Math.max(next, 1), Math.max(1, totalPages));
    onPageChange(clamped - 1);
  };

  const toDateText = (value: unknown) => {
    if (value == null) return '-';

    const date = value instanceof Date ? value : new Date(value as string | number);
    const ms = date.getTime();

    // 유효하지 않은 날짜 체크
    if (!Number.isFinite(ms)) return '-';

    const pad = (n: number) => n.toString().padStart(2, '0');

    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const HH = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());

    return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-widest">
          Total: {totalElements}
        </h2>
        <div className="flex items-center gap-1 bg-gray-800 rounded-full p-0.5">
          {(['ALL', 'SAFE', 'CAUTION', 'DANGER'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onStatusChange(key)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full transition-colors ${statusFilter === key
                  ? 'bg-white text-gray-600'
                  : 'text-white hover:text-gray-400'
                }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      {isListVisible ? (
        <div className="flex-1 overflow-y-auto space-y-2">
          {pagedSerials.map((serial) => {
            const isOpen = activeSerial === serial;
            const items = (eventsBySerial[serial] || []).filter((event) => event != null);
            const first = items[0];
            const productName = first?.productName || first?.epcProduct || '-';
            const lot = first?.epcLot ?? '-';
            const epcSerial = first?.epcSerial ?? '-';
            const label = `${productName}(LOT: ${lot}, SERIAL: ${epcSerial})`;
            const hasDanger = items.some(
              (event) => event?.status === 'DANGER' || Boolean((event?.ruleCheck || '').trim())
            );
            const hasCaution = items.some(
              (event) => event?.status === 'CAUTION' || Boolean((event?.aiCheck || '').trim())
            );
            const statusLabel = hasDanger ? 'DANGER' : hasCaution ? 'CAUTION' : 'SAFE';
            const statusClass =
              statusLabel === 'DANGER'
                ? 'text-red-300'
                : statusLabel === 'CAUTION'
                  ? 'text-yellow-300'
                  : 'text-green-300';
            return (
              <div key={serial} className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900/80">
                <button
                  type="button"
                  onClick={() => onSerialToggle(serial)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left ${isOpen ? 'bg-gray-800/70' : 'bg-transparent hover:bg-gray-800/60'
                    }`}
                >
                  <span className="text-[12px] font-bold text-white">{label}</span>
                  <span className={`text-[10px] font-black tracking-widest ${statusClass}`}>
                    {statusLabel}
                  </span>
                </button>

                {isOpen && (
                  <div className="p-2">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-800 text-[10px] font-semibold text-white">
                        <tr>
                          <th className="p-2">Scan</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 text-xs text-white">
                        {items.map((event, index) => {
                          const hasRule = Boolean((event.ruleCheck || '').trim());
                          const hasAi = Boolean((event.aiCheck || '').trim());
                          const rowClass = hasRule
                            ? 'bg-red-900/90 hover:bg-red-900/100'
                            : hasAi
                              ? 'bg-yellow-900/90 hover:bg-yellow-900/100'
                              : 'hover:bg-gray-800/60';

                          return (
                            <tr
                              key={event.id ?? `${serial}-${event.eventTime ?? 'time'}-${index}`}
                              className={rowClass}
                              title={hasRule ? convertMessage(event.ruleCheck!) : hasAi ? convertMessage(event.aiCheck!) : ''}
                            >
                              <td className="p-2"><sup className="font-bold">{hasRule ? '위험' : hasAi ? '주의' : ''}</sup> {event.scanLocation ?? '-'}</td>
                              <td className="p-2">
                                {event.eventType ? (EVENT_TYPE_LABELS[event.eventType] || event.eventType) : '-'}
                              </td>
                              <td className="p-2 font-mono text-[10px] text-white">
                                {toDateText(event.eventTime)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {(statusLabel === 'CAUTION' || statusLabel === 'DANGER') && loginUser?.role === 'ADMIN' && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const toLogisMoveId = (value: unknown): number | null => {
                              const parsed = Number(value);
                              return Number.isFinite(parsed) ? parsed : null;
                            };
                            const locationMap = new Map<string, Map<string, { severity: 'DANGER' | 'CAUTION'; logisMoveId: number | null }>>();
                            items.forEach((event) => {
                              const location = (event.scanLocation || '-').trim() || '-';
                              const rule = (event.ruleCheck || '').trim();
                              const ai = (event.aiCheck || '').trim();
                              const logisMoveId = toLogisMoveId(event.logisMoveId ?? event.id);
                              if (!rule && !ai) return;
                              if (!locationMap.has(location)) locationMap.set(location, new Map<string, { severity: 'DANGER' | 'CAUTION'; logisMoveId: number | null }>());
                              if (rule) locationMap.get(location)!.set(rule, { severity: 'DANGER', logisMoveId });
                              if (ai && !locationMap.get(location)!.has(ai)) locationMap.get(location)!.set(ai, { severity: 'CAUTION', logisMoveId });
                            });
                            const anomalyByLocation: ReportAnomalyByLocation = Array.from(locationMap.entries()).map(([location, messageMap]) => ({
                              location,
                              messages: Array.from(messageMap.entries()).map(([text, meta]) => ({
                                text,
                                severity: meta.severity,
                                logisMoveId: meta.logisMoveId,
                              })),
                            }));
                            if (anomalyByLocation.length === 0) {
                              const fallbackLocation = (first?.scanLocation || '-').trim() || '-';
                              anomalyByLocation.push({ location: fallbackLocation, messages: [{ text: '-', severity: 'NONE', logisMoveId: toLogisMoveId(first?.logisMoveId ?? first?.id) }] });
                            }
                            setReportTarget({
                              serial,
                              anomalyByLocation,
                            });
                            setIsReportOpen(true);
                          }}
                          className="rounded-lg border border-red-500 bg-red-600/20 px-3 py-1.5 text-[11px] font-bold text-red-200 hover:bg-red-600/35"
                        >
                          조치 요청 등록
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-white">Serial list hidden.</div>
      )}

      {isListVisible && totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <div className="text-[10px] text-white">
            Page {safePage} of {Math.max(1, totalPages)}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(Math.max(0, safePage - 2))}
              className="px-2 py-1 text-[10px] rounded bg-gray-900 border border-gray-800 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
              disabled={safePage === 1}
            >
              Prev
            </button>
            <button
              onClick={() => onPageChange(Math.min(Math.max(1, totalPages) - 1, safePage))}
              className="px-2 py-1 text-[10px] rounded bg-gray-900 border border-gray-800 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
              disabled={safePage === Math.max(1, totalPages)}
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
                className="w-10 px-1 py-1 text-[10px] rounded border border-gray-800 text-center bg-gray-900 text-white"
              />
              <button
                onClick={jumpToPage}
                className="px-2 py-1 text-[10px] rounded bg-gray-800 text-white hover:bg-gray-600"
              >
                Go
              </button>
            </div>
          </div>
        </div>
      )}
      <InspectionForm
        isOpen={isReportOpen}
        serialNumber={reportTarget?.serial || ''}
        anomalyByLocation={reportTarget?.anomalyByLocation || []}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  );
};

export default SerialList;

