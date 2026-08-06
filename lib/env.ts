/**
 * API 기본 주소입니다.
 *
 * `apiClient`(요청을 보내는 쪽)와 MSW 핸들러(가로채는 쪽)가 반드시 같은 문자열을 써야 합니다.
 * 두 값이 어긋나면 에러 없이 목이 그냥 통과돼서, 실제 서버로 요청이 새는 걸
 * 한참 뒤에나 알아차리게 됩니다. 그래서 양쪽 모두 이 상수 하나만 봅니다.
 *
 * 기본값을 둔 이유는 `.env.local`을 만들지 않은 팀원도 `npm run dev` 한 번으로
 * 목이 붙게 하기 위해서입니다. 실제 백엔드 주소가 다르면 `.env.local`로 덮어씁니다.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1';
