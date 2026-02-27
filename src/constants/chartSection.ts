export const KPI_LABELS = [
  { key: 'unregisteredEpc', label: '미등록 EPC' },
  { key: 'integrityErrorEpc', label: '무결성 오류 EPC' },
  { key: 'clonedEpc', label: '복제 EPC' },
  { key: 'duplicateEpc', label: '중복 EPC' },
  { key: 'invalidHubMove', label: '허용되지 않는 거점 이동' },
  { key: 'impossibleSpeed', label: '불가능한 이동 속도' },
] as const;


export const EVENT_TYPE_DISPLAY_ORDER = [
  '공장',
  '공장창고(In)',
  '공장창고(Out)',
  '물류센터(In)',
  '물류센터(Out)',
  '도매(In)',
  '도매(Out)',
  '소매(In)',
  '소매(Out)',
  '판매완료',
] as const;
