import type { RiskItem } from '@/types/dashboard';

export type SerialListProps = {
  page: number;
  totalPages: number;
  totalElements?: number;
  onPageChange: (page: number) => void;
  statusFilter: 'ALL' | 'SAFE' | 'CAUTION' | 'DANGER';
  onStatusChange: (status: 'ALL' | 'SAFE' | 'CAUTION' | 'DANGER') => void;
  serials: string[];
  eventsBySerial: Record<string, RiskItem[]>;
  activeSerial: string | null;
  onSerialToggle: (serial: string) => void;
};

export type ReportSeverity = 'DANGER' | 'CAUTION' | 'NONE';

export type ReportAnomalyByLocation = {
  location: string;
  messages: { text: string; severity: ReportSeverity; logisMoveId: number | null }[];
}[];

export type InspectionFormProps = {
  isOpen: boolean;
  serialNumber: string;
  anomalyByLocation: ReportAnomalyByLocation;
  onClose: () => void;
};
