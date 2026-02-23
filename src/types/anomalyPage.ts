export interface FilterItem {
  id: number;
  label: string;
}

export interface FilterMaps {
  locationById: Map<number, string>;
  operatorById: Map<number, string>;
  deviceById: Map<number, string>;
  companyById: Map<number, string>;
  productById: Map<number, string>;
}

export interface Location {
  locationId: number;
  locationName: string;
  initial: string;
  longtitude: number;
  latitude: number;
  type: string;
}

export interface Epc {
  epcCode: string;
  company: { epcCompany: number; companyName: string };
  product: { epcProduct: number; productName: string; company: { epcCompany: number; companyName: string } };
  epcSerial: number;
  lot: { epcLot: number; lotName: string | null };
  manufactureDate: string;
  expiryDate: string;
}

export interface LogisMove {
  id: number;
  location: Location;
  hubType: string;
  businessStep: string;
  eventType: string;
  operator: { operatorId: number; operatorName: string; location: Location };
  device: { deviceId: number; deviceName: string; location: Location };
  epc: Epc;
  eventTime: string;
  aiCheck: string | null;
  ruleCheck: string | null;
  epcCode: string;
  operatorId: number;
  deviceId: number;
  locationId: number;
}

export interface AnomalyReport {
  id: number;
  logisMove: LogisMove;
  detail: string;
  result: string;
  reportDate: string;
  completed: boolean;
}

export interface PageInfo {
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
}

export type BadgeColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
