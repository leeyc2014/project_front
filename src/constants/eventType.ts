// 1. 기준이 되는 데이터 하나만 정의 (관리 포인트 단일화)
const BASE_LABELS: Record<string, string> = {
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

// 2. 기존 키와 대문자 키를 모두 포함하는 객체 생성
export const EVENT_TYPE_LABELS: Record<string, string> = {
  ...BASE_LABELS,
  ...Object.fromEntries(
    Object.entries(BASE_LABELS).map(([key, value]) => [key.toUpperCase(), value])
  ),
};