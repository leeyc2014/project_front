"use client";

import React, { useState, useRef, useEffect } from 'react';

// 서버에서 내려오는 데이터 구조 정의
interface LogisticsData {
  message?: string;
  percent?: number;
}

interface LogEntry {
  time: string;
  message: string;
}

export default function LogisticsProcessor() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [percent, setPercent] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const getToken = () => {
    if (typeof window === 'undefined') return '';
    const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return sessionStorage.getItem('token') || '';
  };

  // 로그 추가 시 자동 스크롤
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setLogs((prev) => [...prev, { time, message: msg }]);
  };

  const processLine = (jsonString: string) => {
    const trimmed = jsonString.trim();
    if (!trimmed) return;

    try {
      const data: LogisticsData = JSON.parse(trimmed);
      if (data.message) addLog(data.message);
      if (typeof data.percent === 'number') setPercent(data.percent);
    } catch (e) {
      console.warn("JSON 파싱 실패:", trimmed);
      addLog(trimmed);
    }
  };

  const handleUpload = async () => {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      alert("파일을 선택해주세요.");
      return;
    }

    // 초기화
    setLogs([]);
    setPercent(0);
    setIsProcessing(true);

    const formData = new FormData();
    formData.append('file', files[0]);

    const token = getToken();
    if (!token) {
      alert('로그인 토큰이 없습니다. 다시 로그인 해주세요.');
      setIsProcessing(false);
      return;
    }

    const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '';
    if (!backendBaseUrl) {
      alert('백엔드 URL이 설정되지 않았습니다.');
      setIsProcessing(false);
      return;
    }
    const url = `${backendBaseUrl}/api/v1/logistics/upload`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      if (!res.body) throw new Error("ReadableStream을 지원하지 않는 응답입니다.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer.trim()) processLine(buffer);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line);
        }
      }

      addLog("✅ 모든 작업이 완료되었습니다.");
    } catch (error: any) {
      console.error(error);
      addLog(`❌ 에러 발생: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-5 font-sans">
      <h2 className="text-2xl font-bold mb-5">물류 데이터 처리 현황</h2>

      <div className="flex gap-2 mb-5">
        <input 
          type="file" 
          ref={fileInputRef}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button 
          onClick={handleUpload}
          disabled={isProcessing}
          className={`px-4 py-2 rounded-md text-white font-medium ${isProcessing ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isProcessing ? '처리 중...' : '업로드 및 분석 시작'}
        </button>
      </div>

      {/* 프로그레스 바 영역 */}
      <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 mb-5">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-bold text-gray-700">진행률</span>
          <span className="text-sm font-bold text-blue-600">{percent}%</span>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-6 overflow-hidden">
          <div 
            className="bg-blue-500 h-full transition-all duration-300" 
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      </div>

      {/* 로그 출력 영역 (터미널 스타일) */}
      <div className="w-full h-[400px] bg-[#1e1e1e] text-[#00ff00] overflow-y-auto p-4 rounded-md font-mono text-sm leading-relaxed border border-gray-800">
        {logs.map((log, index) => (
          <div key={index} className="border-b border-gray-800 py-1 break-all">
            <span className="text-gray-500 mr-2">[{log.time}]</span>
            {log.message}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
