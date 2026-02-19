"use client";

import { useEffect, useRef, useState } from "react";

interface LogisticsData {
  message?: string;
  percent?: number;
}

interface LogEntry {
  time: string;
  message: string;
}

export default function HeaderUploadWidget() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [percent, setPercent] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string>("선택된 파일 없음");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);
  const interruptionNotifiedRef = useRef(false);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

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
    setLogs((prev) => [...prev.slice(-29), { time, message: msg }]);
  };

  const processLine = (jsonString: string) => {
    const trimmed = jsonString.trim();
    if (!trimmed) return;

    try {
      const data: LogisticsData = JSON.parse(trimmed);
      if (data.message) addLog(data.message);
      if (typeof data.percent === "number") setPercent(data.percent);
    } catch {
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

        for (const line of lines) {
          processLine(line);
        }
      }

      addLog("모든 작업이 완료되었습니다.");
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
  const hasSelectedFile = selectedFileName !== "선택된 파일 없음";

  return (
    <div className="w-full max-w-[760px] rounded-md bg-gray-900/60 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-[1.15] flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setLogs([]);
            setPercent(0);
            setSelectedFileName(file ? file.name : "선택된 파일 없음");
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
        <div className="min-w-0 flex-[0.85] ml-4">
          <div className="flex items-center gap-2">
            <div className="w-20 text-[9px] font-bold text-gray-300">{percent}%</div>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-700">
              <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
            </div>
          </div>
          <div className="mt-1 text-[9px] text-gray-300 truncate">
            {latestLog ? `[${latestLog.time}] ${latestLog.message}` : "로그 대기 중"}
          </div>
        </div>
        <div className="w-[124px] shrink-0 flex justify-end">
          {hasSelectedFile && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={isProcessing}
              className="w-full rounded-md border border-emerald-500/70 bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing ? "처리 중..." : "업로드 및 분석 시작"}
            </button>
          )}
        </div>
        </div>
    </div>
  );
}
