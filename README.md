# LOGIFLOW Frontend

2차원 바코드 기반 물류 공급망 불법 유통 분석 웹 서비스 프론트엔드입니다.  
로그인 이후 대시보드 모니터링, 이상 징후 보고서 처리, 진단 보고서 출력, 회원/바코드 관리, 업로드 분석까지 한 흐름으로 사용합니다.

## 시연 영상
[![LOGIFLOW 시연 영상](https://img.youtube.com/vi/TZ-cmNFeZpk/maxresdefault.jpg)](https://youtu.be/TZ-cmNFeZpk)

## 주요 기능 (필수 7개)
1. 로그인 (`/`)
- ID/비밀번호 로그인
- 백엔드 `/login` 연동
- 성공 시 토큰 저장 후 대시보드 이동

2. 대시보드 (`/dashboard`)
- 지도 기반 물류 이동 시각화 (MapLibre + Deck.gl)
- KPI/허브/이벤트 타입 차트 조회
- 고급 필터(거점/운영자/디바이스/회사/제품/날짜/EPC 등)
- 시리얼별 타임라인 및 상세 조회

3. 이상 징후 리포트 (`/dashboard/anomaly`)
- 이상 징후 보고서 목록/페이징 조회
- 상세 모달 확인, 결과/상세/완료 여부 수정
- 상태 코드 및 메타 데이터 정규화 처리

4. 진단 보고서 (`/dashboard/report`, `/print`)
- 기간(주간/월간) 기반 보고 구간 자동 생성
- 제품 선택 후 보고서 미리보기
- `/print` 페이지에서 인쇄용 진단 보고서 출력

5. 회원 관리 (`/dashboard/members`)
- 관리자 전용 메뉴
- 회원 목록 조회, 등록, 수정(권한/활성 여부 포함)
- 내 계정 수정과 타 계정 수정 분기 처리

6. 바코드 관리 (`/dashboard/manage`)
- 관리자 전용 메뉴
- EPC 목록 조회/상세/페이징
- EPC 신규 등록(회사/제품/LOT/시리얼/제조일/유통기한)
- 선택 EPC QR 코드 렌더링

7. 업로드 (`대시보드 헤더 업로드 위젯`)
- 관리자 전용 CSV 업로드 분석
- `/api/v1/logistics/upload` 스트리밍 응답 기반 진행률/로그 표시
- 이상 항목 요약(위험/주의/복제/중복/무결성/미등록 등) 제공
- 업로드 완료 시 대시보드 데이터 자동 갱신 트리거

## 라우트 요약
- `/` : 로그인
- `/dashboard` : 통합 대시보드
- `/dashboard/anomaly` : 이상 징후 보고서
- `/dashboard/report` : 진단 보고서 기간 생성
- `/dashboard/members` : 회원 관리 (관리자)
- `/dashboard/manage` : 바코드 관리 (관리자)
- `/print` : 인쇄용 진단 보고서

## 실행 방법
### 1) 사전 요구사항
- Node.js `>= 20.9.0`
- npm `>= 9`
- 실행 중인 백엔드 서버

### 2) 환경변수 설정
루트에 `.env.local` 파일을 만들고 백엔드 주소를 설정합니다.

```env
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8080
```

### 3) 의존성 설치
```bash
npm ci
```

### 4) 개발 서버 실행
```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 5) 프로덕션 빌드/실행
```bash
npm run build
npm run start
```

## 기술 스택
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS v4
- MapLibre GL + Deck.gl
- ApexCharts
- Jotai

## 사용 라이브러리
### Runtime
- `next`, `react`, `react-dom`
- `jotai`
- `maplibre-gl`
- `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox`, `@deck.gl/geo-layers`
- `apexcharts`, `react-apexcharts`
- `qrcode.react`, `react-qr-code`
- `react-icons`
- `jspdf`, `jspdf-autotable`
- `@tanstack/react-virtual`

### Dev
- `typescript`
- `eslint`, `eslint-config-next`
- `tailwindcss`, `@tailwindcss/postcss`
- `@types/node`, `@types/react`, `@types/react-dom`
- `babel-plugin-react-compiler`

## 비고
- 관리자 전용: 이상 징후 리포트, 회원 관리, 바코드 관리, 업로드
- 백엔드 API 스펙/권한 정책은 서버 구현에 따릅니다.
