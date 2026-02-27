export interface RouteData {
  count: number;
  cautionCount?: number;
  errorCount?: number;
  source_info: { id: string; name: string; coords: [number, number] };
  target_info: { id: string; name: string; coords: [number, number] };
  epc_list: string[];
}

export type AutoZoomSettings = {
  singlePointZoom: number;
  boundsMaxZoom: number;
  durationMs: number;
  offsetX: number;
  offsetY: number;
};

export type LogisticsMapProps = {
  routes?: RouteData[];
  resetToken?: number;
  viewportPadding?: { top: number; bottom: number; left: number; right: number };
  autoFocusKey?: string | null;
  autoZoomSettings?: AutoZoomSettings;
  onRouteLocationSelect?: (fromLocationId: string, toLocationId: string) => void;
  patternAnimationEnabled?: boolean;
};

export type NodeVisualData = {
  nodeId: string;
  position: [number, number];
  label: string;
  color: [number, number, number, number];
  severity: 0 | 1 | 2;
  score: number;
};
