// app/period-ranges/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { PeriodRange, Product, RangeType } from "@/types/reportPage";

/* ─── 유틸 ─────────────────────────────────────────── */

function parseLocal(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toInputStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmt(date: Date): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d} (${days[date.getDay()]})`;
}

function buildRanges(fromStr: string, toStr: string, today: Date, type: RangeType): PeriodRange[] {
  const from = parseLocal(fromStr);
  const to = parseLocal(toStr);
  const ranges: PeriodRange[] = [];

  if (type === "WEEKLY") {
    const fromDow = from.getDay();
    const backToMon = fromDow === 0 ? 6 : fromDow - 1;
    const expandedFrom = new Date(from);
    expandedFrom.setDate(from.getDate() - backToMon);

    const toDow = to.getDay();
    const fwdToSun = toDow === 0 ? 0 : 7 - toDow;
    const expandedTo = new Date(to);
    expandedTo.setDate(to.getDate() + fwdToSun);
    if (expandedTo > today) expandedTo.setTime(today.getTime());

    const cur = new Date(expandedFrom);
    while (cur <= expandedTo) {
      const start = new Date(cur);
      const end = new Date(cur);
      end.setDate(cur.getDate() + 6);

      ranges.push({ from: start, to: end > expandedTo ? new Date(expandedTo) : end });
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    const expandedFrom = new Date(from.getFullYear(), from.getMonth(), 1);

    const expandedTo = new Date(to.getFullYear(), to.getMonth() + 1, 0);
    if (expandedTo > today) expandedTo.setTime(today.getTime());

    const cur = new Date(expandedFrom);
    while (cur <= expandedTo) {
      const start = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);

      ranges.push({ from: start, to: end > expandedTo ? new Date(expandedTo) : end });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  return ranges.reverse(); 
}

/* ─── 페이지 ────────────────────────────────────────── */
export default function PeriodRangePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  useEffect(() => {
    setIsMounted(true);

    // 제품 목록 Fetch
    const fetchProducts = async () => {
      try {
        const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '';
        const url = `${backendBaseUrl}/api/v1/dashboard/init-data`;
        const token = getToken();
        const authHeaders = { Authorization: `Bearer ${token}` };

        const res = await fetch(url, { headers: authHeaders });
        const data = await res.json();

        if (data?.filters?.productList) {
          // 최상단에 "전체" 항목 추가
          setProducts([
            { id: "", label: "전체" },
            ...data.filters.productList
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
        // API 에러 시 폴백(Fallback) 처리
        setProducts([{ id: "", label: "전체" }]);
      }
    };

    fetchProducts();
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [rangeType, setRangeType] = useState<RangeType>("WEEKLY");
  const [fromStr, setFromStr] = useState("2024-01-01");
  const [toStr, setToStr] = useState(toInputStr(today));

  const periodRanges = useMemo(() => {
    if (!isMounted) return [];
    return buildRanges(fromStr, toStr, today, rangeType);
  }, [fromStr, toStr, today, rangeType, isMounted]);

  const getToken = () => {
    if (typeof window === 'undefined') return '';
    const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return sessionStorage.getItem('token') || '';
  };

  const dayCount = (r: PeriodRange) =>
    Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000) + 1;

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gray-950 text-white px-6 py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-black tracking-tight">진단 리포트</h1>
          <p className="text-gray-400 text-sm mt-1">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6"> {/* 너비를 3xl -> 4xl로 확장하여 3단 배치 고려 */}

        {/* 헤더 */}
        <div>
          <h1 className="text-3xl font-black tracking-tight">진단 리포트</h1>
          <p className="text-gray-400 text-sm mt-1">
            기간별 진단 리포트를 확인하세요.
          </p>
        </div>

        {/* 컨트롤 박스 (좌/중/우 배치 컨테이너) */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6">
          
          {/* (왼쪽) 날짜 범위 선택 */}
          <div className="flex flex-col gap-3 flex-shrink-0">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">
              Date Range
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                  From
                </label>
                <input
                  type="date"
                  value={fromStr}
                  max={toStr}
                  onChange={(e) => setFromStr(e.target.value)}
                  className="bg-gray-800 text-white px-3 py-2.5 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 text-sm font-mono [color-scheme:dark] h-[46px]"
                />
              </div>

              <span className="text-gray-600 pb-2.5 text-lg">→</span>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                  To
                </label>
                <input
                  type="date"
                  value={toStr}
                  min={fromStr}
                  max={toInputStr(today)}
                  onChange={(e) => setToStr(e.target.value)}
                  className="bg-gray-800 text-white px-3 py-2.5 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 text-sm font-mono [color-scheme:dark] h-[46px]"
                />
              </div>
            </div>
          </div>

          {/* (중앙) 제품 선택 */}
          <div className="flex flex-col gap-3 flex-1 w-full lg:w-auto min-w-[180px]">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">
              Select Product
            </p>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 text-sm [color-scheme:dark] h-[46px] w-full cursor-pointer"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </select>
          </div>

          {/* (오른쪽) 범위 타입 선택 */}
          <div className="flex flex-col gap-3 flex-shrink-0">
             <p className="text-xs font-black uppercase tracking-widest text-gray-400">
               Analysis Unit
             </p>
             <div className="flex bg-gray-950 p-1 rounded-xl w-max border border-gray-800 h-[46px] items-center">
               <button
                 onClick={() => setRangeType("WEEKLY")}
                 className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all h-full ${
                   rangeType === "WEEKLY"
                     ? "bg-blue-600 text-white shadow-md"
                     : "text-gray-500 hover:text-white hover:bg-gray-800"
                 }`}
               >
                 Weekly
               </button>
               <button
                 onClick={() => setRangeType("MONTHLY")}
                 className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all h-full ${
                   rangeType === "MONTHLY"
                     ? "bg-blue-600 text-white shadow-md"
                     : "text-gray-500 hover:text-white hover:bg-gray-800"
                 }`}
               >
                 Monthly
               </button>
             </div>
          </div>

        </div>

        {/* 리포트 리스트 테이블 */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-gray-300">
              {rangeType === "WEEKLY" ? "주차별" : "월별"} 리포트 목록
            </span>
            <span className="text-xs text-gray-500">{periodRanges.length}개 리포트</span>
          </div>

          <div className="divide-y divide-gray-800">
            {periodRanges.length === 0 ? (
              <div className="px-6 py-10 text-center text-gray-500 text-sm">
                유효한 날짜 범위를 선택하세요.
              </div>
            ) : (
              periodRanges.map((range, idx) => {
                const isLatest = idx === 0;
                const days = dayCount(range);
                return (
                  <div
                    key={idx}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      {isLatest && (
                        <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-md tracking-wider">
                          LATEST
                        </span>
                      )}
                      <span className="text-sm font-mono text-white">
                        {fmt(range.from)}
                      </span>
                      <span className="text-gray-600">~</span>
                      <span className="text-sm font-mono text-white">
                        {fmt(range.to)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({days}일)
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        // 새 창으로 인쇄 페이지 열기 (Query String 포함)
                        const queryParams = new URLSearchParams({
                          from: toInputStr(range.from),
                          to: toInputStr(range.to),
                          productId: selectedProductId
                        }).toString();
                        
                        window.open(`/print?${queryParams}`, "_blank");
                      }}
                      className="px-5 py-2.5 bg-gray-800 text-white rounded-xl text-xs font-black hover:bg-blue-600 transition-all shadow-md border border-gray-700 group-hover:border-blue-500 whitespace-nowrap"
                    >
                      미리보기
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
