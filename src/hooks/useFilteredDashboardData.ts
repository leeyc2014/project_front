import { useMemo, useState } from 'react';
import { RiskItem, FilterState, DEFAULT_FILTERS } from '@/types/dashboard';

export function useFilteredDashboardData(backendEvents: RiskItem[], uploadedEvents: RiskItem[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // 1. 데이터 통합 및 중복 제거
  const primaryEvents = useMemo(() => {
    const merged = [...backendEvents, ...uploadedEvents];
    const seen = new Set();
    return merged.filter(e => {
      const key = `${e.epcCode}|${e.eventTime || ''}|${e.eventType || ''}|${e.detailIndex ?? ''}|${e.scanLocation || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [backendEvents, uploadedEvents]);

  // 2. 필터 옵션 생성 (백엔드 컬럼 -> 프론트 변수명 매핑)
  // 3. 실제 필터링 로직 (프론트 상태값 기준)
  const filteredEvents = useMemo(() => {
    const normalizeDate = (value: string) => (value || '').slice(0, 10);
    return primaryEvents.filter(e => {
      const locationFilters = [
        ...(filters.factoryLocationTypes || []),
        ...(filters.logisticCenterLocationTypes || []),
        ...(filters.salerLocationTypes || []),
        ...(filters.retailerLocationTypes || []),
      ];
      if (locationFilters.length && !locationFilters.includes(e.locationId)) return false;
      if (filters.operatorIds.length && !filters.operatorIds.includes(e.operatorId)) return false;
      if (filters.deviceIds.length && !filters.deviceIds.includes(e.deviceId)) return false;
      if (filters.epcCompanies.length && !filters.epcCompanies.includes(e.epcCompany)) return false;
      if (filters.epcProducts.length && !filters.epcProducts.includes(e.epcProduct)) return false;
      if (filters.epcCode && !e.epcCode.toLowerCase().includes(filters.epcCode.toLowerCase())) return false;
      if (filters.epcLot != null && e.epcLot !== filters.epcLot) return false;
      if (filters.epcSerial != null && e.epcSerial !== filters.epcSerial) return false;
      if (filters.eventTimeStart && new Date(e.eventTime) < new Date(filters.eventTimeStart)) return false;
      if (filters.eventTimeEnd && new Date(e.eventTime) > new Date(filters.eventTimeEnd)) return false;
      if (filters.manufactureDate && normalizeDate(e.manufactureDate) !== normalizeDate(filters.manufactureDate)) return false;
      if (filters.expiryDate && normalizeDate(e.expiryDate) !== normalizeDate(filters.expiryDate)) return false;
      return true;
    });
  }, [primaryEvents, filters]);

  return { filters, setFilters, filteredEvents };
}
