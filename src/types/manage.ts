export type EpcRow = {
  epc_code?: string | null;
  epc_manufacture?: string | null;
  epc_company?: string | null;
  epc_lot?: string | number | null;
  epc_header?: string | null;
  epc_product?: string | null;
  epc_serial?: string | number | null;
  expiry_date?: string | null;
  epcCode?: string | null;
  epcManufacture?: string | null;
  epcHeader?: string | number | null;
  epcSerial?: string | number | null;
  manufactureDate?: string | null;
  expiryDate?: string | null;
  company?: {
    epcCompany?: string | number | null;
    companyName?: string | null;
  } | null;
  product?: {
    epcProduct?: string | number | null;
    productName?: string | null;
  } | null;
  lot?: {
    epcLot?: string | number | null;
    lotName?: string | null;
  } | null;
};

export type EpcListResponse =
  | EpcRow[]
  | {
      content?: EpcRow[];
      data?: EpcRow[];
      items?: EpcRow[];
      list?: EpcRow[];
      totalPages?: number;
      totalElements?: number;
      size?: number;
      number?: number;
      first?: boolean;
      last?: boolean;
      numberOfElements?: number;
      empty?: boolean;
    };

export type EpcPageInfo = {
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
};

export type SelectOption = {
  value: string;
  label: string;
};

export type InitDataResponse = {
  filters?: Record<string, unknown>;
  [key: string]: unknown;
};
