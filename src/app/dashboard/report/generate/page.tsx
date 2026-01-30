"use client";
import React, { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportHistory {
  id: string;
  date: string;
  dangerCount: number;
  cautionCount: number;
  fileName: string;
}

export default function ReportGeneratePage() {
  const [history, setHistory] = useState<ReportHistory[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem('reportHistory');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  // PDF 생성 및 다운로드 함수
  const generatePDF = (data: any[]) => {
    const doc = new jsPDF();
    const riskItems = data.filter((item: any) => item.st === 'DANGER' || item.st === 'CAUTION');

    // 1. 헤더 설정
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('Supply Chain Risk Analysis Report', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Risk Items Detected: ${riskItems.length}`, 14, 35);

    // 2. 테이블 데이터 구성
    const tableColumn = ["Status", "EPC Code", "Location", "Event Time", "AI Analysis"];
    const tableRows = riskItems.map(item => [
      item.st,
      item.epcCode,
      item.scanLocation,
      item.eventTime,
      item.st === 'DANGER' ? 'Critical Anomaly Detected' : 'Minor Discrepancy Found'
    ]);

    // 3. 테이블 삽입
    autoTable(doc, {
      startY: 45,
      head: [tableColumn],
      body: tableRows,
      headStyles: { fillColor: [31, 41, 55] }, // Gray-800
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const val = data.cell.raw;
          if (val === 'DANGER') data.cell.styles.textColor = [220, 38, 38]; // Red
          if (val === 'CAUTION') data.cell.styles.textColor = [217, 119, 6]; // Amber
        }
      }
    });

    // 4. 저장
    const fileName = `Risk_Report_${Date.now()}.pdf`;
    doc.save(fileName);
    return fileName;
  };

  const generateNewReport = async () => {
    setIsGenerating(true);

    try {
      // 1. API로부터 최신 데이터 가져오기 (또는 localStorage)
      const response = await fetch('/api/epcis/events');
      const currentData = await response.json();

      if (!currentData || currentData.length === 0) {
        alert("분석할 데이터가 없습니다.");
        setIsGenerating(false);
        return;
      }

      const dangerCount = currentData.filter((d: any) => d.st === 'DANGER').length;
      const cautionCount = currentData.filter((d: any) => d.st === 'CAUTION').length;

      // 2. PDF 생성 및 다운로드 실행
      const savedFileName = generatePDF(currentData);

      // 3. 히스토리 저장
      const newReport = {
        id: `RPT-${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleDateString(),
        dangerCount,
        cautionCount,
        fileName: savedFileName
      };

      const updatedHistory = [newReport, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('reportHistory', JSON.stringify(updatedHistory));
      
    } catch (error) {
      console.error("PDF 생성 오류:", error);
      alert("리포트 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto bg-gray-50">
      <div className="flex justify-between items-end border-b pb-6 bg-white p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-3xl font-black italic uppercase text-gray-900 tracking-tighter">Risk Intelligence</h1>
          <p className="text-gray-500 font-medium">AI 무결성 검증을 통과하지 못한 항목들에 대한 정밀 진단 리포트입니다.</p>
        </div>
        <button 
          onClick={generateNewReport}
          disabled={isGenerating}
          className={`px-8 py-4 rounded-2xl font-black shadow-lg transition-all ${
            isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
          }`}
        >
          {isGenerating ? 'ANALYZING DATA...' : 'GENERATE AI REPORT'}
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Archived Analysis</h3>
        {history.length === 0 ? (
          <div className="p-20 text-center border-2 border-dashed rounded-[40px] text-gray-300 font-bold uppercase">
            No report history found
          </div>
        ) : (
          history.map((item) => (
            <div key={item.id} className="bg-white border-gray-100 border rounded-[32px] p-6 flex items-center justify-between hover:shadow-xl transition-all group">
              <div className="flex items-center space-x-8">
                <div className="bg-blue-50 p-4 rounded-2xl group-hover:bg-blue-600 transition-colors">
                  <svg className="w-8 h-8 text-blue-500 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{item.id}</p>
                  <h4 className="text-lg font-black text-gray-800">{item.fileName}</h4>
                  <p className="text-xs text-gray-400 font-medium">{item.date} • Secured by AI Integrity Check</p>
                </div>
                <div className="flex space-x-6 border-l pl-8">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Danger</p>
                    <p className="text-xl font-black text-red-500">{item.dangerCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Caution</p>
                    <p className="text-xl font-black text-amber-500">{item.cautionCount}</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => alert('히스토리 목록의 파일을 다시 다운로드하려면 서버 저장 로직이 필요합니다. 현재는 즉시 생성만 가능합니다.')}
                className="px-6 py-3 bg-gray-900 text-white rounded-xl text-xs font-black hover:bg-blue-600 transition-all shadow-md"
              >
                DOWNLOAD AGAIN
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}