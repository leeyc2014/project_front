"use client";

import { useMemo, useState, useEffect } from 'react';
import type { RiskItem } from '@/types/dashboard'; // 중앙 타입 정의 import

interface AllEventsModalProps {
    isOpen: boolean;
    onClose: () => void;
    allData: RiskItem[];
    filter: string;
    setFilter: (filter: any) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    // 이 부분의 타입을 정확히 지정해줍니다.
    openDetail: (item: RiskItem) => void; 
}

// --- Pagination Component ---
const Pagination = ({ currentPage, totalPages, onPageChange, onBlockChange }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onBlockChange: (direction: 'prev' | 'next') => void;
}) => {
    const pageBlockSize = 10;
    const currentBlock = Math.floor((currentPage - 1) / pageBlockSize);
    const startPage = currentBlock * pageBlockSize + 1;
    const endPage = Math.min(startPage + pageBlockSize - 1, totalPages);

    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
    }

    return (
        <div className="flex items-center justify-center space-x-2">
            <button
                onClick={() => onBlockChange('prev')}
                disabled={startPage === 1}
                className="px-3 py-1 text-xs font-bold text-gray-600 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
                이전
            </button>
            {pageNumbers.map(number => (
                <button
                    key={number}
                    onClick={() => onPageChange(number)}
                    className={`w-8 h-8 text-xs font-bold rounded-md transition-colors ${currentPage === number
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                        }`}
                >
                    {number}
                </button>
            ))}
            <button
                onClick={() => onBlockChange('next')}
                disabled={endPage >= totalPages}
                className="px-3 py-1 text-xs font-bold text-gray-600 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
                다음
            </button>
        </div>
    );
};


export function AllEventsModal({
    isOpen,
    onClose,
    allData,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    openDetail,
}: AllEventsModalProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // 필터링 로직
    const filteredList = useMemo(() => {
        return allData.filter(item => {
            const matchFilter = filter === 'ALL' || item.st === filter;
            const matchSearch =
                item.epcCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.scanLocation?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchFilter && matchSearch;
        }).sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
    }, [allData, filter, searchTerm]);
    
    // 필터나 검색어가 변경될 때 첫 페이지로 리셋
    useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchTerm]);

    // 페이지네이션 로직
    const paginatedList = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredList.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredList, currentPage]);

    const totalPages = Math.ceil(filteredList.length / itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleBlockChange = (direction: 'prev' | 'next') => {
        const pageBlockSize = 10;
        const currentBlock = Math.floor((currentPage - 1) / pageBlockSize);
        if (direction === 'prev') {
            setCurrentPage(currentBlock * pageBlockSize - pageBlockSize + 1);
        } else {
            setCurrentPage(currentBlock * pageBlockSize + pageBlockSize + 1);
        }
    };


    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-10 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-7xl h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Modal Header */}
                <div className="h-16 px-6 border-b flex items-center justify-between bg-gray-900 text-white flex-none">
                    <div className="flex items-center space-x-6">
                        <h2 className="font-black text-lg uppercase tracking-tight">Supply Chain Inventory ({filteredList.length})</h2>
                        <div className="flex bg-gray-800 rounded-lg p-1">
                            {['ALL', 'SAFE', 'CAUTION', 'DANGER'].map(s => (
                                <button key={s} onClick={() => setFilter(s as any)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${filter === s ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <input
                            type="text"
                            placeholder="EPC Code, 위치 검색..."
                            className="text-xs px-4 py-2 rounded-full bg-gray-800 border-gray-700 text-white w-64 outline-none focus:ring-1 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button onClick={onClose} className="hover:text-red-400 transition-colors font-bold text-xl">✕</button>
                    </div>
                </div>

                {/* Paginated Table */}
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-[11px] font-black text-gray-400 border-b uppercase sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4">EPC Code</th>
                                <th className="p-4">Operator ID</th>
                                <th className="p-4">Device ID</th>
                                <th className="p-4">Event Time</th>
                                <th className="p-4">Manufacture Date</th>
                                <th className="p-4">Expiry Date</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                            {paginatedList.filter((item) => item != null).map((item, index) => (
                                <tr key={item.id ?? `event-${index}`} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-4 font-bold text-blue-600 font-mono tracking-tighter">{item.epcCode}</td>
                                    <td className="p-4">{item.operatorId}</td>
                                    <td className="p-4 text-gray-500">{item.deviceId}</td>
                                    <td className="p-4">{item.eventTime}</td>
                                    <td className="p-4">{item.manufactureDate}</td>
                                    <td className="p-4">{item.expiryDate}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black ${item.st === 'DANGER' ? 'bg-red-100 text-red-600' :
                                            item.st === 'CAUTION' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                                            }`}>{item.st}</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => openDetail(item)} className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold rounded hover:bg-blue-600 transition-colors shadow-sm">상세보기</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredList.length === 0 && <div className="p-20 text-center text-gray-400 font-bold uppercase tracking-widest">No matching data found</div>}
                </div>
                
                {/* Pagination Controls */}
                <div className="flex-none h-16 border-t flex items-center justify-center bg-white">
                    {totalPages > 0 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            onBlockChange={handleBlockChange}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
