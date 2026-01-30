"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const Icon = ({ path, className }: { path: string; className: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [selectedSubMenu, setSelectedSubMenu] = useState('종합 현황');
  const router = useRouter();
  const pathname = usePathname();

  const subMenus: { [key: string]: { name: string; href: string }[] } = {
    dashboard: [
      { name: '종합 현황', href: '/dashboard' },
      { name: '실시간 감시', href: '#' },
      { name: '위험 이력 분석', href: '#' },
    ],
    report: [
      { name: '리포트 생성', href: '/dashboard/report/generate' },
      { name: '로그 업로드', href: '/dashboard/report/upload' },
    ],
  };

  useEffect(() => {
    // '/dashboard/report/upload' 같은 긴 경로를 먼저 체크해야 합니다.
    if (pathname.includes("/dashboard/report/upload")) {
      setSelectedMenu("report"); // 한글 "로그 관리"가 아닌 키값 "report" 사용
      setSelectedSubMenu("로그 업로드");
    } else if (pathname.includes("/dashboard/report/generate")) {
      setSelectedMenu("report");
      setSelectedSubMenu("리포트 생성");
    } else if (pathname === "/dashboard") {
      setSelectedMenu("dashboard");
      setSelectedSubMenu("종합 현황");
    }
  }, [pathname]); // pathname이 변할 때마다 즉각 실행

  const handleSubMenuClick = (menuKey: string, sub: { name: string; href: string }) => {
    setSelectedMenu(menuKey);
    setSelectedSubMenu(sub.name);
    setHoveredMenu(null); // 클릭 시 메뉴 닫기

    if (sub.href !== '#') {
      router.push(sub.href); // 3. 실제 페이지 이동 실행
    }
  };

  const handleSignOut = () => {
    sessionStorage.removeItem("token");
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
          <div className="flex items-center space-x-12">
            <h1 className="text-xl font-black tracking-tighter text-blue-500 italic uppercase">TEST</h1>
            <nav className="flex space-x-8 h-16">
              {['dashboard', 'report'].map((menuKey) => (
                <button
                  key={menuKey}
                  onMouseEnter={() => setHoveredMenu(menuKey)}
                  onClick={() => {
                    // 메인 메뉴 클릭 시 해당 카테고리의 첫 번째 서브메뉴로 이동하게 설정 가능
                    setSelectedMenu(menuKey);
                  }}
                  className={`flex items-center font-bold px-1 border-b-2 transition-all ${selectedMenu === menuKey ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                >
                  {menuKey === 'dashboard' ? '대시보드' : '진단 리포트'}
                  <Icon path="M19.5 8.25l-7.5 7.5-7.5-7.5" className={`ml-2 w-3 h-3 transition-transform ${hoveredMenu === menuKey ? 'rotate-180' : ''}`} />
                </button>
              ))}
              <Link href="#" className="flex items-center text-gray-400 hover:text-white font-medium px-1">시스템관리</Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right border-r border-gray-700 pr-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none mb-1">Authenticated</p>
              <p className="font-bold text-blue-400 text-sm leading-none">admin_01</p>
            </div>
            <button className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400" onClick={handleSignOut}>
              <Icon path="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SECONDARY TAB (호버 시 드롭다운) */}
        <div
          className={`absolute left-0 w-full bg-gray-800 border-b border-blue-500/30 shadow-2xl overflow-hidden transition-all duration-300 ease-in-out z-10 ${hoveredMenu ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
            }`}
        >
          <div className="max-w-7xl mx-auto px-8 py-3 flex space-x-10 text-sm">
            {hoveredMenu && subMenus[hoveredMenu]?.map((sub) => (
              <Link
                key={sub.name}
                href={sub.href}
                onClick={() => {
                  setSelectedMenu(hoveredMenu);
                  setSelectedSubMenu(sub.name);
                  setHoveredMenu(null);
                }}
                className={`transition-all duration-200 relative pb-1 ${selectedSubMenu === sub.name && selectedMenu === hoveredMenu
                  ? 'text-blue-400 font-black' : 'text-gray-400 hover:text-white'
                  }`}
              >
                {sub.name}
                {selectedSubMenu === sub.name && selectedMenu === hoveredMenu && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                )}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT AREA (중요: 남은 공간 모두 차지) */}
      {/* Header(64px) + Footer(48px) = 112px를 제외한 높이 자동 계산 */}
      <main className="flex-1 relative overflow-hidden bg-gray-100 p-4">
        <div className="h-full w-full">
          {children}
        </div>
      </main>

      {/* FOOTER (48px 고정) */}
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
          © 2026 TEST.
        </p>
      </footer>
    </div>
  );
}
