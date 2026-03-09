export const getBackendUrl = () => {
  // 1. 환경 변수가 명시적으로 있으면 최우선 적용
  if (process.env.NEXT_PUBLIC_BACKEND_BASE_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  }

  // 2. 환경 변수가 없고, 브라우저 환경(Client)인 경우
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    // 접속한 주소에 백엔드 포트(예: 8080)만 붙여서 반환
    return `${protocol}//${hostname}:8080`;
  }

  // 3. SSR(서버 사이드)이면서 환경 변수도 없는 경우 (기본값)
  return 'http://localhost:8080';
};