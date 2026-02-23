export interface RouteData {
  count: number;
  cautionCount?: number;
  errorCount?: number;
  source_info: { id: string; name: string; coords: [number, number] };
  target_info: { id: string; name: string; coords: [number, number] };
  epc_list: string[];
}

export type TrackingPoint = {
  coords: [number, number];
  t: number;
  label: string;
};

export type LogisticsMapProps = {
  epcFilter?: string[] | null;
  routes?: RouteData[];
  trackingPath?: TrackingPoint[] | null;
  resetToken?: number;
  viewportPadding?: { top: number; bottom: number; left: number; right: number };
  onRouteStatusSelect?: (status: 'SAFE' | 'CAUTION' | 'DANGER') => void;
  patternAnimationEnabled?: boolean;
};
