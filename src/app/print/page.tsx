"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { convertMessage } from "@/utils/aiMessageUtil";
import { EVENT_TYPE_LABELS } from "@/constants/eventType";



// 유형별 진단 레이블 상수
const STATUS_LABELS: Record<string, string> = {
  unregisteredEpc: '미등록 EPC',
  integrityErrorEpc: '무결성 오류 EPC',
  clonedEpc: '복제 EPC',
  redundantEpc: '중복 EPC',
  invalidLocationMove: '허용되지 않는 거점 이동',
  impossibleSpeed: '불가능한 이동 속도',
};

function PrintReportContent() {
  const searchParams = useSearchParams();
  const fromDate = searchParams.get("from") || "";
  const toDate = searchParams.get("to") || "";
  const productId = searchParams.get("productId") || "";

  const [showDetails, setShowDetails] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 상태
  const [summary, setSummary] = useState({ total: 0, safe: 0, caution: 0, danger: 0 });
  const [kpiList, setKpiList] = useState<any[]>([]);
  const [hubStats, setHubStats] = useState<any[]>([]);
  const [stepStats, setStepStats] = useState<any[]>([]);
  const [dangerList, setDangerList] = useState<any[]>([]);
  const [cautionList, setCautionList] = useState<any[]>([]);
  const [errorList, setErrorList] = useState<any[]>([]);

  const [productName, setProductName] = useState<string>("전체");

  const getToken = () => {
    if (typeof window === 'undefined') return '';
    const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return sessionStorage.getItem('token') || '';
  };

  useEffect(() => {
    if (!fromDate || !toDate) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '';
        const token = getToken();
        const authHeaders = { Authorization: `Bearer ${token}` };

        // 3개 API 병렬 호출
        const [initRes, chartRes, listRes, logisErrorRes] = await Promise.all([
          fetch(`${backendBaseUrl}/api/v1/dashboard/init-data`, { headers: authHeaders }),
          fetch(`${backendBaseUrl}/api/v1/dashboard/chart?products=${productId}&eventTimeStart=${fromDate}&eventTimeEnd=${toDate}`, { headers: authHeaders }),
          fetch(`${backendBaseUrl}/api/v1/logis-move/totallist?products=${productId}&eventTimeStart=${fromDate}&eventTimeEnd=${toDate}&size=999999`, { headers: authHeaders }),
          fetch(`${backendBaseUrl}/api/v1/logis-error?products=${productId}&eventTimeStart=${fromDate}&eventTimeEnd=${toDate}&size=999999`, { headers: authHeaders }),
        ]);

        const initData = await initRes.json();
        const chartData = await chartRes.json();
        const listData = await listRes.json();
        const logisErrorData = await logisErrorRes.json();

        if (productId) {
          const productList = initData.filters?.productList || [];
          const matchedProduct = productList.find((p: any) => String(p.id) === String(productId));
          setProductName(matchedProduct ? matchedProduct.label : `알 수 없는 제품(${productId})`);
        } else {
          setProductName("전체");
        }

        // 1. 종합 요약 계산 (3 API 기준)
        let safe = 0, caution = 0, danger = 0;
        const contents = listData.content || [];
        contents.forEach((item: any) => {
          if (item.checkResult === "SAFE") safe++;
          else if (item.checkResult === "CAUTION") caution++;
          else if (item.checkResult === "DANGER") danger++;
        });
        
        setSummary({ total: contents.length, safe, caution, danger });

        // 2. 유형별 진단 (2 API - kpi)
        setKpiList(chartData.kpi || []);

        // 3. 허브별 진단 (1 API locationList + 2 API hubStatsList)
        const locationMap = new Map(
          (initData.locationList || []).map((loc: any) => [loc.locationId, loc.locationName])
        );
        const mappedHubStats = (chartData.hubStatsList || []).map((hub: any) => ({
          name: locationMap.get(hub.locationId) || `알 수 없는 허브(${hub.locationId})`,
          total: hub.count,
          caution: hub.cautionCount,
          danger: hub.errorCount,
          safe: hub.count - hub.cautionCount - hub.errorCount
        }));
        setHubStats(mappedHubStats);

        // 4. 스텝별 진단 (2 API - eventTypeStatsList)
        // EVENT_TYPE_LABELS 순서대로 정렬하기 위해 Map 활용
        const stepMap = new Map<string, any>((chartData.eventTypeStatsList || []).map((step: any) => [step.eventType, step]));

        const orderedStepStats = Object.keys(EVENT_TYPE_LABELS).map(key => {
          const step = stepMap.get(key);
          if (!step) return null;
          return {
            name: EVENT_TYPE_LABELS[key],
            total: step.count,
            caution: step.cautionCount,
            danger: step.errorCount,
            safe: step.count - step.cautionCount - step.errorCount
          };
        }).filter(Boolean); // 데이터가 있는 스텝만 남김

        setStepStats(orderedStepStats);

        // 5. 진단 물류 목록 분류
        const dList: any[] = [];
        const cList: any[] = [];

        contents.forEach((item: any) => {
          if (item.checkResult === "DANGER") dList.push(item);
          if (item.checkResult === "CAUTION") cList.push(item);
        });

        setDangerList(dList);
        setCautionList(cList);

        const productList = initData.filters?.productList;
        const locationList = initData.locationList;
        
        logisErrorData.forEach((item:any)=>{
          const epcCodeSpl = item.epcCode.split(".").map((t:string)=>Number(t));

          item.epcHeader = epcCodeSpl[0];
          item.epcCompany = epcCodeSpl[1];
          item.epcProduct = epcCodeSpl[2];
          item.epcLot = epcCodeSpl[3];
          item.epcManufacture = epcCodeSpl[4];
          item.epcSerial = epcCodeSpl[5];

          item.productName = productList.find((p: any) => p.id === item.epcProduct)?.label;

          item.locationName = locationList.find((l:any)=>l.locationId === item.locationId)?.locationName;
        })
        setErrorList(logisErrorData);

      } catch (error) {
        console.error("데이터 로딩 중 오류 발생:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [fromDate, toDate, productId]);

  const handlePrint = () => {
    window.print();
  };

  // 포맷팅 헬퍼 함수
  const formatDateTime = (isoString: string) => {
    if (!isoString) return "";
    return isoString.replace("T", " "); // 간단히 T만 공백으로 치환
  };

  const renderDetails = (item: any, type: "DANGER" | "CAUTION" | "ERROR") => {
    const firstDetail = type === "ERROR" ? item : item.details && item.details[0] ? item.details[0] : {};

    return (
      <div key={item.epcCode} className="mb-4 last:mb-0">
        <p className="font-bold">
          {item.productName} (LOT: {firstDetail.epcLot}, SERIAL: {firstDetail.epcSerial}) <span className="text-xs font-normal">- EPC: {item.epcCode}</span>
        </p>
        <ul className="list-disc pl-5 mt-1 text-gray-700">
          {(type === "ERROR" ? [item] : item.details).map((detail: any, idx: number) => {
            if (type === "DANGER" && detail.ruleCheck) {
              return (
                <li key={idx}>
                  <span className="font-semibold text-red-600">위험</span> : {detail.locationName} / {EVENT_TYPE_LABELS[detail.eventType] || detail.eventType} / {formatDateTime(detail.eventTime)} / 사유: {convertMessage(detail.ruleCheck)} ({detail.ruleCheck})
                </li>
              );
            } else if (type === "CAUTION" && detail.aiCheck) {
              return (
                <li key={idx}>
                  <span className="font-semibold text-orange-600">주의</span> : {detail.locationName} / {EVENT_TYPE_LABELS[detail.eventType] || detail.eventType} / {formatDateTime(detail.eventTime)} / 사유: {convertMessage(detail.aiCheck)} ({detail.aiCheck})
                </li>
              );
            } else if(type === "ERROR") {
              return (
                <li key={idx}>
                  <span className="font-semibold text-red-600">오류</span> : {detail.locationName} / {formatDateTime(detail.eventTime)} / 사유 : {STATUS_LABELS[detail.status] || detail.status}
                </li>
              )
            }
            return null;
          })}
        </ul>
      </div>
    );
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-xl">데이터를 불러오는 중입니다...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10 font-sans text-black flex justify-center">
      <div className="w-[210mm] min-h-[297mm] bg-white shadow-xl border border-gray-300 p-12 relative print:w-full print:h-auto print:shadow-none print:border-none print:p-0 print:m-0">

        {/* 상단 컨트롤러 (인쇄 시 숨김) */}
        <div className="absolute top-6 right-12 flex gap-3 print:hidden">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
              className="w-4 h-4"
            />
            상세 목록 표시
          </label>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-black text-white text-sm font-bold rounded hover:bg-gray-800 transition-colors"
          >
            인쇄하기
          </button>
        </div>

        {/* 문서 헤더 */}
        <div className="text-center mb-10 mt-4">
          <h1 className="text-4xl font-bold mb-6">물류 진단 리포트</h1>

          <div className="flex justify-end">
            <table className="text-right">
              <tbody>
                <tr>
                  <td className="pr-4 font-bold">분석 기간 :</td>
                  <td className="text-left"> {fromDate} ~ {toDate}</td>
                </tr>
                <tr>
                  <td className="pr-4 font-bold">대상 제품 :</td>
                  <td className="text-left"> {productName} </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-8">


          <section>
            <h2 className="text-2xl font-bold">위험 물류 요약</h2>
          </section>

          {/* 유형별 진단 */}
          <section>
            <h2 className="text-lg font-bold mb-2">:: 유형별 진단 ::</h2>
            <table className="w-full border-collapse border border-black text-sm">
              <thead className="bg-gray-50 text-center">
                <tr>
                  <th className="border border-black p-2 font-bold w-16">분류</th>
                  <th className="border border-black p-2 font-bold">진단 항목</th>
                  <th className="border border-black p-2 font-bold w-32">발생 건수</th>
                  <th className="border border-black p-2 font-bold w-32">전체 물류 비율 (%)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(STATUS_LABELS).map((statusKey, idx) => {
                  // API에서 받아온 kpiList 배열 안에 현재 항목(statusKey)이 있는지 찾습니다.
                  const foundKpi = kpiList.find(kpi => kpi.status === statusKey);

                  // 데이터가 있으면 그 값을, 없으면 0을 사용합니다.
                  const count = foundKpi ? foundKpi.count : 0;
                  const ratio = foundKpi ? foundKpi.ratio : 0;

                  return (
                    <tr key={idx}>
                      {(idx === 0 || idx === 4) &&<td className="border border-black p-2 text-center" rowSpan={idx === 0 ? 4 : 2}>
                          {idx === 0 ? (<span>데이터<br/>정합성<br/>오류</span>) : (<span>이상<br/>데이터</span>)}
                        </td>}
                      <td className="border border-black p-2">{STATUS_LABELS[statusKey]}</td>
                      <td className="border border-black p-2 text-right">{count.toLocaleString()}</td>
                      <td className="border border-black p-2 text-right">{ratio}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-bold">
                  <td className="border border-black p-2 text-center" colSpan={2}>합계</td>
                  <td className="border border-black p-2 text-right">
                    {kpiList.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()}
                  </td>
                  <td className="border border-black p-2 text-right">
                    {Math.min(100, kpiList.reduce((acc, curr) => acc + curr.ratio, 0)).toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="pt-4">
            <span className="text-2xl font-bold">물류 데이터 통계</span>
            <span className="ml-3 text-end text-sm text-gray-600">※ 데이터 정합성 오류는 포함하지 않습니다.</span>           
          </section>

          {/* 종합 요약 */}
          <section>
            <h2 className="text-lg font-bold mb-2">:: 물류 종합 요약 ::</h2>
            <table className="w-full border-collapse border border-black text-sm text-center">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-black p-2 font-bold w-1/4">안전</th>
                  <th className="border border-black p-2 font-bold w-1/4">주의</th>
                  <th className="border border-black p-2 font-bold w-1/4">위험</th>
                  <th className="border border-black p-2 font-bold w-1/4">합계</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2">{summary.safe.toLocaleString()}</td>
                  <td className={`border border-black p-2 ${summary.caution > 0 ? 'text-orange-600 font-bold' : ''}`}>{summary.caution.toLocaleString()}</td>
                  <td className={`border border-black p-2 ${summary.danger > 0 ? 'text-red-700 font-bold' : ''}`}>{summary.danger.toLocaleString()}</td>
                  <td className="border border-black p-2 font-bold">{summary.total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 허브별 진단 */}
          <section>
            <h2 className="text-lg font-bold mb-2">:: 허브별 진단 ::</h2>
            <table className="w-full border-collapse border border-black text-sm text-center">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-black p-2 font-bold text-left">허브명</th>
                  <th className="border border-black p-2 font-bold w-20">안전</th>
                  <th className="border border-black p-2 font-bold w-20">주의</th>
                  <th className="border border-black p-2 font-bold w-20">위험</th>
                  <th className="border border-black p-2 font-bold w-24">합계</th>
                </tr>
              </thead>
              <tbody>
                {hubStats.map((hub, idx) => (
                  <tr key={idx}>
                    <td className="border border-black p-2 text-left">{hub.name}</td>
                    <td className="border border-black p-2">{hub.safe.toLocaleString()}</td>
                    <td className={`border border-black p-2 ${hub.caution > 0 ? 'text-orange-600 font-bold' : ''}`}>{hub.caution.toLocaleString()}</td>
                    <td className={`border border-black p-2 ${hub.danger > 0 ? 'text-red-700 font-bold' : ''}`}>{hub.danger.toLocaleString()}</td>
                    <td className="border border-black p-2">{hub.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 스텝별 진단 */}
          <section>
            <h2 className="text-lg font-bold mb-2">:: 스텝별 진단 ::</h2>
            <table className="w-full border-collapse border border-black text-sm text-center">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-black p-2 font-bold text-left">스텝명</th>
                  <th className="border border-black p-2 font-bold w-20">안전</th>
                  <th className="border border-black p-2 font-bold w-20">주의</th>
                  <th className="border border-black p-2 font-bold w-20">위험</th>
                  <th className="border border-black p-2 font-bold w-24">합계</th>
                </tr>
              </thead>
              <tbody>
                {stepStats.map((step, idx) => (
                  <tr key={idx}>
                    <td className="border border-black p-2 text-left">{step.name}</td>
                    <td className="border border-black p-2">{step.safe.toLocaleString()}</td>
                    <td className={`border border-black p-2 ${step.caution > 0 ? 'text-orange-600 font-bold' : ''}`}>{step.caution.toLocaleString()}</td>
                    <td className={`border border-black p-2 ${step.danger > 0 ? 'text-red-700 font-bold' : ''}`}>{step.danger.toLocaleString()}</td>
                    <td className="border border-black p-2">{step.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 조건부 렌더링 영역: 상세 목록 (인쇄 및 화면 표시 토글) */}
          {showDetails && (
            <div className="space-y-8 mt-8">
                  
              <section className="pt-4 print:break-before-page">
                <span className="text-2xl font-bold">물류 상세 목록</span>
              </section>
              
              {/* 진단 물류 목록 (위험) */}
              <section>
                <h2 className="text-lg font-bold mb-2 text-red-700">:: 데이터 정합성 오류 ::</h2>
                <div className="min-h-25 border border-black p-4 text-sm whitespace-pre-wrap">
                  {errorList.length === 0 ? (
                    <span className="text-gray-500">데이터 정합성 오류 물류가 없습니다.</span>
                  ) : (
                    errorList.map(item => renderDetails(item, "ERROR"))
                  )}
                </div>
              </section>

              {/* 진단 물류 목록 (위험) */}
              <section>
                <h2 className="text-lg font-bold mb-2 text-red-700">:: 위험 이상 데이터 ::</h2>
                <div className="min-h-25 border border-black p-4 text-sm whitespace-pre-wrap">
                  {dangerList.length === 0 ? (
                    <span className="text-gray-500">위험 물류가 없습니다.</span>
                  ) : (
                    dangerList.map(item => renderDetails(item, "DANGER"))
                  )}
                </div>
              </section>

              {/* 진단 물류 목록 (주의) */}
              <section>
                <h2 className="text-lg font-bold mb-2 text-orange-600">:: 주의 이상 데이터 ::</h2>
                <div className="min-h-25 border border-black p-4 text-sm whitespace-pre-wrap">
                  {cautionList.length === 0 ? (
                    <span className="text-gray-500">주의 물류가 없습니다.</span>
                  ) : (
                    cautionList.map(item => renderDetails(item, "CAUTION"))
                  )}
                </div>
              </section>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function PrintReportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <PrintReportContent />
    </Suspense>
  );
}
