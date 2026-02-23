// src/types/dashboard.ts

// 지도 경로의 각 지점에 대한 인터페이스
export interface PathPoint {
  lat: number;
  lng: number;
  isAnomaly?: boolean;
  desc?: string;
}

// EPCIS 이벤트 및 물류 리스크 아이템에 대한 통합 인터페이스
export interface RiskItem {
  id: string; // 로컬 식별용
  logisMoveId?: number | null;
  epcCode: string;
  scanLocation: string;
  locationId: string;
  eventType: string;
  operatorId: string;
  deviceId: string;
  epcHeader: string;
  epcCompany: string;
  epcProduct: string;
  productName?: string;
  epcLot: number | null;
  epcSerial: number | null;
  eventTime: string;
  manufactureDate: string;
  expiryDate: string;
  detailIndex?: number;
  st: 'DANGER' | 'CAUTION' | 'SAFE';
  msg?: string;
  aiCheck?: string;
  ruleCheck?: string;
  path: PathPoint[]; // 지도 경로 데이터
}

export interface HubMoveStats {
  fromLocationId: string;
  toLocationId: string;
  count: number;
  errorCount: number;
}

export interface KPIResponse {
  unregisteredEpc: number;
  integrityErrorEpc: number;
  clonedEpc: number;
  duplicateEpc: number;
  invalidHubMove: number;
  impossibleSpeed: number;
}

export interface RiskyHub {
  locationId: string;
  count: number;
  errorCount: number;
}

export interface RiskyEventType {
  eventType: string;
  count: number;
  errorCount: number;
}

export interface DashboardResponse {
  hubMoveStats: HubMoveStats[];
  kpi: KPIResponse;
  riskyHubs: RiskyHub[];
  riskyEventTypes: RiskyEventType[];
}

export type FilterState = {
  factoryLocationTypes: string[];
  logisticCenterLocationTypes: string[];
  salerLocationTypes: string[];
  retailerLocationTypes: string[];
  operatorIds: string[];
  deviceIds: string[];
  epcCompanies: string[];
  epcProducts: string[];
  epcCode: string;
  epcLot: number | null;
  epcSerial: number | null;
  eventTimeStart: string;
  eventTimeEnd: string;
  manufactureDate: string;
  expiryDate: string;
};

export type FilterOptions = {
  factoryLocationTypes: { key: string; value: string }[];
  logisticCenterLocationTypes: { key: string; value: string }[];
  salerLocationTypes: { key: string; value: string }[];
  retailerLocationTypes: { key: string; value: string }[];
  operatorIds: { key: string; value: string }[];
  deviceIds: { key: string; value: string }[];
  epcCompanies: { key: string; value: string }[];
  epcProducts: { key: string; value: string }[];
};

export const DEFAULT_FILTERS: FilterState = {
  factoryLocationTypes: [],
  logisticCenterLocationTypes: [],
  salerLocationTypes: [],
  retailerLocationTypes: [],
  operatorIds: [],
  deviceIds: [],
  epcCompanies: [],
  epcProducts: [],
  epcCode: '',
  epcLot: null,
  epcSerial: null,
  eventTimeStart: '',
  eventTimeEnd: '',
  manufactureDate: '',
  expiryDate: '',
};
