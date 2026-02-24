export interface CompleteSummary {
  totalProcessed?: number;
  safeCount?: number;
  errorCount?: number;
  cautionCount?: number;
  locationErrorCount?: number;
  timeErrorCount?: number;
  clonedCount?: number;
  redundantCount?: number;
  unregisteredCount?: number;
  integrityErrorCount?: number;
}

export interface LogisticsData {
  message?: unknown;
  percent?: number;
  event?: 'init' | 'progress' | 'complete' | string;
  totalProcessed?: number;
  safeCount?: number;
  errorCount?: number;
  cautionCount?: number;
  integrityErrorCount?: number;
}

export interface LogEntry {
  time: string;
  message: string;
}
