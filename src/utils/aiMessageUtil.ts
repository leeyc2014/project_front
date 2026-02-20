const AIMessages = {
    "days_since_mfg":"생산일로부터 많이 소요됨",
    "days_to_expiry":"기간 만료",
    "time_delta_min":"이전 스텝에서 소요 시간이 큼",
    "event_hour":"스텝 발생 시각 오류",
    "event_weekday":"스텝 발생 요일 오류",
    "event_type":"스텝 순번 오류",
    "event_type_diff":"이전 스텝과 순번 차이가 큼",
    "region_code_":"지역 코드 오류",
    "dist_km":"이전 스텝과의 거리 오류",
    "speed_kmh":"이전 스텝에서의 이동 속도 오류",
    "device_id_":"장비 오류",
    "operator_id_":"작업자 오류",


    "Abnormal End State:":"마지막 스텝 오류",
    "Impossible Speed:":"불가능한 이동 속도",
    "Invalid Factory-Warehouse Pair:":"공장 출고 다음으로 허용되지 않는 창고",
    "Invalid Flow:":"허용되지 않는 스텝",
    "Invalid Start State:":"허용되지 않은 첫 스텝",
    "Teleportation Error:":"불가능한 이동 속도",
    "Time/Flow Anomaly (Back to Past):":"허용되지 않는 스텝 순서",
}


export const convertMessage = (log:string) => {
    const keys = Object.keys(AIMessages) as Array<keyof typeof AIMessages>;
    const matchedKey = keys.find(key => log.startsWith(key));
    return matchedKey ? AIMessages[matchedKey] : '';
}