"use client";
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function LogUploadPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'UPLOADING' | 'COMPLETED'>('IDLE');
    const [progress, setProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const processFile = async (file: File) => {
        if (!file) return;

        setUploadStatus('UPLOADING');
        setProgress(10); // 시작 표시

        const formData = new FormData();
        formData.append('file', file);

        try {
            // 파일을 스트림으로 직접 전송 (JSON 파싱 X)
            const response = await fetch('/api/epcis/events', {
                method: 'POST',
                body: formData,
                // 주의: FormData를 보낼 때는 Content-Type 헤더를 수동으로 설정하지 마세요.
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '서버 저장 실패');
            }

            setProgress(100);
            setTimeout(() => setUploadStatus('COMPLETED'), 800);
        } catch (error: any) {
            console.error("Upload Error:", error);
            alert(error.message || "데이터 업로드 중 오류가 발생했습니다.");
            setUploadStatus('IDLE');
            setProgress(0);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    return (
        <div className="h-full max-w-4xl mx-auto flex flex-col justify-center p-6 space-y-8">
            <div className="text-center">
                <h2 className="text-4xl font-black text-gray-900 italic uppercase tracking-tighter">Log Data Import</h2>
                <p className="text-gray-500 mt-3 font-medium">대용량 로그도 안정적으로 처리합니다.</p>
            </div>

            {uploadStatus === 'IDLE' && (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`group h-96 border-4 border-dashed rounded-[50px] flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                        isDragging ? 'border-blue-600 bg-blue-100/50 scale-[1.02]' : 'border-gray-200 bg-transparent hover:border-blue-500 hover:bg-blue-50/50'
                    }`}
                >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv, .txt" className="hidden" />
                    <div className="w-24 h-24 bg-gray-100 group-hover:bg-blue-500 rounded-3xl flex items-center justify-center mb-6 transition-all">
                        <svg className="w-12 h-12 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>
                    <p className="text-xl font-black text-gray-800">CSV/TSV 파일을 드래그하거나 클릭하세요</p>
                </div>
            )}

            {uploadStatus === 'UPLOADING' && (
                <div className="bg-white p-20 rounded-[50px] shadow-2xl border border-gray-100 text-center space-y-8">
                    <div className="relative w-40 h-40 mx-auto">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle className="text-gray-100 stroke-current" strokeWidth="10" fill="transparent" r="40" cx="50" cy="50" />
                            <circle className="text-blue-600 stroke-current transition-all duration-500" strokeWidth="10" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * progress) / 100} strokeLinecap="round" fill="transparent" r="40" cx="50" cy="50" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-blue-600">{progress}%</div>
                    </div>
                    <p className="text-2xl font-black italic uppercase">Server Processing Large File...</p>
                </div>
            )}

            {uploadStatus === 'COMPLETED' && (
                <div className="bg-gray-900 p-16 rounded-[50px] text-white shadow-2xl">
                    <div className="flex items-center space-x-8 mb-10">
                        <div className="w-20 h-20 bg-green-500 rounded-[24px] flex items-center justify-center shadow-green-500/40 animate-bounce">
                            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div>
                            <h3 className="text-4xl font-black italic">SUCCESS</h3>
                            <p className="text-gray-400">데이터 매핑 완료</p>
                        </div>
                    </div>
                    <button onClick={() => router.push('/dashboard')} className="w-full py-6 bg-blue-600 hover:bg-blue-500 rounded-[24px] font-black text-2xl transition-all">GO DASHBOARD</button>
                </div>
            )}
        </div>
    );
}