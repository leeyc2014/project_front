"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import HeaderUploadWidget from '@/components/dashboard/HeaderUploadWidget';

const Icon = ({ path, className }: { path: string; className: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [displayName, setDisplayName] = useState('—');
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isDashboardHome = pathname === '/dashboard';
  const dashboardHref = '/dashboard?eventTimeStart=2024-07-25&eventTimeEnd=2024-07-31';
  const reportHref = '/dashboard/report/generate';

  const clearTokenCookie = () => {
    document.cookie = 'token=; Path=/; Max-Age=0; SameSite=Lax';
  };

  const getToken = () => {
    if (typeof window === 'undefined') return '';
    const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return sessionStorage.getItem('token') || '';
  };

  const decodeJwtName = (token: string) => {
    try {
      const payload = token.split('.')[1];
      if (!payload) return '';
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '==='.slice((normalized.length + 3) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      const data = JSON.parse(json);

      const candidates = [
        data?.name,
        data?.userName,
        data?.username,
        data?.nickname,
        data?.displayName,
        data?.id,
        data?.sub,
      ];
      const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
      return typeof found === 'string' ? found : '';
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (pathname.includes("/dashboard/report/generate")) {
      setSelectedMenu("report");
    } else if (pathname === ("/dashboard")) {
      setSelectedMenu("dashboard");
    }
  }, [pathname]); // pathname이 변할 때마다 즉각 실행

  useEffect(() => {
    const token = getToken();
    const name = token ? decodeJwtName(token) : '';
    setDisplayName(name || '—');
  }, [pathname]);

  const handleSignOut = () => {
    clearTokenCookie();
    router.push("/");
  };

  return (
    // 1. 전체 높이를 100vh로 고정하고 overflow-hidden 부여
    <div className="flex flex-col h-screen w-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">

      {/* HEADER (64px 고정) */}
      <header
        className="relative z-50 bg-gray-900 text-white shadow-lg flex-none"
        onMouseLeave={() => setHoveredMenu(null)}
      >
        <div className="h-16 flex items-center justify-between px-8 border-b border-gray-800 relative z-20 bg-gray-900">
          <div className="flex items-center space-x-12 shrink-0">
            <h1 className="text-xl font-black tracking-tighter text-blue-500 italic uppercase">LOGIFLOW</h1>
            <nav className="flex space-x-8 h-16">
              <div className="h-16 flex items-center">
                <Link
                  href={dashboardHref}
                  onClick={() => {
                    setSelectedMenu('dashboard');
                    setHoveredMenu(null);
                  }}
                  className={`flex items-center font-bold px-1 transition-all ${
                    selectedMenu === 'dashboard'
                      ? 'border-blue-500 text-blue-500'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  대시보드
                </Link>
              </div>
              <div className="h-16 flex items-center">
                <Link
                  href={reportHref}
                  onClick={() => {
                    setSelectedMenu("report");
                    setHoveredMenu(null);
                  }}
                  className={`flex items-center font-bold px-1 transition-all ${
                    selectedMenu === 'report'
                      ? 'border-blue-500 text-blue-500'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >                  
                  진단 리포트
                </Link>
              </div>
            </nav>
          </div>
          <div className="mx-4 min-w-0 flex-1 flex justify-center">
            <HeaderUploadWidget />
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right border-r border-gray-700 pr-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none mb-1">Authenticated</p>
              <p className="font-bold text-blue-400 text-sm leading-none">{displayName}</p>
            </div>
            <button className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400" onClick={handleSignOut}>
              <Icon path="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SECONDARY TAB (전체 영역 노출 + 텍스트만 각 탭 아래 정렬) */}
        <div
          onMouseEnter={() => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            setHoveredMenu('report');
          }}
          onMouseLeave={() => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            closeTimerRef.current = setTimeout(() => {
              setHoveredMenu(null);
            }, 120);
          }}
          className={`absolute left-0 top-full w-full bg-gray-800 border-b border-blue-500/30 shadow-2xl overflow-hidden transition-all duration-200 ease-in-out ${hoveredMenu === 'report' ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
            }`}
        >
          <div className="h-12 flex items-center px-8">
            <div className="flex items-center space-x-12">
              <span className="text-xl font-black tracking-tighter text-blue-500 italic uppercase opacity-0 select-none">TEST</span>
              <div className="flex space-x-8 text-sm">
                {['report'].map((menuKey) => (
                  <div key={menuKey} className="relative">
                    <span className="invisible font-bold px-1 pointer-events-none relative z-0">
                      {menuKey === 'dashboard' ? '대시보드' : '진단 리포트'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT AREA (중요: 남은 공간 모두 차지) */}
      {/* Header(64px) + Footer(48px) = 112px를 제외한 높이 자동 계산 */}
      <main className={`flex-1 relative bg-gray-100 p-0 ${isDashboardHome ? 'overflow-hidden' : 'overflow-y-scroll'}`}>
        <div className="h-full w-full">
          {children}
        </div>
      </main>

      {/* FOOTER (48px 고정) */}
      {!isDashboardHome && (
        <footer className="h-12 bg-gray-300 border-t border-gray-200 flex items-center justify-between px-8 z-10 flex-none">
          <div className="flex items-center space-x-6">
            <div className="flex items-center text-[11px] text-gray-400">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              SYSTEM OPERATIONAL
            </div>
            <p className="text-[11px] text-gray-500 border-l pl-6 border-gray-200">
              2차원 바코드 기반 물류 공급망 불법 유통 분석 웹 서비스
            </p>
          </div>
          <p className="text-[11px] font-medium text-gray-400 tracking-wider uppercase">
            © 2026 LOGIFLOW.
          </p>
        </footer>
      )}
    </div>
  );
}
