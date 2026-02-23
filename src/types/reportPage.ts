export interface PeriodRange {
  from: Date;
  to: Date;
}

export interface Product {
  id: string | number;
  label: string;
}

export type RangeType = 'WEEKLY' | 'MONTHLY';
