import { feedbackViewSchema, type FeedbackView } from '@/lib/schemas/api';
import { z } from 'zod';

/**
 * 강연자 화면이 모아두는 세션 소감 기록입니다.
 *
 * 공개 스냅샷은 최근 50건만 실어줍니다(`RECENT_FEEDBACK_LIMIT`). 집계 숫자는 서버가 전량으로
 * 내려주므로 화면 상단 타일과 도넛에는 문제가 없지만, 시간대별 추이만은 소감마다 `createdAt`이
 * 있어야 그릴 수 있어서 스냅샷 한 장으로는 50건 너머를 복원할 수 없습니다.
 *
 * 대신 스트림이 2초마다 최신 50건을 통째로 다시 밀어줍니다. 화면이 열려 있는 동안 들어온 건은
 * 여기에 쌓으면 빠짐없이 모입니다. 그래서 이 기록이 담는 것은 "강연자가 화면을 켜둔 구간"의
 * 추이입니다 — 켜기 전에 들어온 소감은 마지막 50건까지만 잡힙니다. 화면이 이 한계를 문구로
 * 알려야 합니다.
 *
 *   키   pulse:archive:{eventCode}:{sessionId}
 *   값   FeedbackView 배열의 JSON
 *
 * 이 파일이 키 문자열을 아는 유일한 곳입니다(`lib/storage/submitted.ts`와 같은 규칙).
 */

const storageKey = (eventCode: string, sessionId: number) =>
  `pulse:archive:${eventCode}:${sessionId}`;

/**
 * 들고 있을 최대 건수입니다. 넘으면 오래된 것부터 버립니다.
 *
 * 추이 차트는 5분 칸이라 오래된 소감일수록 한 점에 뭉쳐서, 앞쪽을 잘라도 최근 구간의
 * 모양은 그대로입니다. 상한이 없으면 종일 켜둔 화면이 localStorage 할당량을 넘겨 저장이
 * 통째로 실패합니다.
 */
const ARCHIVE_LIMIT = 500;

const archiveSchema = z.array(feedbackViewSchema);

/**
 * 새로 온 스냅샷을 이미 모아둔 기록에 얹습니다.
 *
 * 이미 있는 `id`는 덮어쓰지 않습니다. 공개 뷰의 필드는 제출 뒤에 바뀌지 않아서 덮어쓸 이유가
 * 없고, 새 건이 하나도 없을 때 **같은 배열 참조를 그대로 돌려주기 위해서**이기도 합니다.
 * 스트림이 2초마다 오는데 매번 새 배열을 만들면 소감이 안 들어오는 동안에도 화면이 계속
 * 다시 그려집니다.
 *
 * ⚠️ 주최자가 숨긴 소감은 다음 스냅샷부터 빠지지만 이 기록에는 남습니다. 상단 타일과 도넛은
 * 서버 집계를 그대로 쓰므로 영향이 없고, 추이 차트만 그 건을 계속 셉니다. 공개 뷰에 `status`가
 * 없어서(계약상 의도적 제외) 화면이 숨김 여부를 알 방법이 없습니다.
 *
 * 순수 함수라 저장소를 건드리지 않습니다. 이래야 `environment: 'node'`인 vitest가 붙습니다.
 */
const mergeArchive = (previous: FeedbackView[], incoming: FeedbackView[]): FeedbackView[] => {
  const byId = new Map(previous.map((feedback) => [feedback.id, feedback]));
  const added = incoming.filter((feedback) => !byId.has(feedback.id));

  if (added.length === 0) return previous;

  added.forEach((feedback) => byId.set(feedback.id, feedback));

  /* 오래된 것부터 버리므로 시간순으로 세워둡니다. 차트도 이 순서를 그대로 씁니다. */
  return [...byId.values()]
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .slice(-ARCHIVE_LIMIT);
};

/**
 * 서버에는 localStorage가 없어 항상 빈 배열입니다. 호출부는 마운트 후에 읽어야 합니다.
 *
 * 시크릿 모드의 접근 차단, 손상된 값, 그리고 계약이 바뀐 옛 기록을 모두 빈 배열로 떨어뜨립니다.
 * 셋 다 "모아둔 게 없다"와 결과가 같고, 여기서 살려봐야 차트가 이상해질 뿐입니다.
 */
const readArchive = (eventCode: string, sessionId: number): FeedbackView[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey(eventCode, sessionId));
    if (raw === null) return [];

    const parsed = archiveSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

/** 저장 실패는 무시합니다. 추이 차트가 새로고침 뒤 짧아질 뿐 화면은 그대로 돕니다. */
const writeArchive = (
  eventCode: string,
  sessionId: number,
  feedbacks: FeedbackView[],
): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey(eventCode, sessionId), JSON.stringify(feedbacks));
  } catch {
    // 용량 초과 또는 시크릿 모드
  }
};

export { mergeArchive, readArchive, writeArchive, ARCHIVE_LIMIT };
