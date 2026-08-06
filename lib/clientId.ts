const STORAGE_KEY = 'pulse_client_id';

/**
 * 익명 브라우저 식별자입니다. 소감 제출 시 `X-Client-Id` 헤더로 보냅니다.
 *
 * 서버는 `(sessionId, X-Client-Id)`로 분당 3회 제한을 겁니다.
 * IP만 쓰면 강연장 공용 WiFi(NAT)에서 참가자 전원이 한 덩어리로 묶여
 * 서로의 제출 횟수를 잡아먹기 때문에 브라우저 단위 식별자가 필요합니다.
 *
 * 참가자 추적이 목적이 아니라 어뷰징 방지용이라 개인정보는 담지 않습니다.
 */
export const getClientId = (): string => {
  // SSR에는 localStorage가 없습니다. 제출은 클라이언트에서만 일어납니다.
  if (typeof window === 'undefined') return 'server';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  const created = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
};
