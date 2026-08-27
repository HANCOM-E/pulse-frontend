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
  SessionReport,
  SessionView,
  Game,
  GameParticipant,
  GameView,
} from '@/lib/schemas/api';
import { RECENT_FEEDBACK_LIMIT, TOP_KEYWORD_LIMIT } from '@/lib/schemas/api';

import type { MockGameParticipant } from '@/mocks/data/seed';
import {
  HOST_USER,
  seedEvents,
  seedFeedbacks,
  seedReports,
  seedSessions,
  seedGames,
  seedGameParticipants,
} from '@/mocks/data/seed';

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
  /**
   * 시드가 없습니다. 세션 리포트는 세션이 `CLOSED`가 된 뒤에 강연자가 직접 만드는 것이라,
   * 미리 깔아두면 "아직 생성 전"(404)이라는 정상 상태를 화면에서 확인할 수 없습니다.
   */
  sessionReports: SessionReport[];
  games: Game[];
  gameParticipants: MockGameParticipant[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createDb = (): MockDb => ({
  accounts: [{ ...HOST_USER }],
  events: clone(seedEvents),
  sessions: clone(seedSessions),
  feedbacks: clone(seedFeedbacks),
  reports: clone(seedReports),
  sessionReports: [],
  games: clone(seedGames),
  gameParticipants: clone(seedGameParticipants),
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
  db.sessionReports = fresh.sessionReports;
  db.games = fresh.games;
  db.gameParticipants = fresh.gameParticipants;
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
export const nextSessionReportId = (): number => nextId(db.sessionReports);
export const nextGameId = (): number => nextId(db.games);
export const nextGameParticipantId = (): number => nextId(db.gameParticipants);

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

/** 세션당 하나뿐입니다(BE는 `session_id` UNIQUE로 강제합니다). */
export const findSessionReportBySessionId = (sessionId: number): SessionReport | undefined =>
  db.sessionReports.find((report) => report.sessionId === sessionId);

export const findGameById = (gameId: number): Game | undefined =>
  db.games.find((game) => game.id === gameId);

export const listParticipantsOfGame = (gameId: number): MockGameParticipant[] =>
  db.gameParticipants
    .filter((participant) => participant.gameId === gameId)
    .sort((a, b) => a.id - b.id);

/**
 * 같은 사람이 이미 참가했는지 봅니다. **게임 단위**입니다 — 같은 브라우저가 다른 게임에
 * 참가하는 건 정상이라 `clientId`만으로 판단하면 안 됩니다.
 */
export const findParticipantByClientId = (
  gameId: number,
  clientId: string,
): MockGameParticipant | undefined =>
  db.gameParticipants.find(
    (participant) => participant.gameId === gameId && participant.clientId === clientId,
  );

/**
 * 주최자용 게임 목록입니다. `findCurrentGame`과 달리 **`DRAFT`도 포함**합니다 —
 * 만들어두고 아직 안 연 게임을 다시 찾는 게 이 목록의 존재 이유입니다.
 *
 * 최근에 만든 것이 위입니다. `createdAt`이 아니라 id로 고른 이유는 같은 시각에
 * 만들어져도 순서가 안 흔들리기 때문이고, `findCurrentGame`과 기준을 맞췄습니다.
 */
export const listGamesOfEvent = (eventId: number): Game[] =>
  db.games.filter((game) => game.eventId === eventId).sort((a, b) => b.id - a.id);

/**
 * 참가자 화면 배너가 쓰는 "지금 열린 게임"입니다(`GET .../games/current`).
 *
 * `DRAFT`는 뺍니다. 배너가 뜨면 참가자가 눌러 들어갔다가 `GAME_NOT_OPEN`을 맞습니다.
 * 비밀로 감추는 건 아닙니다 — `GET .../games/{id}`는 `DRAFT`도 그대로 돌려줍니다.
 * 동시에 둘이 열릴 일은 없다고 보지만, 실수로 그렇게 되면 가장 최근 것을 내려줍니다.
 * `createdAt` 대신 id 로 고르는 이유는 같은 시각에 만들어져도 순서가 흔들리지 않아서입니다.
 */
export const findCurrentGame = (eventId: number): Game | undefined =>
  db.games
    .filter((game) => game.eventId === eventId && game.status !== 'DRAFT')
    .sort((a, b) => b.id - a.id)[0];

// ─────────────────────────────────────────────────────────────
// 집계 (GET /events/{eventCode}/feedbacks)
// ─────────────────────────────────────────────────────────────

/**
 * 저장소 행을 공개 응답 모양으로 좁힙니다.
 *
 * 핸들러가 행을 그대로 반환하면 내부 `id`·`ownerId`가 딸려 나갑니다. 명세가 공개뷰에서
 * 이들을 뺐으므로(2026-08-06) 공개 경로는 반드시 이 변환을 거쳐야 합니다.
 */
/*
 * `eventViewSchema`는 `pulseEventSchema`에서 파생되지만 이 매퍼는 필드를 손으로 나열합니다.
 * `Event`에 필드가 붙으면 스키마는 저절로 따라오는데 여기는 안 따라와서, 새 필드를 빠뜨리면
 * 목이 자기 계약을 어기고 `INVALID_RESPONSE`가 납니다(2026-08-12 `eventDate` 추가 때 실제로
 * 걸렸습니다). 필드를 지우는 쪽(`id`·`ownerId`)이 목적이라 나열을 유지하되, `Event`에 필드를
 * 추가할 때는 여기도 같이 봐야 합니다.
 */
export const toEventView = (event: PulseEvent): EventView => ({
  code: event.code,
  title: event.title,
  description: event.description,
  eventDate: event.eventDate,
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
 * 참가자 행에서 `gameId`·`clientId`를 떨굽니다. **공개 경로는 반드시 이걸 거쳐야 합니다.**
 * 행을 그대로 반환하면 브라우저 식별자가 밖으로 나갑니다.
 */
export const toGameParticipantView = (participant: MockGameParticipant): GameParticipant => ({
  id: participant.id,
  nickname: participant.nickname,
  joinedAt: participant.joinedAt,
});

/**
 * `eventId`를 떨구고 참가자·인원을 붙입니다.
 *
 * `participantCount`를 `participants.length`에서 파생시킵니다. 두 값을 따로 들면
 * 참가 처리에서 한쪽만 갱신했을 때 배너 숫자와 명단이 조용히 어긋납니다.
 */
export const toGameView = (game: Game): GameView => {
  const participants = listParticipantsOfGame(game.id);
  return {
    id: game.id,
    title: game.title,
    gameType: game.gameType,
    status: game.status,
    results: game.results,
    createdAt: game.createdAt,
    participantCount: participants.length,
    participants: participants.map(toGameParticipantView),
  };
};

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
