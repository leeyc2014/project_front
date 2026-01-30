"use client";
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function LogUploadPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'UPLOADING' | 'COMPLETED'>('IDLE');
    const [progress, setProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false); // 드래그 중인지 감지하는 상태

    // CSV(TSV) 문자열을 JSON 객체 배열로 변환하는 함수
    const parseCSV = (csvText: string) => {
        const lines = csvText.split(/\r?\n/).map(line => line.trim());
        if (lines.length < 2) return [];

        const delimiter = csvText.includes("\t") ? "\t" : ",";
        const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

        return lines.slice(1).filter(line => line !== "").map((line, index) => {
            const values = line.split(delimiter).map(v => v.trim());
            const getVal = (headerName: string) => {
                const idx = headers.indexOf(headerName.toLowerCase());
                return idx !== -1 ? values[idx] : "";
            };

            const rawData = {
                scanLocation: getVal("scan_location"),
                locationId: getVal("location_id"),
                hubType: getVal("hub_type"),
                businessStep: getVal("business_step"),
                eventType: getVal("event_type"),
                operatorId: getVal("operator_id"),
                deviceId: getVal("device_id"),
                epcCode: getVal("epc_code"),
                epcHeader: getVal("epc_header"),
                epcCompany: getVal("epc_company"),
                epcProduct: getVal("epc_product"),
                epcLot: getVal("epc_lot"),
                eventTime: getVal("event_time"),
                manufactureDate: getVal("manufacture_date"),
                expiryDate: getVal("expiry_date"),
            };

            const status: 'DANGER' | 'CAUTION' | 'SAFE' =
                (index % 10 === 0) ? 'DANGER' : (index % 7 === 0) ? 'CAUTION' : 'SAFE';

            return {
                id: `LOG-${index}-${Date.now()}`,
                ...rawData,
                msg: `[${rawData.businessStep}] ${rawData.scanLocation} 스캔됨`,
                st: status,
                location: rawData.scanLocation,
                destination: rawData.locationId,
                path: [
                    { lat: 36.5, lng: 127.5, desc: "출발지" },
                    {
                        lat: 37.5 + (index * 0.01),
                        lng: 126.9 + (index * 0.01),
                        isAnomaly: status === 'DANGER',
                        desc: rawData.scanLocation
                    }
                ]
            };
        });
    };

    // 공통 파일 처리 로직
    const processFile = (file: File) => {
        if (!file) return;

        // 파일 형식 체크 (CSV/TSV)
        if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
            alert("CSV 또는 TSV 파일만 업로드 가능합니다.");
            return;
        }

        setUploadStatus('UPLOADING');
        const reader = new FileReader();

        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setProgress(percent);
            }
        };

        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const parsedData = parseCSV(text);

                const response = await fetch('/api/epcis/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsedData),
                });

                if (!response.ok) throw new Error('서버 저장 실패');

                setTimeout(() => setUploadStatus('COMPLETED'), 800);
            } catch (error) {
                console.error("Upload Error:", error);
                alert("데이터 업로드 중 오류가 발생했습니다.");
                setUploadStatus('IDLE');
                setProgress(0);
            }
        };
        reader.readAsText(file);
    };

    // 1. 클릭 업로드 핸들러
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    // 2. 드래그 관련 핸들러들
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true); // 드래그 영역 진입 시 상태 변경
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false); // 드래그 영역 이탈 시 상태 해제
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    return (
        <div className="h-full max-w-4xl mx-auto flex flex-col justify-center p-6 space-y-8">
            <div className="text-center">
                <h2 className="text-4xl font-black text-gray-900 italic uppercase tracking-tighter">Log Data Import</h2>
                <p className="text-gray-500 mt-3 font-medium">EPCIS 표준 로그를 업로드하여 AI 무결성 검사 리포트를 생성합니다.</p>
            </div>

            {uploadStatus === 'IDLE' && (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`group h-96 border-4 border-dashed rounded-[50px] flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${isDragging
                            ? 'border-blue-600 bg-blue-100/50 scale-[1.02]'
                            : 'border-gray-200 bg-transparent hover:border-blue-500 hover:bg-blue-50/50'
                        }`}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv, .txt"
                        className="hidden"
                    />

                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 transition-all duration-300 shadow-sm ${isDragging ? 'bg-blue-600 scale-110' : 'bg-gray-100 group-hover:bg-blue-500 group-hover:scale-110'
                        }`}>
                        <svg className={`w-12 h-12 transition-colors ${isDragging ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>

                    <p className={`text-xl font-black transition-colors ${isDragging ? 'text-blue-700' : 'text-gray-800'}`}>
                        {isDragging ? '파일을 여기에 놓으세요!' : 'CSV 파일을 클릭하거나 드래그하세요'}
                    </p>

                    <div className="mt-4 flex space-x-2">
                        {['EPC_CODE', 'LOCATION', 'EVENT_TIME', 'LOT_NO'].map(tag => (
                            <span key={tag} className="px-3 py-1 bg-gray-100 text-[10px] font-bold text-gray-400 rounded-full">{tag}</span>
                        ))}
                    </div>
                </div>
            )}

            {uploadStatus === 'UPLOADING' && (
                <div className="bg-white p-20 rounded-[50px] shadow-2xl border border-gray-100 text-center space-y-8 animate-in fade-in zoom-in">
                    <div className="relative w-40 h-40 mx-auto">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle className="text-gray-100 stroke-current" strokeWidth="10" fill="transparent" r="40" cx="50" cy="50" />
                            <circle className="text-blue-600 stroke-current transition-all duration-500 ease-out" strokeWidth="10" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * progress) / 100} strokeLinecap="round" fill="transparent" r="40" cx="50" cy="50" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-blue-600">{progress}%</div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-2xl font-black text-gray-900 tracking-tight italic uppercase">Analyzing Patterns...</p>
                        <p className="text-gray-400 font-medium italic text-sm font-mono">Verifying Supply Chain Integrity</p>
                    </div>
                </div>
            )}

            {uploadStatus === 'COMPLETED' && (
                <div className="bg-gray-900 p-16 rounded-[50px] text-white shadow-2xl animate-in zoom-in duration-500">
                    <div className="flex items-center space-x-8 mb-10">
                        <div className="w-20 h-20 bg-green-500 rounded-[24px] flex items-center justify-center shadow-2xl shadow-green-500/40 animate-bounce">
                            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div>
                            <h3 className="text-4xl font-black tracking-tighter uppercase italic">Success</h3>
                            <p className="text-gray-400 font-medium">데이터 세트가 성공적으로 대시보드에 매핑되었습니다.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-full py-6 bg-blue-600 hover:bg-blue-500 rounded-[24px] font-black text-2xl transition-all shadow-xl shadow-blue-600/30 hover:scale-[1.02] active:scale-95"
                    >
                        데이터 분석 결과 확인 (GO DASHBOARD)
                    </button>
                </div>
            )}
        </div>
    );
}