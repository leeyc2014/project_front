// app/anomaly-reports/page.tsx
"use client";

import { convertMessage } from "@/utils/aiMessageUtil";
import React, { useState, useEffect, useCallback } from "react";

/* ── 코드 → 한글 상수 맵 ────────────────────────────── */
const BUSINESS_STEP_KO: Record<string, string> = {
  Factory:       "공장 생산",
  Warehouse:     "창고 관리",
  WMS:           "창고 관리(WMS)",
  Logistics_HUB: "물류 허브",
  Saler:         "도매상",
  Retailer:      "소매상",
};

const EVENT_TYPE_KO: Record<string, string> = {
  Aggregation: '공장',
  WMS_Inbound: '공장창고(In)',
  WMS_Outbound: '공장창고(Out)',
  HUB_Inbound: '물류센터(In)',
  HUB_Outbound: '물류센터(Out)',
  W_Stock_Inbound: '도매(In)',
  W_Stock_Outbound: '도매(Out)',
  R_Stock_Inbound: '소매(In)',
  R_Stock_Outbound: '소매(Out)',
  POS_Sell: '판매완료',
};

const LOCATION_TYPE_KO: Record<string, string> = {
  Factory:        "공장",
  Warehouse:      "창고",
  LogisticCenter: "물류센터",
  Saler:          "도매상",
  Retailer:       "소매상",
};

function ko(map: Record<string, string>, code: string): string {
  return map[code] ?? code;
}


/* ── 타입 ───────────────────────────────────────────── */
interface FilterItem { id: number; label: string; }

interface FilterMaps {
  locationById: Map<number, string>;
  operatorById: Map<number, string>;
  deviceById:   Map<number, string>;
  companyById:  Map<number, string>;
  productById:  Map<number, string>;
}

interface Location {
  locationId: number; locationName: string;
  initial: string; longtitude: number; latitude: number; type: string;
}
interface Epc {
  epcCode: string;
  company: { epcCompany: number; companyName: string };
  product: { epcProduct: number; productName: string; company: { epcCompany: number; companyName: string } };
  epcSerial: number;
  lot: { epcLot: number; lotName: string | null };
  manufactureDate: string; expiryDate: string;
}
interface LogisMove {
  id: number;
  location: Location;
  hubType: string; businessStep: string; eventType: string;
  operator: { operatorId: number; operatorName: string; location: Location };
  device: { deviceId: number; deviceName: string; location: Location };
  epc: Epc;
  eventTime: string; aiCheck: string | null; ruleCheck: string | null;
  epcCode: string; operatorId: number; deviceId: number; locationId: number;
}
interface AnomalyReport {
  id: number;
  logisMove: LogisMove;
  detail: string;
  result: string;
  reportDate: string;
  completed: boolean;   // ← 추가
}
interface PageInfo {
  totalElements: number; totalPages: number; number: number;
  size: number; first: boolean; last: boolean; numberOfElements: number;
}

/* ── 유틸 ───────────────────────────────────────────── */
function getToken(): string {
  if (typeof window === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  return sessionStorage.getItem("token") || "";
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getToken()}` };
}

function fmtDatetime(str: string): string {
  if (!str) return "-";
  return str.replace("T", " ").substring(0, 16);
}

function buildFilterMaps(data: any): FilterMaps {
  const toMap = (list: FilterItem[]): Map<number, string> => {
    const m = new Map<number, string>();
    (list || []).forEach((item) => m.set(item.id, item.label));
    return m;
  };
  const f = data?.filters ?? {};
  const allLocations: FilterItem[] = [
    ...(f.factoryLocationList        ?? []),
    ...(f.logisticCenterLocationList ?? []),
    ...(f.salerLocationList          ?? []),
    ...(f.retailerLocationList       ?? []),
  ];
  return {
    locationById: toMap(allLocations),
    operatorById: toMap(f.operatorList ?? []),
    deviceById:   toMap(f.deviceList   ?? []),
    companyById:  toMap(f.companyList  ?? []),
    productById:  toMap(f.productList  ?? []),
  };
}

/* ── 서브 컴포넌트 ──────────────────────────────────── */
type BadgeColor = "blue" | "green" | "yellow" | "red" | "purple" | "gray";

function InfoRow({
  label, value, mono = false, badge = false, badgeColor = "blue",
}: {
  label: string; value: string;
  mono?: boolean; badge?: boolean; badgeColor?: BadgeColor;
}) {
  const BADGE: Record<BadgeColor, string> = {
    blue:   "bg-blue-900/50   text-blue-300   border border-blue-700/50",
    green:  "bg-green-900/50  text-green-300  border border-green-700/50",
    yellow: "bg-yellow-900/50 text-yellow-300 border border-yellow-700/50",
    red:    "bg-red-900/50    text-red-300    border border-red-700/50",
    purple: "bg-purple-900/50 text-purple-300 border border-purple-700/50",
    gray:   "bg-gray-700/50   text-gray-400   border border-gray-600/50",
  };
  return (
    <div className="bg-gray-900/50 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {badge ? (
        <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg ${BADGE[badgeColor]}`}>
          {value || "-"}
        </span>
      ) : (
        <p
          className={`text-white font-semibold truncate ${mono ? "font-mono text-xs" : "text-sm"}`}
          title={value}
        >
          {value || "-"}
        </p>
      )}
    </div>
  );
}

/* ── 완료 여부 뱃지 (공통) ────────────────────────────── */
function CompletedBadge({ completed }: { completed: boolean }) {
  return completed ? (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-green-900/50 text-green-300 border border-green-700/50">
      ✓ 완료
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-700/50 text-gray-400 border border-gray-600/50">
      ○ 미완료
    </span>
  );
}

/* ── 메인 페이지 ────────────────────────────────────── */
export default function AnomalyReportsPage() {
  const [isMounted, setIsMounted]           = useState(false);
  const [reports, setReports]               = useState<AnomalyReport[]>([]);
  const [page, setPage]                     = useState(0);
  const [pageInfo, setPageInfo]             = useState<PageInfo | null>(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [filterMaps, setFilterMaps]         = useState<FilterMaps | null>(null);

  // 모달 상태
  const [selectedReport, setSelectedReport] = useState<AnomalyReport | null>(null);

  // 수정 상태
  const [isEditMode, setIsEditMode]         = useState(false);
  const [editDetail, setEditDetail]         = useState("");
  const [editResult, setEditResult]         = useState("");
  const [editCompleted, setEditCompleted]   = useState(false);  // ← 추가
  const [saving, setSaving]                 = useState(false);
  const [saveError, setSaveError]           = useState<string | null>(null);
  const [saveOk, setSaveOk]                 = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  /* init-data 로드 */
  useEffect(() => {
    if (!isMounted) return;
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "";
        const res = await fetch(`${base}/api/v1/dashboard/init-data`, { headers: authHeaders() });
        if (!res.ok) return;
        setFilterMaps(buildFilterMaps(await res.json()));
      } catch (e) {
        console.error("init-data fetch failed:", e);
      }
    })();
  }, [isMounted]);

  /* 리포트 목록 Fetch */
  const fetchReports = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "";
      const res = await fetch(`${base}/api/v1/anomaly-reports?page=${pageNum}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`서버 오류: HTTP ${res.status}`);
      const data = await res.json();
      setReports(data.content);
      setPageInfo({
        totalElements: data.totalElements, totalPages: data.totalPages,
        number: data.number, size: data.size,
        first: data.first, last: data.last, numberOfElements: data.numberOfElements,
      });
    } catch (e: any) {
      setError(e.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isMounted) fetchReports(page);
  }, [isMounted, page, fetchReports]);

  /* 모달 열기 */
  const openModal = (report: AnomalyReport) => {
    setSelectedReport(report);
    setIsEditMode(false);
    setEditDetail(report.detail ?? "");
    setEditResult(report.result ?? "");
    setEditCompleted(report.completed ?? false);  // ← 추가
    setSaveError(null);
    setSaveOk(false);
  };

  /* 모달 닫기 */
  const closeModal = () => {
    if (saving) return;
    setSelectedReport(null);
    setIsEditMode(false);
  };

  /* 수정 모드 시작 */
  const startEdit = () => {
    if (!selectedReport) return;
    setIsEditMode(true);
    setEditDetail(selectedReport.detail ?? "");
    setEditResult(selectedReport.result ?? "");
    setEditCompleted(selectedReport.completed ?? false);  // ← 추가
    setSaveError(null);
    setSaveOk(false);
  };

  /* 수정 취소 */
  const cancelEdit = () => {
    if (!selectedReport) return;
    setIsEditMode(false);
    setEditDetail(selectedReport.detail ?? "");
    setEditResult(selectedReport.result ?? "");
    setEditCompleted(selectedReport.completed ?? false);  // ← 추가
    setSaveError(null);
  };

  /* PUT 저장 */
  const saveEdit = async () => {
    if (!selectedReport) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "";
      const res = await fetch(`${base}/api/v1/anomaly-reports/${selectedReport.id}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          logisMoveId: selectedReport.logisMove.id,
          detail:      editDetail,
          result:      editResult,
          reportDate:  selectedReport.reportDate,
          completed:   editCompleted,               // ← 추가
        }),
      });

      if (!res.ok) throw new Error(`저장 실패: HTTP ${res.status}`);

      let updated: AnomalyReport = {
        ...selectedReport,
        detail:    editDetail,
        result:    editResult,
        completed: editCompleted,                   // ← 추가
      };

      try {
        const data = await res.json();
        if (data?.id && data?.logisMove?.id) updated = data;
      } catch { /* no body */ }

      setSelectedReport(updated);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setIsEditMode(false);
      setSaveOk(true);
    } catch (e: any) {
      setSaveError(e.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  /* SSR 방어 */
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  const totalPages = pageInfo?.totalPages ?? 1;

  /* 페이지 버튼 */
  const renderPageButtons = () => {
    if (totalPages <= 1) return null;
    const maxBtn = 5;
    let start = Math.max(0, page - Math.floor(maxBtn / 2));
    let end   = Math.min(totalPages - 1, start + maxBtn - 1);
    if (end - start < maxBtn - 1) start = Math.max(0, end - maxBtn + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((i) => (
      <button
        key={i} onClick={() => setPage(i)}
        className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
          i === page
            ? "bg-blue-600 text-white shadow-md"
            : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
        }`}
      >
        {i + 1}
      </button>
    ));
  };

  /* ID→라벨 룩업 */
  const loc = (id: number, fallback?: string) => filterMaps?.locationById.get(id) ?? fallback ?? String(id);
  const opr = (id: number, fallback?: string) => filterMaps?.operatorById.get(id) ?? fallback ?? String(id);
  const dev = (id: number, fallback?: string) => filterMaps?.deviceById.get(id)   ?? fallback ?? String(id);
  const cmp = (id: number, fallback?: string) => filterMaps?.companyById.get(id)  ?? fallback ?? String(id);
  const prd = (id: number, fallback?: string) => filterMaps?.productById.get(id)  ?? fallback ?? String(id);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white tracking-tight">이상 징후 보고서 목록</h1>
        </div>

        {/* 통계 카드 */}
        {/* {pageInfo && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "총 리포트",   val: pageInfo.totalElements.toLocaleString(), color: "text-white"    },
              { label: "현재 페이지", val: `${pageInfo.number + 1} / ${pageInfo.totalPages}`, color: "text-blue-400" },
              { label: "페이지 당",   val: `${pageInfo.size}건`, color: "text-white" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">{label}</p>
                <p className={`text-3xl font-black ${color}`}>{val}</p>
              </div>
            ))}
          </div>
        )} */}

        {/* 오류 배너 */}
        {error && (
          <div className="mb-6 bg-red-900/40 border border-red-700 rounded-2xl px-5 py-4 text-red-300 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* 테이블 */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              리포트 목록
            </h2>
            
            {pageInfo && <div className="text-sm font-black text-white">{pageInfo.totalElements.toLocaleString()} 건</div>}
              
            {loading && <span className="text-xs text-blue-400 animate-pulse">불러오는 중...</span>}
          </div>

          {loading && reports.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-500 text-sm">불러오는 중...</div>
          ) : reports.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-500 text-sm">데이터가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900/60">
                    {["위치", "이벤트 유형", "EPC 코드", "이상 내용", "완료 여부", "리포트 일시", "상세"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      className={`hover:bg-gray-700/40 transition-colors group ${report.completed ? "opacity-60" : ""}`}
                    >
                      <td className="px-5 py-4">
                        <span className="text-white font-semibold">
                          {loc(report.logisMove.locationId, report.logisMove.location.locationName)}
                        </span>
                        <br />
                        <span className="text-xs text-gray-500">
                          {ko(LOCATION_TYPE_KO, report.logisMove.location.type)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-block bg-blue-900/50 text-blue-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-blue-700/50">
                          {ko(EVENT_TYPE_KO, report.logisMove.eventType)}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-gray-300 max-w-[300px] truncate" title={report.logisMove.epcCode}>
                        {report.logisMove.epcCode}
                      </td>
                      <td className="px-5 py-4 max-w-[200px]">
                        <p className="text-red-400 text-xs font-semibold truncate" title={report.logisMove.ruleCheck ?? report.detail}>
                          {convertMessage(report.logisMove.ruleCheck ? report.logisMove.ruleCheck : report.logisMove.aiCheck ? report.logisMove.aiCheck : '')}
                        </p>
                      </td>
                      {/* ── 완료 여부 컬럼 ── */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <CompletedBadge completed={report.completed} />
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs font-mono whitespace-nowrap">
                        {fmtDatetime(report.reportDate)}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => openModal(report)}
                          className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-black hover:bg-blue-600 transition-all border border-gray-600 group-hover:border-blue-500 whitespace-nowrap"
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {pageInfo && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            {[
              { label: "«", action: () => setPage(0),              disabled: pageInfo.first },
              { label: "‹", action: () => setPage((p) => p - 1),   disabled: pageInfo.first },
            ].map(({ label, action, disabled }) => (
              <button key={label} onClick={action} disabled={disabled}
                className="px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-xs font-bold hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 transition-all"
              >{label}</button>
            ))}
            {renderPageButtons()}
            {[
              { label: "›", action: () => setPage((p) => p + 1),   disabled: pageInfo.last },
              { label: "»", action: () => setPage(totalPages - 1),  disabled: pageInfo.last },
            ].map(({ label, action, disabled }) => (
              <button key={label} onClick={action} disabled={disabled}
                className="px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-xs font-bold hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 transition-all"
              >{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── 상세 모달 ── */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
              <div>
                <h3 className="text-base font-black text-white">
                  리포트 상세 #{selectedReport.id}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDatetime(selectedReport.reportDate)}</p>
              </div>

              {/* 닫기 버튼 */}
              <div className="flex items-center gap-2">

                <button
                  onClick={closeModal}
                  disabled={saving}
                  className="text-gray-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 모달 바디 */}
            <div className="px-6 py-5 space-y-5">


              {/* ① 이벤트 정보 */}
              <section>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">이벤트 정보</p>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow
                    label="이벤트 위치"
                    value={loc(selectedReport.logisMove.locationId, selectedReport.logisMove.location.locationName)}
                  />
                  {/* <InfoRow
                    label="위치 유형"
                    value={ko(LOCATION_TYPE_KO, selectedReport.logisMove.location.type)}
                    badge badgeColor="blue"
                  />
                  <InfoRow
                    label="Business Step"
                    value={ko(BUSINESS_STEP_KO, selectedReport.logisMove.businessStep)}
                    badge badgeColor="green"
                  /> */}
                  <InfoRow
                    label="이벤트 유형"
                    value={ko(EVENT_TYPE_KO, selectedReport.logisMove.eventType)}
                    badge badgeColor="blue"
                  />
                  {/* Hub Type */}
                  <InfoRow
                    label="허브 타입"
                    value={loc(selectedReport.logisMove.locationId, selectedReport.logisMove.location.locationName) + " " + (selectedReport.logisMove.hubType.endsWith("Outbound") ? "출고" : "입고")}
                  />
                  <InfoRow label="이벤트 시간" value={fmtDatetime(selectedReport.logisMove.eventTime)} />
                  <InfoRow
                    label="작업자"
                    value={opr(selectedReport.logisMove.operatorId, selectedReport.logisMove.operator.operatorName)}
                  />
                  <InfoRow
                    label="장비"
                    value={dev(selectedReport.logisMove.deviceId, selectedReport.logisMove.device.deviceName)}
                  />
                </div>
              </section>

              {/* ② EPC 정보 */}
              <section>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">EPC 정보</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <InfoRow label="EPC Code" value={selectedReport.logisMove.epcCode} mono />
                  </div>
                  <InfoRow
                    label="제품명"
                    value={prd(selectedReport.logisMove.epc.product.epcProduct, selectedReport.logisMove.epc.product.productName)}
                  />
                  <InfoRow
                    label="업체명"
                    value={cmp(selectedReport.logisMove.epc.company.epcCompany, selectedReport.logisMove.epc.company.companyName)}
                  />
                  <InfoRow label="제조일"   value={selectedReport.logisMove.epc.manufactureDate} />
                  <InfoRow label="유통기한" value={selectedReport.logisMove.epc.expiryDate} />
                </div>
              </section>

              {/* ③ 이상 징후 */}
              <section>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">이상 징후</p>
                <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 space-y-4">
                  {selectedReport.logisMove.ruleCheck ? (
                    <div>
                      <p className="text-xs text-red-400 mb-1">위험</p>
                      <p className="text-red-300 text-sm font-semibold">{convertMessage(selectedReport.logisMove.ruleCheck)}</p>
                    </div>
                  ) : 
                   selectedReport.logisMove.aiCheck ? (
                    <div>
                      <p className="text-xs text-orange-400 mb-1">주의</p>
                      <p className="text-orange-300 text-sm font-semibold">{convertMessage(selectedReport.logisMove.aiCheck)}</p>
                    </div>
                  ) : null}

                  {/* detail: 수정 가능 */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">
                      상세 내용
                      {isEditMode && <span className="ml-2 text-blue-400">✎ 편집 중</span>}
                    </p>
                    {!isEditMode ? (
                      <p className="text-white text-sm whitespace-pre-wrap">{selectedReport.detail || "-"}</p>
                    ) : (
                      <textarea
                        value={editDetail}
                        onChange={(e) => setEditDetail(e.target.value)}
                        rows={4}
                        className="w-full bg-gray-800 text-white px-3 py-2.5 rounded-xl border border-gray-600 focus:outline-none focus:border-blue-500 text-sm resize-y [color-scheme:dark]"
                        placeholder="상세 내용을 입력하세요"
                      />
                    )}
                  </div>
                </div>
              </section>

              {/* ④ 처리 결과 */}
              <section>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">
                  처리 결과
                  {isEditMode && <span className="ml-2 text-blue-400 font-normal normal-case">✎ 편집 중</span>}
                </p>
                <div className="bg-gray-900/50 border border-gray-600 rounded-xl p-4">
                  {!isEditMode ? (
                    <p className="text-white text-sm whitespace-pre-wrap">{selectedReport.result || "-"}</p>
                  ) : (
                    <textarea
                      value={editResult}
                      onChange={(e) => setEditResult(e.target.value)}
                      rows={4}
                      className="w-full bg-gray-800 text-white px-3 py-2.5 rounded-xl border border-gray-600 focus:outline-none focus:border-blue-500 text-sm resize-y [color-scheme:dark]"
                      placeholder="처리 결과를 입력하세요"
                    />
                  )}
                </div>
              </section>

              {/* ⑤ 완료 여부 */}
              <section>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">
                  완료 여부
                  {isEditMode && <span className="ml-2 text-blue-400 font-normal normal-case">✎ 편집 중</span>}
                </p>
                <div className="bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-4">
                  {!isEditMode ? (
                    <div className="flex items-center gap-3">
                      <CompletedBadge completed={selectedReport.completed} />
                      <span className="text-gray-400 text-sm">
                        {selectedReport.completed ? "이 리포트는 처리 완료되었습니다." : "아직 처리가 완료되지 않은 리포트입니다."}
                      </span>
                    </div>
                  ) : (
                    /* 토글 버튼 */
                    <button
                      type="button"
                      onClick={() => setEditCompleted((prev) => !prev)}
                      className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 border transition-all ${
                        editCompleted
                          ? "bg-green-900/30 border-green-700/60 hover:bg-green-900/50"
                          : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                      }`}
                    >
                      {/* 커스텀 체크박스 */}
                      <span className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        editCompleted
                          ? "bg-green-500 border-green-500"
                          : "bg-transparent border-gray-500"
                      }`}>
                        {editCompleted && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={`text-sm font-bold ${editCompleted ? "text-green-300" : "text-gray-400"}`}>
                        {editCompleted ? "완료됨 — 클릭하여 미완료로 변경" : "미완료 — 클릭하여 완료로 표시"}
                      </span>
                    </button>
                  )}
                </div>
              </section>

              {/* 저장/수정/취소 */ }
              <section>
                  
                {/* 저장 결과 알림 */}
                {saveOk && (
                  <div className="bg-green-900/30 border border-green-700 rounded-xl px-4 py-3 text-green-200 text-sm flex items-center gap-2">
                    ✓ 저장이 완료되었습니다.
                  </div>
                )}
                {saveError && (
                  <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center gap-2">
                    ⚠️ {saveError}
                  </div>
                )}
              </section>
              <section>
                <div className="flex items-center justify-end gap-2">
                  {!isEditMode ? (
                    <button
                      onClick={startEdit}
                      className="px-3 py-2 bg-gray-700 text-white rounded-lg text-xs font-black hover:bg-blue-600 transition-all border border-gray-600"
                    >
                      수정
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="px-3 py-2 bg-gray-700 text-white rounded-lg text-xs font-black hover:bg-gray-600 transition-all border border-gray-600 disabled:opacity-40"
                      >
                        취소
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-black hover:bg-blue-500 transition-all border border-blue-500 disabled:opacity-40 min-w-[64px]"
                      >
                        {saving ? "저장 중..." : "저장"}
                      </button>
                    </>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
