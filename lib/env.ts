/**
 * API 기본 주소입니다.
 *
 * `apiClient`(요청을 보내는 쪽)와 MSW 핸들러(가로채는 쪽)가 반드시 같은 문자열을 써야 합니다.
 * 두 값이 어긋나면 에러 없이 목이 그냥 통과돼서, 실제 서버로 요청이 새는 걸
 * 한참 뒤에나 알아차리게 됩니다. 그래서 양쪽 모두 이 상수 하나만 봅니다.
 *
 * 기본값이 절대 주소가 아니라 `/api/proxy`인 이유는, 브라우저가 백엔드에 직접 요청을 보내면
 * 프론트·백엔드 도메인이 달라서 쿠키를 못 읽는 문제(이슈 #139·#140)가 있기 때문입니다.
 * `/api/proxy`로 보낸 요청은 `next.config.ts`의 `rewrites`가 실제 백엔드(`BACKEND_API_URL`
 * 환경변수)로 대신 전달합니다. 이 경로는 로컬(`npm run dev`)·Vercel 배포 양쪽에서 동일하게
 * 동작합니다.
 */
const SERVER_API_BASE_URL = process.env.BACKEND_API_URL ?? 'http://localhost:8080/api/v1';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (typeof window === 'undefined' ? SERVER_API_BASE_URL : '/api/proxy');
