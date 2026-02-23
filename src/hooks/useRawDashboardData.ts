import { useState, useEffect, useCallback, useRef } from 'react';
import { FilterOptions, RiskItem, FilterState } from '@/types/dashboard';
import type { LocationItem } from '@/types/useRawDashboardData';

export function useRawDashboardData(
  page?: number,
  size?: number,
  status: 'ALL' | 'SAFE' | 'CAUTION' | 'DANGER' = 'ALL',
  filters: FilterState | null = null
) {
  const [backendEvents, setBackendEvents] = useState<RiskItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    factoryLocationTypes: [],
    logisticCenterLocationTypes: [],
    salerLocationTypes: [],
    retailerLocationTypes: [],
    operatorIds: [],
    deviceIds: [],
    epcCompanies: [],
    epcProducts: [],
  });
  const [locationList, setLocationList] = useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastDeniedListRequestRef = useRef<string>('');

  const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '';

  const getToken = () => {
    if (typeof window === 'undefined') return '';
    const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return sessionStorage.getItem('token') || '';
  };

  const normalizeBackendEvent = useCallback((raw: any): RiskItem[] => {
    const safe = (v: any) => v == null ? '' : String(v).trim();
    const safeNumber = (v: any) => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const resolveLogisMoveId = (detail?: any) =>
      safeNumber(
        detail?.logisMoveId ??
        detail?.logis_move_id ??
        detail?.logisLogId ??
        detail?.logis_log_id ??
        detail?.logisMove?.id ??
        detail?.id ??
        raw.logisMoveId ??
        raw.logis_move_id ??
        raw.logisLogId ??
        raw.logis_log_id ??
        raw.logisMove?.id ??
        raw.id
      );
    const toStatus = (value: any): RiskItem['st'] => {
      const rawValue = safe(value).toUpperCase();
      if (rawValue === 'DANGER') return 'DANGER';
      if (rawValue === 'CAUTION') return 'CAUTION';
      if (rawValue === 'SAFE') return 'SAFE';
      return 'SAFE';
    };
    const base = {
      epcCode: safe(raw.epcCode || raw.epc_code),
      locationId: safe(raw.locationId || raw.location_id || ''),
      eventType: safe(raw.eventType || raw.event_type || ''),
      operatorId: safe(raw.operatorId || raw.operator_id || ''),
      deviceId: safe(raw.deviceId || raw.device_id || ''),
      epcHeader: safe(raw.epcHeader || raw.epc_header || ''),
      epcCompany: safe(raw.epcCompany || raw.epc_company || ''),
      productName: safe(raw.productName || raw.product_name || raw.epcProduct || raw.epc_product),
      epcProduct: safe(raw.epcProduct || raw.epc_product || raw.productName || raw.product_name),
      eventTime: safe(raw.eventTime || raw.event_time || ''),
      manufactureDate: safe(raw.manufactureDate || raw.manufacture_date || raw.epc_manufacture || ''),
      expiryDate: safe(raw.expiryDate || raw.expiry_date || ''),
      st: toStatus(raw.checkResult ?? raw.st ?? raw.status),
      path: Array.isArray(raw.path) ? raw.path : [],
    };

    if (Array.isArray(raw.details) && raw.details.length > 0) {
      return raw.details.map((detail: any, index: number) => ({
        id: safe(raw.id || raw.logisLogId || `${base.epcCode}-${detail?.epcSerial ?? 'unknown'}-${index}`),
        logisMoveId: resolveLogisMoveId(detail),
        epcCode: base.epcCode,
        scanLocation: safe(detail?.locationName || detail?.scanLocation || ''),
        locationId: safe(detail?.locationId || detail?.location_id || base.locationId),
        eventType: safe(detail?.eventType || detail?.event_type || base.eventType),
        operatorId: safe(detail?.operatorId || detail?.operator_id || base.operatorId),
        deviceId: safe(detail?.deviceId || detail?.device_id || base.deviceId),
        epcHeader: base.epcHeader,
        epcCompany: base.epcCompany,
        productName: base.productName,
        epcProduct: base.epcProduct,
        epcLot: safeNumber(detail?.epcLot ?? detail?.epc_lot),
        epcSerial: safeNumber(detail?.epcSerial ?? detail?.epc_serial),
        eventTime: safe(detail?.eventTime || detail?.event_time || base.eventTime),
        manufactureDate: base.manufactureDate,
        expiryDate: base.expiryDate,
        detailIndex: index,
        st: base.st,
        aiCheck: safe(detail?.aiCheck ?? detail?.ai_check),
        ruleCheck: safe(detail?.ruleCheck ?? detail?.rule_check),
        path: base.path,
      }));
    }

    return [{
      id: safe(raw.id || raw.logisLogId || `${base.epcCode}-${base.eventTime}`),
      logisMoveId: resolveLogisMoveId(),
      epcCode: base.epcCode,
      scanLocation: safe(raw.scanLocation || raw.locationName || raw.location_id || raw.locationId),
      locationId: base.locationId,
      eventType: base.eventType,
      operatorId: base.operatorId,
      deviceId: base.deviceId,
      epcHeader: base.epcHeader,
      epcCompany: base.epcCompany,
      productName: base.productName,
      epcProduct: base.epcProduct,
      epcLot: safeNumber(raw.epcLot ?? raw.epc_lot),
      epcSerial: safeNumber(raw.epcSerial ?? raw.epc_serial),
      eventTime: base.eventTime,
      manufactureDate: base.manufactureDate,
      expiryDate: base.expiryDate,
      st: base.st,
      aiCheck: safe(raw.aiCheck ?? raw.ai_check),
      ruleCheck: safe(raw.ruleCheck ?? raw.rule_check),
      path: base.path,
    }];
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        // Clear stale list immediately when query conditions (status/page/filter) change.
        setBackendEvents([]);
        setTotalPages(1);
        setTotalElements(0);
        const safeJson = async (res: Response, requestUrl: string) => {
          const text = await res.text();
          if (!res.ok) {
            console.error(`Fetch Error: ${res.status} ${res.statusText} (${requestUrl})`, text);
            return null;
          }
          if (!text) return null;
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        };
        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const toQueryList = (list: string[] | undefined) => {
          const values = (list || [])
            .map((value) => String(value).trim())
            .filter((value) => value.length > 0 && value !== '0');
          return values.length ? values.join(',') : '';
        };
        const setIfPresent = (params: URLSearchParams, key: string, value: string) => {
          if (value) params.set(key, value);
        };

        const query = new URLSearchParams();

        if (status !== 'ALL') {
          query.set('status', status);
        }
        if (typeof page === 'number' && Number.isFinite(page) && page >= 0) {
          query.set('page', String(Math.max(0, page)));
        }
        if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
          query.set('size', String(Math.max(1, size)));
        }

        setIfPresent(query, 'factoryLocations', toQueryList(filters?.factoryLocationTypes));
        setIfPresent(query, 'logisticCenterLocations', toQueryList(filters?.logisticCenterLocationTypes));
        setIfPresent(query, 'salerLocations', toQueryList(filters?.salerLocationTypes));
        setIfPresent(query, 'retailerLocations', toQueryList(filters?.retailerLocationTypes));
        setIfPresent(query, 'operators', toQueryList(filters?.operatorIds));
        setIfPresent(query, 'devices', toQueryList(filters?.deviceIds));
        setIfPresent(query, 'companies', toQueryList(filters?.epcCompanies));
        setIfPresent(query, 'products', toQueryList(filters?.epcProducts));
        setIfPresent(query, 'epcCode', (filters?.epcCode || '').trim());
        setIfPresent(query, 'epcLot', filters?.epcLot != null ? String(filters.epcLot) : '');
        setIfPresent(query, 'epcSerial', filters?.epcSerial != null ? String(filters.epcSerial) : '');
        setIfPresent(query, 'eventTimeStart', filters?.eventTimeStart || '');
        setIfPresent(query, 'eventTimeEnd', filters?.eventTimeEnd || '');
        setIfPresent(query, 'manufactureDate', filters?.manufactureDate || '');
        setIfPresent(query, 'expiryDate', filters?.expiryDate || '');

        const queryString = query.toString();
        const listUrl = queryString
          ? `${backendBaseUrl}/api/v1/logis-move/totallist?${queryString}`
          : `${backendBaseUrl}/api/v1/logis-move/totallist`;

        const maxAttempts = 40;
        let evtRes: any = null;
        let deniedToken: string | null = null;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (controller.signal.aborted) return;
          const token = getToken();
          if (!token) {
            await wait(250);
            continue;
          }
          const deniedKey = `${listUrl}|${token}`;
          if (lastDeniedListRequestRef.current === deniedKey) {
            break;
          }

          const res = await fetch(listUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });

          if (res.status === 401 || res.status === 403) {
            await res.text();
            lastDeniedListRequestRef.current = deniedKey;
            if (deniedToken && deniedToken === token) {
              break;
            }
            deniedToken = token;
            await wait(300);
            continue;
          }

          lastDeniedListRequestRef.current = '';
          evtRes = await safeJson(res, listUrl);
          break;
        }

        const extractList = (payload: any): any[] => {
          if (Array.isArray(payload)) return payload;
          if (!payload || typeof payload !== 'object') return [];
          if (Array.isArray(payload.content)) return payload.content;
          if (Array.isArray(payload.items)) return payload.items;
          if (Array.isArray(payload.data)) return payload.data;

          const nested = payload.data || payload.result || payload.response;
          if (nested && typeof nested === 'object') {
            if (Array.isArray(nested.content)) return nested.content;
            if (Array.isArray(nested.items)) return nested.items;
            if (Array.isArray(nested.data)) return nested.data;
          }
          return [];
        };

        const list = extractList(evtRes);
        const totalPagesFromPayload =
          (evtRes as any)?.totalPages ||
          (evtRes as any)?.data?.totalPages ||
          (evtRes as any)?.result?.totalPages ||
          1;
        const totalElementsFromPayload =
          (evtRes as any)?.totalElements ??
          (evtRes as any)?.data?.totalElements ??
          (evtRes as any)?.result?.totalElements;

        if (Array.isArray(evtRes)) {
          const safePage = typeof page === 'number' && Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
          const total = list.length;
          const safeSize = typeof size === 'number' && Number.isFinite(size) && size > 0 ? Math.floor(size) : 15;
          const totalPages = Math.max(1, Math.ceil(total / safeSize));
          const start = safePage * safeSize;
          const end = start + safeSize;
          const paged = list.slice(start, end);
          setTotalPages(totalPages);
          setTotalElements(total);
          setBackendEvents(paged.flatMap(normalizeBackendEvent));
        } else {
          setTotalPages(totalPagesFromPayload || 1);
          setTotalElements(Number.isFinite(Number(totalElementsFromPayload)) ? Number(totalElementsFromPayload) : list.length);
          setBackendEvents(list.flatMap(normalizeBackendEvent));
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.error("Fetch Error:", err);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
    return () => {
      controller.abort();
    };
  }, [backendBaseUrl, normalizeBackendEvent, page, size, status, filters]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchOptions = async () => {
      try {
        const safeJson = async (res: Response) => {
          if (!res.ok) return null;
          const text = await res.text();
          if (!text) return null;
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        };
        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const maxAttempts = 5;
        let initRes: any = null;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (controller.signal.aborted) return;
          const token = getToken();
          if (!token) {
            await wait(300);
            continue;
          }
          const authHeaders = { Authorization: `Bearer ${token}` };
          initRes = await fetch(
            `${backendBaseUrl}/api/v1/dashboard/init-data`,
            { headers: authHeaders, signal: controller.signal }
          ).then(safeJson);
          if (initRes) break;
          await wait(300);
        }

        const normalizeOptions = (value: any): { key: string; value: string }[] => {
          const list = Array.isArray(value)
            ? value
            : (value?.content || value?.items || value?.data || []);
          return Array.isArray(list)
            ? list
                .filter(Boolean)
                .map((item: any) => ({
                  key: String(item?.id ?? item?.key ?? item?.value ?? item),
                  value: String(item?.label ?? item?.value ?? item?.name ?? item),
                }))
            : [];
        };
        const filters = (initRes?.filters || initRes || {}) as any;
        const rawLocationList = (initRes?.locationList ||
          initRes?.data?.locationList ||
          initRes?.result?.locationList ||
          []) as any[];

        setFilterOptions({
          factoryLocationTypes: normalizeOptions(filters.factoryLocationList || filters.factoryLocations || filters.factoryLocationTypes),
          logisticCenterLocationTypes: normalizeOptions(filters.logisticCenterLocationList || filters.logisticCenterLocations || filters.logisticCenterLocationTypes),
          salerLocationTypes: normalizeOptions(filters.salerLocationList || filters.salerLocations || filters.salerLocationTypes),
          retailerLocationTypes: normalizeOptions(filters.retailerLocationList || filters.retailerLocations || filters.retailerLocationTypes),
          operatorIds: normalizeOptions(filters.operatorList || filters.operators || filters.operatorIds),
          deviceIds: normalizeOptions(filters.deviceList || filters.devices || filters.deviceIds),
          epcProducts: normalizeOptions(filters.productList || filters.products || filters.epcProducts),
          epcCompanies: normalizeOptions(filters.companyList || filters.companies || filters.epcCompanies),
        });

        setLocationList(
          Array.isArray(rawLocationList)
            ? rawLocationList
                .filter(Boolean)
                .map((item: any) => ({
                  locationId: item?.locationId ?? item?.location_id ?? '',
                  locationName: String(item?.locationName ?? item?.location_name ?? '').trim(),
                  longtitude: Number.isFinite(Number(item?.longtitude)) ? Number(item.longtitude) : null,
                  longitude: Number.isFinite(Number(item?.longitude)) ? Number(item.longitude) : null,
                  latitude: Number.isFinite(Number(item?.latitude)) ? Number(item.latitude) : null,
                  lat: Number.isFinite(Number(item?.lat)) ? Number(item.lat) : null,
                  lng: Number.isFinite(Number(item?.lng)) ? Number(item.lng) : null,
                  type: String(item?.type ?? '').trim() || undefined,
                }))
                .filter((item) => String(item.locationId).trim() && item.locationName)
            : []
        );
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.error("Fetch Error:", err);
        }
      }
    };
    fetchOptions();
    return () => {
      controller.abort();
    };
  }, [backendBaseUrl]);

  return { backendEvents, filterOptions, locationList, totalPages, totalElements, isLoading };
}
