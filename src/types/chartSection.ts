import type { DashboardResponse, RiskItem } from '@/types/dashboard';

export type ChartVariant = 'kpi' | 'hub' | 'eventType';
export type HubDefectTab = 'error' | 'caution' | 'total';

export type ChartSectionProps = {
  variant: ChartVariant;
  data?: Partial<DashboardResponse> | null;
  hubLocationMap?: Record<string, string>;
  hubDefectTab?: HubDefectTab;
  onHubDefectTabChange?: (tab: HubDefectTab) => void;
  onHubLocationSelect?: (locationId: string) => void;
};

export type TimelineModalProps = {
  open: boolean;
  serial: string | null;
  events: RiskItem[];
  onClose: () => void;
  onApplyEpcFilter?: (epcCode: string) => void;
  onClearEpcFilter?: () => void;
  isEpcFilterApplied?: boolean;
};

export type BarOptionsConfig = {
  compact?: boolean;
  xLabelRotate?: number;
  xLabelMaxHeight?: number;
  xLabelFormatter?: (value: string) => string;
  yLabelOffsetX?: number;
  yLabelOffsetY?: number;
  dataLabelsEnabled?: boolean;
  dataLabelFormatter?: (value: number) => string;
  stacked?: boolean;
  showStackTotal?: boolean;
  columnWidth?: string;
  gridPaddingTop?: number;
  gridPaddingBottom?: number;
  colors?: string[];
  horizontal?: boolean;
};

export type XAxisCategory = string | string[];
