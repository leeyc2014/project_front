// 스텝별 진단 출력 순서 및 레이블 상수
export const EVENT_TYPE_LABELS: Record<string, string> = {
  Aggregation: '공장',
  WMS_Inbound: '공장창고(In)',
  WMS_Outbound: '공장창고(Out)',
  HUB_Inbound: '물류센터(In)',
  HUB_Outbound: '물류센터(Out)',
  W_Stock_Inbound: '도매(In)',
  W_Stock_Outbound: '도매(Out)',
  R_Stock_Inbound: '소매(In)',
  R_Stock_Outbound: '소매(Out)',
  POS_Sell: '판매완료',
};