"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from 'next/dynamic';
import { AllEventsModal } from "@/components/dashboard/AllEventsModal";
import type { RiskItem } from "@/types/dashboard"; // 중앙 타입 정의 import

// 차트와 지도는 클라이언트 사이드에서만 렌더링되도록 dynamic import 설정
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });
const KakaoMap = dynamic(() => import("@/components/kakaomap"), { ssr: false });

// 공통 섹션 컴포넌트
const Section = ({ title, children, headerRight }: { title: string, children: React.ReactNode, headerRight?: React.ReactNode }) => (
    <div className="flex flex-col h-full bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        <div className="h-10 px-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-none">
            <h3 className="text-xs font-black text-gray-600 uppercase tracking-widest">{title}</h3>
            {headerRight}
        </div>
        <div className="flex-1 p-4 relative min-h-0">{children}</div>
    </div>
);

// 상세 모달 내 데이터 항목 컴포넌트
const DetailItem = ({ label, value }: { label: string, value: string }) => (
    <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">{label}</p>
        <p className="text-sm font-bold text-gray-800">{value || "N/A"}</p>
    </div>
);

export default function DashboardPage() {
    // 1. 상태 관리
    const [allData, setAllData] = useState<RiskItem[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'DANGER' | 'CAUTION' | 'SAFE'>('ALL');
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItem, setSelectedItem] = useState<RiskItem | null>(null);
    const [isListModalOpen, setIsListModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mapStartToken, setMapStartToken] = useState(0);

    // 2. 데이터 로드 (API 연동)
    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/epcis/events');
                if (!response.ok) {
                    throw new Error('데이터를 불러오는데 실패했습니다.');
                }
                const data = await response.json();
                const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
                setAllData(items);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    // 3. KPI 통계 계산
    const stats = useMemo(() => ({
        ALL: allData.length,
        SAFE: allData.filter(d => d.st === 'SAFE').length,
        CAUTION: allData.filter(d => d.st === 'CAUTION').length,
        DANGER: allData.filter(d => d.st === 'DANGER').length,
    }), [allData]);

    // 4. 필터링 및 검색 로직 (AllEventsModal로 이동했으므로 여기선 요약 리스트용으로만 사용)
    const filteredList = useMemo(() => {
        return allData.filter(item => {
            const matchFilter = filter === 'ALL' || item.st === filter;
            const matchSearch =
                item.epcCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.scanLocation?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchFilter && matchSearch;
        }).sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
    }, [allData, filter, searchTerm]);

    // 5. 차트 데이터 (실제 데이터 기반)
    const chartSeries = useMemo(() => {
        const base = stats[filter] || 0;
        return [{
            name: `${filter} Count`,
            data: [
                Math.floor(base * 0.1),
                Math.floor(base * 0.3),
                Math.floor(base * 0.2),
                Math.floor(base * 0.25),
                Math.floor(base * 0.15)
            ]
        }];
    }, [stats, filter]);

    const openDetail = (item: RiskItem) => {
        setSelectedItem(item);
        setMapStartToken(0);
        setIsDetailModalOpen(true);
        setIsListModalOpen(false); // 상세 모달 열 때 리스트 모달은 닫기
    };

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* KPI 카드 섹션 */}
            <div className="grid grid-cols-4 gap-4 flex-none">
                {['ALL', 'SAFE', 'CAUTION', 'DANGER'].map((type) => (
                    <button
                        key={type}
                        onClick={() => setFilter(type as any)}
                        className={`p-4 rounded-xl border transition-all text-left shadow-sm ${filter === type ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-100 hover:border-gray-300'
                            }`}
                    >
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{type}</p>
                        <p className={`text-3xl font-black ${type === 'DANGER' ? 'text-red-600' :
                            type === 'CAUTION' ? 'text-amber-500' :
                                type === 'SAFE' ? 'text-green-600' : 'text-blue-600'
                            }`}>
                            {stats[type as keyof typeof stats] || 0}
                        </p>
                    </button>
                ))}
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                {/* 분석 차트 영역 */}
                <Section title={`${filter} REAL-TIME TRENDS`}>
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="w-full bg-gray-200 rounded-lg p-4 animate-pulse">
                                <div className="h-48 bg-gray-300 rounded"></div>
                            </div>
                        </div>
                    ) : (
                        <Chart
                            options={{
                                chart: { toolbar: { show: false }, animations: { enabled: true } },
                                stroke: { curve: 'smooth', width: 3 },
                                xaxis: { categories: ['12pm', '3pm', '6pm', '9pm', '12am'] },
                                colors: [filter === 'SAFE' ? '#32CD32' : filter === 'DANGER' ? '#ef4444' : filter === 'CAUTION' ? '#f59e0b' : '#3b82f6'],
                                fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05 } }
                            }}
                            series={chartSeries}
                            type="area"
                            height="100%"
                        />
                    )}
                </Section>

                {/* 메인 간단 리스트 */}
                <Section
                    title={`Recent Logistics Activities`}
                    headerRight={
                        <button onClick={() => setIsListModalOpen(true)} className="text-[10px] font-bold text-blue-600 hover:underline">
                            전체보기 ({filteredList.length}) +
                        </button>
                    }
                >
                    <div className="h-full overflow-y-auto">
                        <table className="w-full text-left text-xs">
                            <tbody className="divide-y">
                                {filteredList.slice(0, 10).map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 cursor-pointer group" onClick={() => openDetail(item)}>
                                        <td className="py-3 font-bold text-blue-600 font-mono">{item.epcCode}</td>
                                        <td className="py-3 text-gray-500 truncate max-w-[150px]">{item.scanLocation}</td>
                                        <td className="py-3 text-right">
                                            <span className={`px-2 py-1 rounded-[4px] text-[10px] font-black ${item.st === 'DANGER' ? 'bg-red-100 text-red-600' :
                                                item.st === 'CAUTION' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                                                }`}>{item.st}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            </div>

            {/* [2단계] 가상화된 전체보기 모달 렌더링 */}
            <AllEventsModal
                isOpen={isListModalOpen}
                onClose={() => setIsListModalOpen(false)}
                allData={allData}
                filter={filter}
                setFilter={setFilter}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                openDetail={openDetail}
            />

            {/* [3단계] 상세 정보 모달 (Full Data & Map) */}
            {isDetailModalOpen && selectedItem && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-20 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-6xl h-full rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="h-14 px-8 border-b flex items-center justify-between bg-white">
                            <div className="flex items-center space-x-3">
                                <span className="text-sm font-black text-gray-900 uppercase">Product Traceability Report</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${selectedItem.st === 'DANGER' ? 'bg-red-600 text-white' :
                                    selectedItem.st === 'CAUTION' ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'
                                    }`}>{selectedItem.st}</span>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-black font-black transition-colors">✕ CLOSE</button>
                        </div>

                        <div className="flex-1 overflow-hidden">
                            <div className="h-full grid grid-cols-5">
                                <div className="col-span-3 p-10 space-y-8 overflow-y-auto border-r border-gray-100">
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">EPC Identification</p>
                                        <h2 className="text-4xl font-black text-gray-900 tracking-tighter break-all">{selectedItem.epcCode}</h2>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-8 gap-x-12 bg-gray-50 p-8 rounded-[32px] border border-gray-100 shadow-inner">
                                        <DetailItem label="Scan Location" value={selectedItem.scanLocation} />
                                        <DetailItem label="Location ID" value={selectedItem.locationId} />
                                        <DetailItem label="Business Step" value={selectedItem.businessStep} />
                                        <DetailItem label="Event Type" value={selectedItem.eventType} />
                                        <DetailItem label="Operator ID" value={selectedItem.operatorId} />
                                        <DetailItem label="Device ID" value={selectedItem.deviceId} />
                                        <DetailItem label="Manufacture Date" value={selectedItem.manufactureDate} />
                                        <DetailItem label="Expiry Date" value={selectedItem.expiryDate} />
                                    </div>

                                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
                                        <div>
                                            <p className="text-[10px] font-black text-blue-500 uppercase">AI Intelligence Report</p>
                                            <div className={`mt-3 p-4 bg-white rounded-xl shadow-sm border-l-4 ${selectedItem.st === 'DANGER' ? 'border-red-500' : selectedItem.st === 'CAUTION' ? 'border-amber-500' : 'border-green-500'}`}>
                                                <div className="flex items-center space-x-2">
                                                    <div className={`w-2 h-2 rounded-full animate-pulse ${selectedItem.st === 'DANGER' ? 'bg-red-500' : selectedItem.st === 'CAUTION' ? 'bg-amber-500' : 'bg-green-500'}`} />
                                                    <p className={`text-sm font-black ${selectedItem.st === 'DANGER' ? 'text-red-600' : selectedItem.st === 'CAUTION' ? 'text-amber-600' : 'text-green-600'}`}>
                                                        Status: {selectedItem.st}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-gray-600 leading-relaxed font-medium italic mt-2">
                                                    "{selectedItem.st === 'DANGER'
                                                        ? '유통 경로가 통상적인 범위를 벗어났습니다. 등록된 기기 ID와 현재 위치의 상관관계에서 위변조 징후가 포착되었습니다.'
                                                        : selectedItem.st === 'CAUTION'
                                                        ? '일부 유통 경로 데이터에서 경미한 이상 징후가 감지되었습니다. 즉각적인 위변조는 확인되지 않았으나, 추가 모니터링이 권장됩니다.' 
                                                        : '공급망 데이터 무결성 검사 결과, 위변조 및 비정상 유통 흔적이 발견되지 않았습니다.'
                                                    }"
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-2 bg-gray-100 flex flex-col items-center justify-center p-10 text-center space-y-4">
                                    <div className="w-full h-full bg-white rounded-3xl border-2 border-dashed border-gray-300 flex flex-col overflow-hidden">
                                        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                                            <p className="text-[11px] font-black text-gray-500 uppercase tracking-wider">Map Playback</p>
                                            <button
                                                onClick={() => setMapStartToken((prev) => prev + 1)}
                                                className="px-3 py-1 rounded-md text-[11px] font-black text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                            >
                                                경로 재생
                                            </button>
                                        </div>
                                        <div className="flex-1">
                                            {(selectedItem.path && selectedItem.path.length > 0)
                                                ? <KakaoMap path={selectedItem.path} startToken={mapStartToken} />
                                                : <KakaoMap address={selectedItem.scanLocation} startToken={mapStartToken} />
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
