"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from 'next/dynamic';
import { AllEventsModal } from "@/components/dashboard/AllEventsModal";
import type { RiskItem } from "@/types/dashboard";

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });
const KakaoMap = dynamic(() => import("@/components/kakaomap"), { ssr: false });

const Section = ({ title, children, headerRight }: { title: string, children: React.ReactNode, headerRight?: React.ReactNode }) => (
    <div className="flex flex-col h-full bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        <div className="h-10 px-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-none">
            <h3 className="text-xs font-black text-gray-600 uppercase tracking-widest">{title}</h3>
            {headerRight}
        </div>
        <div className="flex-1 p-4 relative min-h-0">{children}</div>
    </div>
);

const DetailItem = ({ label, value }: { label: string, value: string }) => (
    <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">{label}</p>
        <p className="text-sm font-bold text-gray-800">{value || "N/A"}</p>
    </div>
);

export default function DashboardPage() {
    const [displayData, setDisplayData] = useState<RiskItem[]>([]);
    const [stats, setStats] = useState({ ALL: 0, SAFE: 0, CAUTION: 0, DANGER: 0 });
    const [filter, setFilter] = useState<'ALL' | 'DANGER' | 'CAUTION' | 'SAFE'>('ALL');
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    
    const [selectedItem, setSelectedItem] = useState<RiskItem | null>(null);
    const [isListModalOpen, setIsListModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [allData, setAllData] = useState<RiskItem[]>([]);
    const [mapStartToken, setMapStartToken] = useState(0);

    // [핵심] 서버 API 호출 로직
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 서버에 필터와 검색어를 보내서 필요한 만큼만 가져옴
                const res = await fetch(`/api/epcis/events?status=${filter}&search=${searchTerm}&limit=50`);
                const result = await res.json();
                
                setDisplayData(result.items); // 화면엔 50개만
                setStats(result.stats);       // KPI 숫자는 92만 건 기반 통계
            } catch (error) {
                console.error("Fetch Error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        const debounce = setTimeout(fetchData, 300); // 검색 시 타이핑마다 호출 방지
        return () => clearTimeout(debounce);
    }, [filter, searchTerm]);

    const chartSeries = useMemo(() => [{
        name: 'Logistics Vol.',
        data: [stats.ALL / 5, stats.ALL / 3, stats.ALL / 2, stats.ALL / 4, stats.ALL / 6] // 예시용
    }], [stats.ALL]);

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* KPI 카드 섹션 */}
            <div className="grid grid-cols-4 gap-4 flex-none">
                {['ALL', 'SAFE', 'CAUTION', 'DANGER'].map((type) => (
                    <button
                        key={type}
                        onClick={() => setFilter(type as any)}
                        className={`p-4 rounded-xl border transition-all text-left shadow-sm ${
                            filter === type ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-100 hover:border-gray-300'
                        }`}
                    >
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{type}</p>
                        <p className={`text-3xl font-black ${
                            type === 'DANGER' ? 'text-red-600' : type === 'CAUTION' ? 'text-amber-500' : type === 'SAFE' ? 'text-green-600' : 'text-blue-600'
                        }`}>
                            {stats[type as keyof typeof stats].toLocaleString()}
                        </p>
                    </button>
                ))}
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                <Section title={`${filter} TRENDS (OVERALL)`}>
                    <Chart
                        options={{
                            chart: { toolbar: { show: false } },
                            stroke: { curve: 'smooth' },
                            xaxis: { categories: ['12pm', '3pm', '6pm', '9pm', '12am'] },
                            colors: ['#3b82f6']
                        }}
                        series={chartSeries}
                        type="area"
                        height="100%"
                    />
                </Section>

                <Section 
                    title="Recent Logistics Activities"
                    headerRight={
                        <button onClick={() => setIsListModalOpen(true)} className="text-[10px] font-bold text-blue-600">
                            전체보기 +
                        </button>
                    }
                >
                    <div className="h-full overflow-y-auto">
                        <table className="w-full text-left text-xs">
                            <tbody className="divide-y">
                                {isLoading ? (
                                    <tr><td className="py-4 text-center text-gray-400">Loading...</td></tr>
                                ) : displayData.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => {setSelectedItem(item); setIsDetailModalOpen(true);}}>
                                        <td className="py-3 font-bold text-blue-600 font-mono">{item.epcCode}</td>
                                        <td className="py-3 text-gray-500">{item.scanLocation}</td>
                                        <td className="py-3 text-right">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black ${
                                                item.st === 'DANGER' ? 'bg-red-100 text-red-600' : item.st === 'CAUTION' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                                            }`}>{item.st}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            </div>

            {/* 모달들은 기존 UI 유지 */}
            <AllEventsModal 
                isOpen={isListModalOpen} 
                onClose={() => setIsListModalOpen(false)} 
                allData={displayData} // 여기도 페이징이 필요하면 추가 수정 가능
                filter={filter} setFilter={setFilter}
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                openDetail={(item) => {setSelectedItem(item); setIsDetailModalOpen(true);}}
            />
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