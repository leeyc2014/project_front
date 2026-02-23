export interface CompleteSummary {
  totalProcessed?: number;
  safeCount?: number;
  errorCount?: number;
  cautionCount?: number;
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
