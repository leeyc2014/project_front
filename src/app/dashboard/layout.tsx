"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import HeaderUploadWidget from '@/components/dashboard/HeaderUploadWidget';
import { useAtom } from 'jotai';
import { User } from '@/types/user';
import { loginUserAtom } from '@/atoms/atom';

const Icon = ({ path, className }: { path: string; className: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loginUser, setLoginUser] = useAtom<User | null>(loginUserAtom);

  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [displayName, setDisplayName] = useState('—');
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isDashboardHome = pathname === '/dashboard';

  const menuItems = [
    {
      "key": "dashboard",
      "url": '/dashboard?eventTimeStart=2024-07-25&eventTimeEnd=2024-07-31',
      "name": "대시보드",
      "admin_only": false
    },

    {
      "key": "report",
      "url": '/dashboard/report',
      "name": "진단 리포트",
      "admin_only": false
    },

    {
      "key": "anomaly",
      "url": '/dashboard/anomaly',
      "name": "보고서 목록",
      "admin_only": true
    },

  ]

  const clearTokenCookie = () => {
    document.cookie = 'token=; Path=/; Max-Age=0; SameSite=Lax';
  };

  useEffect(() => {
    if (pathname.includes("/dashboard/report")) {
      setSelectedMenu("report");
    } else if (pathname.includes("/dashboard/anomaly")) {
      setSelectedMenu("anomaly");
    } else {
      setSelectedMenu("dashboard");
    }
  }, [pathname]); // pathname이 변할 때마다 즉각 실행

  useEffect(() => {
    setDisplayName(loginUser?.name || '—')
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
              {
                menuItems.map((item) => (
                  <div className={`h-16 flex items-center ${loginUser?.role !== 'ADMIN' && item.admin_only ? 'hidden' : ''}`} key={item.key}>
                    <Link
                      href={item.url}
                      onClick={() => {
                        setSelectedMenu(item.key);
                        setHoveredMenu(null);
                      }}
                      className={`flex items-center font-bold px-1 transition-all ${selectedMenu === item.key
                          ? 'border-blue-500 text-blue-500'
                          : 'border-transparent text-gray-400 hover:text-white'
                        }`}
                    >
                      {item.name}
                    </Link>
                  </div>
                ))
              }
            </nav>
          </div>
          <div className="mx-4 min-w-0 flex-1 flex justify-center">
            {loginUser?.role === 'ADMIN' &&
              <HeaderUploadWidget />
            }
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
        <footer className="h-12 bg-gray-950 border-t border-gray-600 flex items-center justify-between px-8 z-10 flex-none">
          <div className="flex items-center space-x-6">
            <div className="flex items-center text-[11px] text-gray-300">
              SYSTEM OPERATIONAL
            </div>
            <p className="text-[11px] text-gray-300 border-l pl-6 border-gray-500">
              2차원 바코드 기반 물류 공급망 불법 유통 분석 웹 서비스
            </p>
          </div>
          <p className="text-[11px] font-medium text-gray-300 tracking-wider uppercase">
            © 2026 LOGIFLOW.
          </p>
        </footer>
      )}
    </div>
  );
}
