"use client";

import { useEffect, useRef, useState } from "react";
import type { CompleteSummary, LogisticsData, LogEntry } from "@/types/headerUploadWidget";
import { useRouter, useSearchParams } from "next/navigation";
import { useAtom } from "jotai";
import { FaCloudUploadAlt } from "react-icons/fa";
import { dashboardReloadTriggerAtom } from "@/atoms/atom";

const DEFAULT_FILE_LABEL = "No file selected";

const toFiniteNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readCompleteSummary = (payload: unknown): CompleteSummary | null => {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const hasSummaryKey =
    "totalProcessed" in obj ||
    "safeCount" in obj ||
    "errorCount" in obj ||
    "cautionCount" in obj ||

    "locationErrorCount" in obj ||
    "timeErrorCount" in obj ||

    "clonedCount" in obj ||
    "redundantCount" in obj ||
    "unregisteredCount" in obj ||
    "integrityErrorCount" in obj;
  if (!hasSummaryKey) return null;

  return {
    totalProcessed: toFiniteNumber(obj.totalProcessed),
    safeCount: toFiniteNumber(obj.safeCount),
    errorCount: toFiniteNumber(obj.errorCount),
    cautionCount: toFiniteNumber(obj.cautionCount),

    locationErrorCount: toFiniteNumber(obj.locationErrorCount),
    timeErrorCount: toFiniteNumber(obj.timeErrorCount),

    clonedCount: toFiniteNumber(obj.clonedCount),
    redundantCount: toFiniteNumber(obj.redundantCount),
    unregisteredCount: toFiniteNumber(obj.unregisteredCount),
    integrityErrorCount: toFiniteNumber(obj.integrityErrorCount),
  };
};

export default function HeaderUploadWidget() {
  const router = useRouter();

  const [dashboardReloadTrigger, setDashboardReloadTrigger] = useAtom<number>(dashboardReloadTriggerAtom);

  const [isVisible, setVisible] = useState<boolean>(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [percent, setPercent] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [isLogDetailVisible, setLogDetailVisible] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string>(DEFAULT_FILE_LABEL);
  const [resultSummary, setResultSummary] = useState<CompleteSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);
  const interruptionNotifiedRef = useRef(false);
  const completeAlertedRef = useRef(false);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    if (!isLogModalOpen || !logEndRef.current) return;
    logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [isLogModalOpen, logs]);

  useEffect(() => {
    return () => {
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort();
      }
      if (isProcessingRef.current && !interruptionNotifiedRef.current) {
        interruptionNotifiedRef.current = true;
        alert("분석이 중단되었습니다.");
      }
    };
  }, []);

  const getToken = () => {
    if (typeof window === "undefined") return "";
    const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return sessionStorage.getItem("token") || "";
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    setLogs((prev) => [...prev, { time, message: msg }]);
  };

  const handleCompleteAlert = (summary: CompleteSummary) => {
    if (completeAlertedRef.current) return;
    completeAlertedRef.current = true;

    setResultSummary(summary);
    setIsLogModalOpen(true);
    setLogDetailVisible(false);

    const errorCount = toFiniteNumber(summary.errorCount);
    const cautionCount = toFiniteNumber(summary.cautionCount);

    // 이 2개는 errorCount에 포함됨
    const locationErrorCount = toFiniteNumber(summary.locationErrorCount);
    const timeErrorCount = toFiniteNumber(summary.timeErrorCount);

    const clonedCount = toFiniteNumber(summary.clonedCount);
    const redundantCount = toFiniteNumber(summary.redundantCount);
    const unregisteredCount = toFiniteNumber(summary.unregisteredCount);
    const integrityErrorCount = toFiniteNumber(summary.integrityErrorCount);

    const totalIssueCount = errorCount + cautionCount + clonedCount + redundantCount + unregisteredCount + integrityErrorCount;
    return totalIssueCount > 0;
  };

  // 모달 닫기 시 대시보드 리로드 처리
  const handleCloseModal = () => {
    setIsLogModalOpen(false);

    // resultSummary가 존재한다면(분석이 완료된 상태라면) 모달이 닫힐 때 대시보드를 갱신
    if (resultSummary) {
      setDashboardReloadTrigger(prev => prev + 1);
    }
  };

  const processLine = (jsonString: string) => {
    const trimmed = jsonString.trim();
    if (!trimmed) return;

    const parsed = tryParseJson(trimmed);
    if (!parsed || typeof parsed !== "object") {
      addLog(trimmed);
      return;
    }

    const data = parsed as LogisticsData;
    if (typeof data.percent === "number") {
      setPercent(data.percent);
    }

    const summaryFromRoot = readCompleteSummary(data);
    const summaryFromMessage =
      typeof data.message === "string"
        ? readCompleteSummary(tryParseJson(data.message))
        : readCompleteSummary(data.message);
    const summary = summaryFromRoot || summaryFromMessage;

    if (data.event === "complete" && summary) {
      addLog(JSON.stringify(summary));

      // TODO. Alert이 아니라 디자인된 dialog 표시
      const isError = handleCompleteAlert(summary);

      if (isError) {
        setDashboardReloadTrigger(prev => prev + 1);
      }
    }

    if (typeof data.message === "string" && data.message.trim().length > 0) {
      addLog(data.message);
    } else if (!summary) {
      addLog(trimmed);
    }

    return data.event === "error";
  };

  const handleUpload = async () => {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      alert("파일을 선택해주세요.");
      return;
    }

    setLogs([]);
    setPercent(0);
    setResultSummary(null);
    setIsProcessing(true);
    interruptionNotifiedRef.current = false;
    completeAlertedRef.current = false;

    const token = getToken();
    if (!token) {
      alert("로그인 토큰이 없습니다. 다시 로그인 해주세요.");
      setIsProcessing(false);
      return;
    }

    const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "";
    if (!backendBaseUrl) {
      alert("백엔드 URL이 설정되지 않았습니다.");
      setIsProcessing(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", files[0]);

    try {
      const controller = new AbortController();
      uploadAbortControllerRef.current = controller;
      const res = await fetch(`${backendBaseUrl}/api/v1/logistics/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      if (!res.body) throw new Error("ReadableStream을 지원하지 않는 응답입니다.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let isError = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            if (processLine(buffer)) {
              isError = true;
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (processLine(line)) {
            isError = true;
          }
        }
      }

      if (!isError) {
        addLog("✅ 모든 작업이 완료되었습니다.");
      }

      setPercent(100);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        if (!interruptionNotifiedRef.current) {
          interruptionNotifiedRef.current = true;
          alert("분석이 중단되었습니다.");
        }
        addLog("분석이 중단되었습니다.");
      } else {
        addLog(`에러 발생: ${error?.message || "알 수 없는 오류"}`);
      }
    } finally {
      uploadAbortControllerRef.current = null;
      setIsProcessing(false);
    }
  };

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const hasSelectedFile = selectedFileName !== DEFAULT_FILE_LABEL;
  //const canOpenLogModal = isProcessing || logs.length > 0;

  return (
    <>
      <div className="w-150 max-w-245 rounded-md bg-gray-900/60 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <div className="">
            <FaCloudUploadAlt className={`text-xl cursor-pointer transition-all ${isVisible ? '' : 'text-gray-400'} hover:text-white`} title='CSV 업로드' onClick={() => setVisible(prev => !prev)} />
          </div>

          {isVisible && (<>
            <div className="min-w-0 flex-[1.2] flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setLogs([]);
                  setPercent(0);
                  setSelectedFileName(file ? file.name : DEFAULT_FILE_LABEL);
                }}
              />
              <div className="min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-800/70 px-2 py-1 text-[10px] text-gray-200 truncate">
                {selectedFileName}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-md border border-blue-500/70 bg-blue-500/20 px-2 py-1 text-[10px] font-bold text-blue-200 hover:bg-blue-500/30"
              >
                파일 선택
              </button>
            </div>

            <div className="min-w-0 flex-[0.9] mx-2">
              <div className="flex items-center gap-2">
                <div className="w-20 text-[9px] font-bold text-gray-300">{percent}%</div>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-700">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                  />
                </div>
              </div>
              <div className="mt-1 text-[9px] text-gray-300 truncate">
                {latestLog ? `[${latestLog.time}] ${latestLog.message}` : "로그 대기 중"}
              </div>
            </div>

            <div className="shrink-0">
              <div className="w-full flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!hasSelectedFile || isProcessing}
                  className={`w-27.5 rounded-md border px-2 py-1 text-[10px] font-bold transition-colors ${hasSelectedFile
                    ? "border-emerald-500/70 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                    : "border-gray-700 bg-gray-800/50 text-gray-500"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isProcessing ? "처리 중..." : "업로드 및 분석 시작"}
                </button>

                {/* <button
                  type="button"
                  onClick={() => setIsLogModalOpen(true)}
                  className={`w-27.5 rounded-md border border-red-500/70 bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-200 hover:bg-red -500/30 ${canOpenLogModal ? "" : "invisible pointer-events-none"
                    }`}
                >
                  로그 자세히 보기
                </button> */}
              </div>
            </div>
          </>)}
        </div>
      </div>

      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/80 px-6 py-4">
              <h3 className="text-lg font-bold text-white">물류 데이터 분석 상세</h3>
              <span className="text-sm font-semibold text-gray-400">진행률: {percent}%</span>
            </div>

            <div className="flex max-h-[75vh] flex-col overflow-y-auto p-6">

              {/* 분석이 완료되어 summary 객체가 있을 때만 렌더링되는 결과 UI */}
              {resultSummary && (() => {
                const err = toFiniteNumber(resultSummary.errorCount);
                const cau = toFiniteNumber(resultSummary.cautionCount);
                const locErr = toFiniteNumber(resultSummary.locationErrorCount);
                const timeErr = toFiniteNumber(resultSummary.timeErrorCount);
                const unreg = toFiniteNumber(resultSummary.unregisteredCount);
                const integ = toFiniteNumber(resultSummary.integrityErrorCount);
                const clone = toFiniteNumber(resultSummary.clonedCount);
                const redund = toFiniteNumber(resultSummary.redundantCount);

                const totalIssues = err + cau + locErr + timeErr + unreg + integ + clone + redund;
                const isError = totalIssues > 0;

                // 표시할 이슈 항목들을 배열로 구성하여 유연하게 렌더링
                const issueItems = [
                  { label: "위험", count: err, style: "text-red-400 bg-red-500/10 border-red-500/20" },
                  { label: "경고", count: cau, style: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
                  { label: "거점 이동 오류", count: locErr, style: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
                  { label: "이동 속도 오류", count: timeErr, style: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
                  { label: "미등록 EPC", count: unreg, style: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
                  { label: "무결성 오류", count: integ, style: "text-red-500 bg-red-600/10 border-red-600/20" },
                  { label: "복제 EPC", count: clone, style: "text-orange-300 bg-orange-400/10 border-orange-400/20" },
                  { label: "중복 EPC", count: redund, style: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                ].filter(item => item.count > 0);

                return (
                  <div className={`mb-6 rounded-xl border p-5 ${isError ? 'border-red-900/50 bg-red-950/20' : 'border-green-900/50 bg-green-950/20'}`}>
                    <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-3">
                      <h4 className={`text-base font-bold ${isError ? 'text-red-400' : 'text-green-400'}`}>
                        {isError ? '⚠️ 이슈 발견' : '✅ 성공적으로 처리됨'}
                      </h4>
                      <div className="text-sm text-gray-300">
                        총 <strong className="text-white">{toFiniteNumber(resultSummary.totalProcessed)}</strong>건 분석 완료
                      </div>
                    </div>

                    {isError ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {issueItems.map((item, idx) => (
                          <div key={idx} className={`flex flex-col items-center justify-center rounded-lg border p-3 ${item.style}`}>
                            <span className="mb-1 text-[11px] font-semibold opacity-80">{item.label}</span>
                            <span className="text-lg font-bold">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-2 text-center text-sm font-medium text-green-300/80">
                        모든 물류 데이터가 무결성 위반 없이 정상적으로 등록되었습니다.
                      </p>
                    )}
                  </div>
                );
              })()}

              {isLogDetailVisible && <>
                <h4 className="mb-2 text-sm font-bold text-gray-400">상세 진행 로그</h4>
                <div className="flex-1 rounded-lg border border-gray-800 bg-black/50 p-3 font-mono text-[11px] text-gray-300">
                  {logs.length === 0 ? (
                    <p className="text-gray-600">수집된 로그가 없습니다.</p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="mb-1 border-b border-gray-800/40 pb-1 leading-relaxed last:border-0 last:pb-0">
                        <span className="mr-2 text-gray-500">[{log.time}]</span>
                        <span className={(log.message.includes("위험") || log.message.includes("에러") ? "text-red-400 font-medium" : "") + " break-all"}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </>
              }
            </div>

            {/* 푸터 영역: 닫기 시 대시보드 새로고침 발동 */}
            <div className="flex justify-end border-t border-gray-800 bg-gray-900/80 px-6 py-4 gap-2">
              <button
                onClick={()=>setLogDetailVisible(prev => !prev)}
                className="rounded-lg bg-green-700 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-green-600 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95"
              >
                상세 로그
              </button>
              <button
                onClick={handleCloseModal}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
