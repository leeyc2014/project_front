# 서비스 기능 명세 (Functional Specification)

이 프로젝트는 EPCIS 기반 물류 로그를 업로드/분석하고 리스크 리포트를 생성하는 **공급망 이상 징후 모니터링 대시보드**입니다.  
핵심 기능은 **로그 업로드 → 리스크 분류 → 대시보드 시각화 → PDF 리포트 생성** 흐름으로 구성됩니다.

---

## 1) 서비스 개요
- **목적**: EPCIS 이벤트 로그를 수집하여 위험 상태(DANGER/CAUTION/SAFE)를 분류하고, 대시보드에서 실시간 추이/상세 추적 정보를 제공.
- **핵심 사용자**: 물류/공급망 운영자, 리스크 관리자, 품질/감사 담당자.
- **주요 가치**: 이상 징후 탐지, 리스크 아이템 추적, 자동 리포트 생성(PDF).

---

## 2) 사용자 플로우
1. **로그인 페이지** 접속 (`/`)
2. **로그 데이터 업로드** (`/dashboard/report/upload`)
3. **대시보드 분석** (`/dashboard`)
4. **리스크 리포트 생성** (`/dashboard/report/generate`)

---

## 3) 화면/라우트 상세

### A. 로그인 (`/`)
- 사용자 ID/비밀번호 입력 폼
- 로그인 성공 시 `/dashboard`로 이동
- 소셜 로그인 버튼 제공 (Google/Naver/Kakao/GitHub)
- 비밀번호 찾기 링크(`/find`) 제공
- **주의**: 실제 로그인 API(`/api/login`)는 코드에 정의되지 않음(미구현)

### B. 비밀번호 찾기 (`/find`)
- **아이디 존재 여부 확인 단계** → **비밀번호 변경 단계**의 2단계 흐름
- 아이디 검증은 `userid === 'admin'` 조건으로 더미 처리
- 비밀번호 변경 조건:
  - 신규 비밀번호/확인 비밀번호 일치
  - 최소 6자 이상
- 변경 성공 시 로그인 페이지(`/`)로 이동
- **주의**: 실제 서버 연동 없이 클라이언트 로컬 흐름으로만 구현

### C. 대시보드 레이아웃 (`/dashboard`, `/dashboard/*`)
공통 상단 네비게이션 및 서브메뉴 제공
- 메인 메뉴: **대시보드 / 진단 리포트**
- 서브메뉴:
  - 대시보드: 종합 현황, 실시간 감시(placeholder), 위험 이력 분석(placeholder)
  - 리포트: 리포트 생성, 로그 업로드
- 사용자 정보 표시 및 로그아웃 아이콘(실제 동작 미구현)

### D. 대시보드 메인 (`/dashboard`)
**EPCIS 이벤트 데이터 기반 종합 현황**

#### 1) KPI 카드
- ALL, SAFE, CAUTION, DANGER 상태별 개수 표시
- 카드 클릭 시 필터 변경

#### 2) 실시간 추이 차트
- 상태별 데이터 흐름을 영역 차트(ApexCharts)로 시각화
- 실데이터 기반은 아니며, 상태별 개수로 더미 시계열 생성

#### 3) 최근 활동 리스트
- 최신 10건 표시
- EPC Code, Location, Status 표시
- 클릭 시 상세 모달 오픈

#### 4) 전체 리스트 모달
- 모든 이벤트 목록 표시
- 상태 필터(ALL/SAFE/CAUTION/DANGER)
- 검색 (EPC Code, Location)
- 상세 보기 버튼 제공

#### 5) 상세 모달 (트레이서빌리티 리포트)
- EPC 식별자 및 이벤트 상세 정보 표시
- AI 분석 메시지 (상태에 따라 문구 변경)
- **지도 표시**: Kakao Map 기반 이동 경로 또는 위치 표시

---

### E. 로그 업로드 (`/dashboard/report/upload`)
**CSV/TSV 파일 업로드 → 이벤트 데이터 저장**

#### 1) 업로드 방식
- 클릭 업로드
- 드래그&드롭 업로드

#### 2) 지원 파일 확장자
- `.csv`, `.txt` (탭 구분 시 TSV로 인식)

#### 3) 파싱 로직
- 첫 행을 헤더로 사용
- 지원 헤더:
  - `scan_location`
  - `location_id`
  - `hub_type`
  - `business_step`
  - `event_type`
  - `operator_id`
  - `device_id`
  - `epc_code`
  - `epc_header`
  - `epc_company`
  - `epc_product`
  - `epc_lot`
  - `event_time`
  - `manufacture_date`
  - `expiry_date`

#### 4) 리스크 상태 생성 로직 (더미)
- 10번째마다 DANGER, 7번째마다 CAUTION, 나머지는 SAFE

#### 5) 업로드 결과
- `/api/epcis/events`로 POST 전송
- 성공 시 업로드 완료 화면 → 대시보드로 이동 버튼 제공

---

### F. 리포트 생성 (`/dashboard/report/generate`)
**PDF 리포트 자동 생성 및 히스토리 관리**

#### 1) 리포트 생성
- `/api/epcis/events`에서 최신 데이터 가져옴
- DANGER/CAUTION 항목만 리포트에 포함
- jsPDF + autoTable 사용

#### 2) 리포트 내용
- 제목, 생성 시간, 위험 항목 수
- 테이블 컬럼:
  - Status
  - EPC Code
  - Location
  - Event Time
  - AI Analysis (DANGER/CAUTION 메시지)

#### 3) 히스토리 저장
- 로컬 스토리지 `reportHistory`에 기록
- 생성된 파일명, 날짜, 위험 개수 보관
- 재다운로드 버튼은 서버 저장 미구현으로 안내 메시지 출력

---

## 4) API 명세

### `GET /api/epcis/events`
- 설명: 저장된 EPCIS 이벤트 목록 반환
- 응답: `RiskItem[]`
- 저장소: **메모리 변수 (`epcisEvents`)**  
  → 서버 재시작 시 데이터 소실

### `POST /api/epcis/events`
- 설명: 업로드된 로그 데이터 저장
- 요청 Body: `RiskItem[]`
- 동작: 기존 데이터를 새 데이터로 **완전히 교체**
- 응답: `{ message: "Data uploaded successfully" }`

---

## 5) 데이터 모델 (RiskItem)
```
id: string
epcCode: string
scanLocation: string
locationId: string
hubType: string
businessStep: string
eventType: string
operatorId: string
deviceId: string
epcHeader: string
epcCompany: string
epcProduct: string
epcLot: string
eventTime: string
manufactureDate: string
expiryDate: string
st: "DANGER" | "CAUTION" | "SAFE"
msg: string
location: string
destination: string
path: { lat: number, lng: number, isAnomaly?: boolean, desc?: string }[]
```

---

## 6) 지도 기능 (Kakao Map)
- `NEXT_PUBLIC_KAKAO_MAP_KEY` 환경변수 필요
- `path`가 있으면 경로 + 마커 표시
- `address`만 있으면 지오코딩 후 단일 위치 표시
- 이상 징후 위치는 빨간색 마커로 표시

---

## 7) 기술 스택
- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- ApexCharts (차트)
- jsPDF + autoTable (PDF)
- Kakao Maps API

---

## 8) 제한 사항 / 미구현 영역
- `/api/login` 미구현 (로그인 실제 인증 로직 없음)
- 비밀번호 찾기/변경 서버 연동 없음
- 로그 데이터는 메모리 저장 → 서버 재시작 시 소실
- 대시보드 일부 서브메뉴는 placeholder 링크
- 리포트 재다운로드 기능 미구현 (서버 저장 필요)

---

## 9) 실행 방법
```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속
