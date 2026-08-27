import { z } from 'zod';

/**
 * 발표 자료 요약을 리포트 생성이 끝날 때까지만 들고 있는 자리입니다.
 *
 *   키   pulse:deck-summary:{eventCode}:{sessionId}
 *   값   { fileName, summary }의 JSON
 *
 * 이 파일이 키 문자열을 아는 유일한 곳입니다(`lib/storage/submitted.ts`와 같은 규칙).
 *
 * ── 왜 굳이 저장하는가 ──
 * 리포트 생성이 `FAILED`로 끝나면 다시 만들 수 있는데, BE가 재시도에서 `materialSummary`를
 * 받은 값으로 **덮어씁니다.** 자료 요약을 다시 안 실으면 이전 값이 null로 지워집니다.
 *
 * 그런데 생성은 비동기라 실패를 폴링으로 뒤늦게 알게 되고, 그 사이 새로고침이라도 하면 원본
 * `File`은 이미 메모리에서 사라진 뒤입니다. 파일을 다시 고르라고 하면 요약을 한 번 더 만들게
 * 되니 크레딧도 다시 나갑니다.
 *
 * ── 왜 파일은 저장하지 않는가 ──
 * localStorage에는 문자열만 담깁니다. `File`을 base64로 욱여넣으면 33% 부풀어 5MB 할당량에
 * 바로 걸리고, 같은 오리진을 쓰는 `sessionArchive`의 저장까지 통째로 실패시킵니다. 추출한
 * 원문 텍스트(최대 2만 자)를 넣지 않는 것도 같은 이유입니다. 어차피 재시도에 필요한 건
 * 요약문 하나뿐입니다.
 *
 * ── 수명 ──
 * 요약을 만든 시점부터 리포트가 `GENERATED`로 확정될 때까지입니다. 확정되면 BE가
 * `SessionReport.materialSummary`로 보존해 조회에 실어주므로 로컬 사본은 지웁니다.
 */

const storageKey = (eventCode: string, sessionId: number) =>
  `pulse:deck-summary:${eventCode}:${sessionId}`;

const cachedSummarySchema = z.object({
  /** 어느 파일에서 만든 요약인지 화면에 보여줍니다. 새로고침 뒤에 특히 필요합니다. */
  fileName: z.string().min(1),
  summary: z.string().min(1),
});

export type CachedDeckSummary = z.infer<typeof cachedSummarySchema>;

/**
 * 서버에는 localStorage가 없어 항상 `null`입니다. 호출부는 마운트 후에 읽어야 합니다.
 *
 * 시크릿 모드의 접근 차단, 손상된 값, 형태가 바뀐 옛 기록을 전부 `null`로 떨어뜨립니다. 셋 다
 * "들고 있는 게 없다"와 결과가 같고, 여기서 살려봐야 화면이 이상해질 뿐입니다.
 */
export const readDeckSummary = (eventCode: string, sessionId: number): CachedDeckSummary | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(eventCode, sessionId));
    if (raw === null) return null;

    const result = cachedSummarySchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

/** 저장 실패는 무시합니다. 재시도에서 요약을 다시 만들어야 할 뿐 지금 흐름은 이미 끝났습니다. */
export const writeDeckSummary = (
  eventCode: string,
  sessionId: number,
  value: CachedDeckSummary,
): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey(eventCode, sessionId), JSON.stringify(value));
  } catch {
    // 용량 초과 또는 시크릿 모드
  }
};

/** 리포트가 `GENERATED`로 확정된 뒤 부릅니다. 이후로는 서버가 같은 값을 들고 있습니다. */
export const clearDeckSummary = (eventCode: string, sessionId: number): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(storageKey(eventCode, sessionId));
  } catch {
    // 시크릿 모드
  }
};
