import type { FilterState } from '@/types/dashboard';

export const DEFAULT_FILTERS: FilterState = {
  factoryLocationTypes: [],
  warehouseLocationTypes: [],
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