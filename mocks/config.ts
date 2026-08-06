/**
 * 목 서버 활성화 여부입니다.
 *
 * 기본값은 "개발 중에는 켬"입니다. 팀원이 환경변수를 따로 세팅하지 않아도
 * `npm run dev` 한 번으로 목이 붙게 하려는 것이고, 프로덕션 빌드에서는
 * 환경변수와 무관하게 항상 꺼집니다(실 서버 응답을 목이 가로채면 안 됩니다).
 *
 * 실제 백엔드에 붙여볼 때만 `.env.local`에 아래를 추가하면 됩니다.
 *   NEXT_PUBLIC_API_MOCKING=disabled
 */
export const isMockingEnabled =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_API_MOCKING !== 'disabled';
