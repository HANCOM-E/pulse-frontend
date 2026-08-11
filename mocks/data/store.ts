import type {
  EventView,
  Feedback,
  FeedbackSnapshot,
  FeedbackView,
  KeywordCount,
  PulseEvent,
  Report,
  Session,
  SentimentBreakdown,
  SessionView,
} from '@/lib/schemas/api';
import { RECENT_FEEDBACK_LIMIT, TOP_KEYWORD_LIMIT } from '@/lib/schemas/api';
import { HOST_USER, seedEvents, seedFeedbacks, seedReports, seedSessions } from '@/mocks/data/seed';

/**
 * MSW 목 서버의 인메모리 저장소입니다.
 *
 * 모더레이션 화면이 소감 상태를 바꾸고 그 결과가 대시보드 집계에 즉시 반영돼야 해서,
 * 핸들러가 정적 fixture를 그대로 반환하지 않고 이 저장소를 거칩니다.
 * 새로고침하면 초기 상태로 돌아갑니다(브라우저 탭 단위 수명).
 */

/**
 * 목 계정입니다. 실제 BE는 `User { id, email, passwordHash }`로 해시를 저장하지만,
 * 목은 로그인 시 대조만 하면 되므로 평문을 그대로 둡니다.
 */
export interface MockAccount {
  id: number;
  email: string;
  password: string;
  /** `AuthUser` 응답에 실립니다. 로그인 때마다 값이 흔들리면 안 되므로 계정에 붙여 둡니다. */
  createdAt: string;
}

interface MockDb {
  accounts: MockAccount[];
  events: PulseEvent[];
  sessions: Session[];
  feedbacks: Feedback[];
  reports: Report[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createDb = (): MockDb => ({
  accounts: [{ ...HOST_USER }],
  events: clone(seedEvents),
  sessions: clone(seedSessions),
  feedbacks: clone(seedFeedbacks),
  reports: clone(seedReports),
});

export const db: MockDb = createDb();

/** 시드 상태로 되돌립니다. 테스트에서 케이스 간 격리가 필요할 때 사용합니다. */
export const resetDb = (): void => {
  const fresh = createDb();
  db.accounts = fresh.accounts;
  db.events = fresh.events;
  db.sessions = fresh.sessions;
  db.feedbacks = fresh.feedbacks;
  db.reports = fresh.reports;
  submissionLog.clear();
};

// ─────────────────────────────────────────────────────────────
// id 채번
// ─────────────────────────────────────────────────────────────

const nextId = (values: { id: number }[]): number =>
  values.reduce((max, value) => Math.max(max, value.id), 0) + 1;

export const nextAccountId = (): number => nextId(db.accounts);
export const nextEventId = (): number => nextId(db.events);
export const nextSessionId = (): number => nextId(db.sessions);
export const nextFeedbackId = (): number => nextId(db.feedbacks);
export const nextReportId = (): number => nextId(db.reports);

/**
 * 이벤트 code는 nanoid로 자동 생성됩니다(요구사항 "2. 이벤트 생성"). 목에서는 길이만 맞춥니다.
 *
 * code가 모든 경로의 유일 키가 됐으므로(2026-08-06 명세) 중복이 나오면 다시 뽑습니다.
 * 삭제된 이벤트의 code도 여전히 점유 상태로 봅니다 — 소프트 삭제라 행이 남아 있습니다.
 */
export const generateEventCode = (): string => {
  let code = Math.random().toString(36).slice(2, 8);
  while (db.events.some((event) => event.code === code)) {
    code = Math.random().toString(36).slice(2, 8);
  }
  return code;
};

// ─────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────

/** 로그인·가입 모두 이메일로 계정을 찾습니다(요구사항 "2. 로그인" 1단계, 이메일은 UNIQUE). */
export const findAccountByEmail = (email: string): MockAccount | undefined =>
  db.accounts.find((account) => account.email === email);

/** `GET /auth/me`가 씁니다. 쿠키에 담긴 토큰에서 계정 id를 되찾아 조회합니다. */
export const findAccountById = (id: number): MockAccount | undefined =>
  db.accounts.find((account) => account.id === id);

/** DELETED 이벤트는 조회 대상에서 빠집니다(요구사항 "6. 이벤트 삭제"). */
export const findEventByCode = (code: string): PulseEvent | undefined =>
  db.events.find((event) => event.code === code && event.status !== 'DELETED');

/**
 * 소프트 삭제된 이벤트까지 포함해서 찾습니다. `DELETE /events/{eventCode}` 전용입니다.
 * 재삭제를 404가 아니라 EVENT_ALREADY_DELETED(409)로 구분하려면 삭제된 행도 보여야 합니다.
 */
export const findEventRowByCode = (code: string): PulseEvent | undefined =>
  db.events.find((event) => event.code === code);

export const findSessionById = (sessionId: number): Session | undefined =>
  db.sessions.find((session) => session.id === sessionId);

export const findFeedbackById = (feedbackId: number): Feedback | undefined =>
  db.feedbacks.find((feedback) => feedback.id === feedbackId);

/** 소프트 삭제되지 않은 세션. 공개 목록으로 나갈 수 있는 것만 이 타입을 얻습니다. */
export type OpenSession = Session & { status: SessionView['status'] };

const isOpenSession = (session: Session): session is OpenSession => session.status !== 'DELETED';

/**
 * `DELETED`만 빠집니다. `CLOSED`(피드백 마감)는 남습니다 — 세션은 생성 시 `CLOSED`이므로
 * (2026-08-07 명세) `ACTIVE`만 세면 방금 만든 세션이 목록에서 사라지고,
 * `PATCH /events/{eventCode}` 의 "세션 1개 이상" 검사도 통과할 수 없게 됩니다.
 */
export const listSessionsOfEvent = (eventId: number): OpenSession[] =>
  db.sessions
    .filter((session) => session.eventId === eventId)
    .filter(isOpenSession)
    .sort((a, b) => a.order - b.order);

/** 소감은 세션에 달리므로, 이벤트 단위 조회는 항상 세션을 한 번 거칩니다. */
export const listFeedbacksOfEvent = (eventId: number): Feedback[] => {
  const sessionIds = new Set(
    db.sessions.filter((session) => session.eventId === eventId).map((session) => session.id),
  );
  return db.feedbacks.filter((feedback) => sessionIds.has(feedback.sessionId));
};

export const findEventOfSession = (sessionId: number): PulseEvent | undefined => {
  const session = findSessionById(sessionId);
  if (!session) return undefined;
  return db.events.find((event) => event.id === session.eventId);
};

export const findReportByEventId = (eventId: number): Report | undefined =>
  db.reports.find((report) => report.eventId === eventId);

// ─────────────────────────────────────────────────────────────
// 집계 (GET /events/{eventCode}/feedbacks)
// ─────────────────────────────────────────────────────────────

/**
 * 저장소 행을 공개 응답 모양으로 좁힙니다.
 *
 * 핸들러가 행을 그대로 반환하면 내부 `id`·`ownerId`가 딸려 나갑니다. 명세가 공개뷰에서
 * 이들을 뺐으므로(2026-08-06) 공개 경로는 반드시 이 변환을 거쳐야 합니다.
 */
export const toEventView = (event: PulseEvent): EventView => ({
  code: event.code,
  title: event.title,
  description: event.description,
  status: event.status,
  createdAt: event.createdAt,
});

export const toSessionView = (session: OpenSession): SessionView => ({
  id: session.id,
  title: session.title,
  order: session.order,
  status: session.status,
});

export const toFeedbackView = (feedback: Feedback): FeedbackView => ({
  id: feedback.id,
  sessionId: feedback.sessionId,
  text: feedback.text,
  sentiment: feedback.sentiment,
  keywords: feedback.keywords,
  createdAt: feedback.createdAt,
});

/**
 * 서버 집계 스냅샷을 만듭니다. VISIBLE 소감만 대상이며,
 * UNKNOWN은 감정 분포에서 빼고 unclassifiedCount로 따로 셉니다.
 */
export const buildSnapshot = (eventId: number, sessionId?: number): FeedbackSnapshot => {
  const visible = listFeedbacksOfEvent(eventId)
    .filter((feedback) => feedback.status === 'VISIBLE')
    .filter((feedback) => sessionId === undefined || feedback.sessionId === sessionId);

  const sentimentBreakdown: SentimentBreakdown = { POS: 0, NEU: 0, NEG: 0 };
  let unclassifiedCount = 0;
  const keywordCounts = new Map<string, number>();

  for (const feedback of visible) {
    if (feedback.sentiment === 'UNKNOWN') {
      unclassifiedCount += 1;
    } else {
      sentimentBreakdown[feedback.sentiment] += 1;
    }
    for (const keyword of feedback.keywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
  }

  const topKeywords: KeywordCount[] = [...keywordCounts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, TOP_KEYWORD_LIMIT);

  const recentFeedbacks = [...visible]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, RECENT_FEEDBACK_LIMIT)
    .map(toFeedbackView);

  return { sentimentBreakdown, unclassifiedCount, topKeywords, recentFeedbacks };
};

// ─────────────────────────────────────────────────────────────
// 제출 빈도 제한
// ─────────────────────────────────────────────────────────────

/**
 * 분당 3회 제한. 카운트 키는 `(sessionId, X-Client-Id → 없으면 IP 폴백)`입니다
 * (2026-08-05 김효인 확정). 목에서는 IP를 알 수 없어 클라이언트 ID만 씁니다.
 */
export const SUBMIT_LIMIT_PER_MINUTE = 3;
const SUBMIT_WINDOW_MS = 60_000;

const submissionLog = new Map<string, number[]>();

export const isRateLimited = (sessionId: number, clientId: string): boolean => {
  const key = `${sessionId}:${clientId}`;
  const now = Date.now();
  const recent = (submissionLog.get(key) ?? []).filter((at) => now - at < SUBMIT_WINDOW_MS);

  if (recent.length >= SUBMIT_LIMIT_PER_MINUTE) {
    submissionLog.set(key, recent);
    return true;
  }

  submissionLog.set(key, [...recent, now]);
  return false;
};

export { HOST_USER };
