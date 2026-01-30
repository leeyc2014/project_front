// src/types/dashboard.ts

// 지도 경로의 각 지점에 대한 인터페이스
export interface PathPoint {
    lat: number;
    lng: number;
    isAnomaly?: boolean;
    desc?: string;
}

// EPCIS 이벤트 및 물류 리스크 아이템에 대한 통합 인터페이스
export interface RiskItem {
    id: string; // 로컬 식별용
    epcCode: string;
    scanLocation: string;
    locationId: string;
    hubType: string;
    businessStep: string;
    eventType: string;
    operatorId: string;
    deviceId: string;
    epcHeader: string;
    epcCompany: string;
    epcProduct: string;
    epcLot: string;
    eventTime: string;
    manufactureDate: string;
    expiryDate: string;
    st: 'DANGER' | 'CAUTION' | 'SAFE';
    msg: string;
    location: string;
    destination: string;
    path: PathPoint[]; // 지도 경로 데이터
}
