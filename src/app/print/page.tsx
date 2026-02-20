// app/report/print/page.tsx
"use client";

import React, { useState } from "react";

export default function PrintReportPage() {
  const [showDetails, setShowDetails] = useState(true);

  // 브라우저 기본 인쇄 기능 호출
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 font-sans text-black flex justify-center">
      {/* 
        A4 사이즈 비율을 모방한 컨테이너.
        @media print에서 그림자, 마진 등을 제거하고 화면을 채우도록 설정합니다.
      */}
      <div className="w-[210mm] min-h-[297mm] bg-white shadow-xl border border-gray-300 p-12 relative print:w-full print:h-auto print:shadow-none print:border-none print:p-0 print:m-0">
        
        {/* 상단 컨트롤러 (인쇄 시 숨김 - print:hidden) */}
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
          <h1 className="text-3xl font-bold mb-6">물류 진단 리포트</h1>
          
          <div className="flex justify-end text-sm">
            <table className="text-right">
              <tbody>
                <tr>
                  <td className="pr-4 font-bold">날짜</td>
                  <td>: 2026-01-04 ~ 2026-01-11</td>
                </tr>
                <tr>
                  <td className="pr-4 font-bold">대상 제품</td>
                  <td>: Product 1</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-8">
          
          {/* 종합 요약 */}
          <section>
            <h2 className="text-lg font-bold mb-2">종합 요약</h2>
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
                  <td className="border border-black p-2">1,200</td>
                  <td className="border border-black p-2">45</td>
                  <td className="border border-black p-2">5</td>
                  <td className="border border-black p-2">1,250</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 유형별 진단 */}
          <section>
            <h2 className="text-lg font-bold mb-2">유형별 진단</h2>
            <table className="w-full border-collapse border border-black text-sm">
              <thead className="bg-gray-50 text-center">
                <tr>
                  <th className="border border-black p-2 font-bold">진단 항목</th>
                  <th className="border border-black p-2 font-bold w-32">발생 건수</th>
                  <th className="border border-black p-2 font-bold w-32">비율</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2">미등록 EPC</td>
                  <td className="border border-black p-2 text-right">12</td>
                  <td className="border border-black p-2 text-right">24.0%</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">무결성 오류 EPC</td>
                  <td className="border border-black p-2 text-right">8</td>
                  <td className="border border-black p-2 text-right">16.0%</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">복제 EPC</td>
                  <td className="border border-black p-2 text-right">3</td>
                  <td className="border border-black p-2 text-right">6.0%</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">중복 EPC</td>
                  <td className="border border-black p-2 text-right">2</td>
                  <td className="border border-black p-2 text-right">4.0%</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">허용되지 않는 거점 이동</td>
                  <td className="border border-black p-2 text-right">15</td>
                  <td className="border border-black p-2 text-right">30.0%</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">불가능한 이동 속도</td>
                  <td className="border border-black p-2 text-right">10</td>
                  <td className="border border-black p-2 text-right">20.0%</td>
                </tr>
                <tr className="bg-gray-50 font-bold">
                  <td className="border border-black p-2 text-center">합계</td>
                  <td className="border border-black p-2 text-right">50</td>
                  <td className="border border-black p-2 text-right">100.0%</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 허브별 진단 */}
          <section>
            <h2 className="text-lg font-bold mb-2">허브별 진단</h2>
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
                <tr>
                  <td className="border border-black p-2 text-left">OO 공장</td>
                  <td className="border border-black p-2">400</td>
                  <td className="border border-black p-2">20</td>
                  <td className="border border-black p-2">2</td>
                  <td className="border border-black p-2">422</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 text-left">물류센터 A</td>
                  <td className="border border-black p-2">500</td>
                  <td className="border border-black p-2">15</td>
                  <td className="border border-black p-2">1</td>
                  <td className="border border-black p-2">516</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 text-left">물류센터 B</td>
                  <td className="border border-black p-2">300</td>
                  <td className="border border-black p-2">10</td>
                  <td className="border border-black p-2">2</td>
                  <td className="border border-black p-2">312</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 스텝별 진단 */}
          <section>
            <h2 className="text-lg font-bold mb-2">스텝별 진단</h2>
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
                <tr>
                  <td className="border border-black p-2 text-left">생산</td>
                  <td className="border border-black p-2">1,000</td>
                  <td className="border border-black p-2">5</td>
                  <td className="border border-black p-2">1</td>
                  <td className="border border-black p-2">1,006</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 text-left">출고</td>
                  <td className="border border-black p-2">150</td>
                  <td className="border border-black p-2">30</td>
                  <td className="border border-black p-2">3</td>
                  <td className="border border-black p-2">183</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 text-left">입고</td>
                  <td className="border border-black p-2">50</td>
                  <td className="border border-black p-2">10</td>
                  <td className="border border-black p-2">1</td>
                  <td className="border border-black p-2">61</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 조건부 렌더링 영역: 상세 목록 (인쇄 및 화면 표시 토글) */}
          {showDetails && (
            <div className="space-y-8 print:break-before-page">
              {/* 진단 물류 목록 (위험) */}
              <section>
                <h2 className="text-lg font-bold mb-2">진단 물류 목록 (위험)</h2>
                <div className="min-h-[150px] border border-black p-4 text-sm whitespace-pre-wrap text-red-600">
                  {/* 실제 데이터가 들어갈 자리 */}
                  EPC: urn:epc:id:sgtin:0614141.107346.2024 (사유: 불가능한 이동 속도)
                  EPC: urn:epc:id:sgtin:0614141.107346.2025 (사유: 무결성 오류 EPC)
                  EPC: urn:epc:id:sgtin:0614141.107346.2026 (사유: 허용되지 않는 거점 이동)
                </div>
              </section>

              {/* 진단 물류 목록 (주의) */}
              <section>
                <h2 className="text-lg font-bold mb-2">진단 물류 목록 (주의)</h2>
                <div className="min-h-[150px] border border-black p-4 text-sm whitespace-pre-wrap text-orange-600">
                  {/* 실제 데이터가 들어갈 자리 */}
                  EPC: urn:epc:id:sgtin:0614141.107346.3001 (사유: 미등록 EPC)
                  EPC: urn:epc:id:sgtin:0614141.107346.3002 (사유: 미등록 EPC)
                  ... (이하 생략)
                </div>
              </section>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
