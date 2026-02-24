"use client";

import { useEffect, useRef, useState } from "react";
import type { CompleteSummary, LogisticsData, LogEntry } from "@/types/headerUploadWidget";
import { useRouter, useSearchParams } from "next/navigation";
import { useAtom } from "jotai";
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
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [percent, setPercent] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string>(DEFAULT_FILE_LABEL);

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
    if (totalIssueCount <= 0) return false;

    completeAlertedRef.current = true;
    const lines: string[] = [`총 ${toFiniteNumber(summary.totalProcessed)}건 처리 중 ${totalIssueCount}건의 문제가 발견되었습니다.`];
    if (errorCount > 0) lines.push(`위험: ${errorCount}`);
    if (cautionCount > 0) lines.push(`경고: ${cautionCount}`);

    lines.push("");

    if (locationErrorCount > 0) lines.push(`허용되지 않는 거점 이동: ${locationErrorCount}`);
    if (timeErrorCount > 0) lines.push(`불가능한 이동 속도: ${timeErrorCount}`);

    if (unregisteredCount > 0) lines.push(`미등록 EPC: ${unregisteredCount}`);
    if (integrityErrorCount > 0) lines.push(`무결성 오류: ${integrityErrorCount}`);
    if (clonedCount > 0) lines.push(`복제 EPC: ${clonedCount}`);
    if (redundantCount > 0) lines.push(`중복 EPC: ${redundantCount}`);

    alert(lines.join("\n"));

    return true;
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
    console.log(data);
    const summaryFromRoot = readCompleteSummary(data);
    const summaryFromMessage =
      typeof data.message === "string"
        ? readCompleteSummary(tryParseJson(data.message))
        : readCompleteSummary(data.message);
    const summary = summaryFromRoot || summaryFromMessage;

    if (data.event === "complete" && summary) {
      addLog(JSON.stringify(summary));
      const isError = handleCompleteAlert(summary);

      if (isError) {
        //const params = new URLSearchParams(searchParams.toString());
        //router.push(`/dashboard?${params.toString()}`);
        setDashboardReloadTrigger(prev => prev + 1);
        //router.refresh();
      }
    }

    if (typeof data.message === "string" && data.message.trim().length > 0) {
      addLog(data.message);
    } else if (!summary) {
      addLog(trimmed);
    }
  };

  const handleUpload = async () => {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      alert("파일을 선택해주세요.");
      return;
    }

    setLogs([]);
    setPercent(0);
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) processLine(buffer);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
      }

      addLog("✅ 모든 작업이 완료되었습니다.");
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
  const canOpenLogModal = isProcessing || logs.length > 0;

  return (
    <>
      <div className="w-full max-w-[980px] rounded-md bg-gray-900/60 px-2 py-1.5">
        <div className="flex items-center gap-2">
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

          <div className="shrink-0 w-[304px]">
            <div className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={!hasSelectedFile || isProcessing}
                className={`w-[110px] rounded-md border px-2 py-1 text-[10px] font-bold transition-colors ${hasSelectedFile
                    ? "border-emerald-500/70 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                    : "border-gray-700 bg-gray-800/50 text-gray-500"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isProcessing ? "처리 중..." : "업로드 및 분석 시작"}
              </button>

              <button
                type="button"
                onClick={() => setIsLogModalOpen(true)}
                className={`w-[110px] rounded-md border border-red-500/70 bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-200 hover:bg-red -500/30 ${canOpenLogModal ? "" : "invisible pointer-events-none"
                  }`}
              >
                로그 자세히 보기
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLogModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
              <h2 className="text-lg font-black text-white">물류 업로드 분석 로그</h2>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-gray-800"
              >
                닫기
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-bold text-gray-700">진행률</span>
                  <span className="text-sm font-bold text-blue-600">{percent}%</span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                  />
                </div>
              </div>

              <div className="w-full h-[420px] bg-[#1e1e1e] text-[#00ff00] overflow-y-auto p-4 rounded-md font-mono text-sm leading-relaxed border border-gray-800">
                {logs.map((log, index) => (
                  <div key={`${log.time}-${index}`} className="border-b border-gray-800 py-1 break-all">
                    <span className="text-gray-500 mr-2">[{log.time}]</span>
                    {log.message}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
