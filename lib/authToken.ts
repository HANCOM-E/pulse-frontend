const STORAGE_KEY = 'pulse_access_token';

/**
 * ⚠️ 임시 토큰 보관소입니다.
 *
 * JWT를 localStorage에 둘지 쿠키에 둘지는 아직 팀 미확정이고(축 1 useAuth와 함께 결정),
 * 그 결정 전까지 `/admin/*` 호출이 전부 401로 막혀서 모더레이션 화면을 만들 수가 없어
 * 최소한만 연결해 둔 것입니다.
 *
 * 저장 방식이 확정되면 이 파일만 갈아끼우면 됩니다. `apiClient`는 `getAccessToken()`
 * 한 곳에서만 이 모듈을 참조합니다.
 *
 * 메모리를 우선 보는 이유: SSR에는 localStorage가 없고, 같은 탭 안에서는
 * 매 요청마다 스토리지를 읽을 필요가 없습니다.
 */

let cachedToken: string | null = null;

export const getStoredAccessToken = (): string | null => {
  if (cachedToken) return cachedToken;
  if (typeof window === 'undefined') return null;

  cachedToken = window.localStorage.getItem(STORAGE_KEY);
  return cachedToken;
};

export const setStoredAccessToken = (token: string): void => {
  cachedToken = token;
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, token);
};

export const clearStoredAccessToken = (): void => {
  cachedToken = null;
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
};
