/**
 * 소감 제출 기록입니다.
 *
 * 서버가 중복 제출을 막지 않아(2026-08-07 명세) 프론트가 로컬에 남겨 안내만 합니다.
 * 저장 형식은 #92에서 확정했습니다.
 *
 *   키   pulse:submitted:{eventCode}
 *   값   sessionId 배열의 JSON        예: [101, 103]
 *
 * 이 파일이 키 문자열을 아는 유일한 곳입니다. 화면에서 localStorage를 직접 부르지
 * 마세요. 오타가 나도 에러가 아니라 "안 남김"으로 조용히 읽혀서 찾기 어렵습니다.
 */

const storageKey = (eventCode: string) => `pulse:submitted:${eventCode}`;

/**
 * 서버에는 localStorage가 없어 항상 빈 배열입니다. 호출부는 첫 렌더에서
 * "안 남김"으로 그렸다가 마운트 후 다시 그려야 합니다.
 *
 * Safari 시크릿 모드는 접근 자체를 막고, 값이 손상됐으면 JSON.parse가 던집니다.
 * 둘 다 빈 배열로 떨어뜨려서 "기록 없음"과 같게 취급합니다.
 */
const read = (eventCode: string): number[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey(eventCode));
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is number => typeof value === 'number');
  } catch {
    return [];
  }
};

/** 저장 실패는 무시합니다. 안내가 안 뜰 뿐 제출 자체는 이미 끝났습니다. */
const write = (eventCode: string, sessionIds: number[]): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey(eventCode), JSON.stringify(sessionIds));
  } catch {
    // 용량 초과 또는 시크릿 모드
  }
};

/** 제출 성공 후 부릅니다. 같은 세션이 두 번 들어가지 않습니다. */
const markSubmitted = (eventCode: string, sessionId: number): void => {
  const submitted = read(eventCode);
  if (submitted.includes(sessionId)) return;

  write(eventCode, [...submitted, sessionId]);
};

/** 한 세션만 볼 때 씁니다. 여러 개를 가릴 때는 listSubmitted를 쓰세요. */
const hasSubmitted = (eventCode: string, sessionId: number): boolean =>
  read(eventCode).includes(sessionId);

/**
 * 칩 여러 개를 한 번에 가릴 때 씁니다. hasSubmitted를 N번 부르면
 * localStorage를 N번 읽습니다.
 */
const listSubmitted = (eventCode: string): Set<number> => new Set(read(eventCode));

export { markSubmitted, hasSubmitted, listSubmitted };
