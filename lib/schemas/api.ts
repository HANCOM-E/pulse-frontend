import { z } from 'zod';

/**
 * Pulse API 계약 스키마 (openapi.yaml v0.3, 2026-08-10 갱신본 기준)
 *
 * 원본: Notion "openapi.yaml (v0.3)" — 기계용 단일 소스입니다.
 * https://app.notion.com/p/3b45f62e86848168936fe869152d748d
 * 사람용 상세 설명은 "API 명세서" 쪽입니다.
 * https://app.notion.com/p/f3f5f62e868482ee9faf816de775057c
 *
 * 타입을 손으로 따로 쓰지 않고 zod 스키마 하나에서 `z.infer`로 뽑습니다.
 * 명세의 제약(길이·개수·정규식)이 주석이 아니라 실행되는 코드로 남아야
 * BE 구현과 어긋났을 때 런타임에서 바로 드러나기 때문입니다.
 *
 * 이 파일과 mocks/handlers 가 백엔드 연동의 단일 소스입니다(CLAUDE.md "백엔드 연동 원칙").
 * 스키마를 바꾸려면 Notion 명세 → 이 파일 → MSW 핸들러 순으로 함께 고쳐야 합니다.
 */

// ─────────────────────────────────────────────────────────────
// enum
// ─────────────────────────────────────────────────────────────

export const eventStatusSchema = z.enum(['DRAFT', 'LIVE', 'ENDED', 'DELETED']);

/**
 * `CLOSED`는 피드백 마감입니다(2026-08-07 명세). 세션은 생성 시 `CLOSED`이고,
 * 발표가 시작될 때 소유자가 `ACTIVE`로 열어야 소감을 받습니다. 되돌릴 수도 있습니다.
 * `DELETED`(소프트 삭제)와 달리 종단 상태가 아닙니다.
 */
export const sessionStatusSchema = z.enum(['ACTIVE', 'CLOSED', 'DELETED']);
export const feedbackStatusSchema = z.enum(['VISIBLE', 'HIDDEN', 'DELETED']);
export const reportStatusSchema = z.enum(['GENERATING', 'GENERATED', 'FAILED']);

/** UNKNOWN은 태깅 실패를 뜻하며 NEU(진짜 중립)와 다릅니다. 감정 분포 집계에서 제외됩니다. */
export const sentimentSchema = z.enum(['POS', 'NEU', 'NEG', 'UNKNOWN']);

/** 에러 코드 v1 (21개, 2026-08-05 김효인 확정 · 08-07 SESSION_CLOSED·CSRF_TOKEN_INVALID · 08-10 SESSION_ALREADY_DELETED 추가) */
export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'UNAUTHORIZED',
  'NOT_OWNER',
  'CSRF_TOKEN_INVALID',
  'EMAIL_ALREADY_EXISTS',
  'EVENT_NOT_FOUND',
  'SESSION_NOT_FOUND',
  'FEEDBACK_NOT_FOUND',
  'REPORT_NOT_FOUND',
  'EVENT_NOT_LIVE',
  'SESSION_CLOSED',
  'INVALID_EVENT_STATE_TRANSITION',
  'EVENT_ALREADY_DELETED',
  'FEEDBACK_ALREADY_DELETED',
  'SESSION_ALREADY_DELETED',
  'EVENT_NOT_ENDED',
  'REPORT_ALREADY_EXISTS',
  'RATE_LIMIT_EXCEEDED',
  'REPORT_GENERATION_FAILED',
  'GAME_NOT_FOUND',
  'GAME_NOT_OPEN',
  'INVALID_GAME_STATE_TRANSITION',
  'GAME_ALREADY_FINISHED',
  'INTERNAL_ERROR',
]);

export type EventStatus = z.infer<typeof eventStatusSchema>;
export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type Sentiment = z.infer<typeof sentimentSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

// ─────────────────────────────────────────────────────────────
// 공통
// ─────────────────────────────────────────────────────────────

const id = z.int().positive();
const isoDateTime = z.iso.datetime();

/**
 * 타임존이 없는 달력 날짜(`YYYY-MM-DD`)입니다. `isoDateTime`과 달리 시각이 없습니다.
 *
 * 이 값을 `new Date(...)`에 넣지 마세요. 날짜만 있는 문자열은 UTC 자정으로 해석돼서,
 * UTC보다 서쪽 지역에서는 하루 앞선 날짜로 보입니다(명세 2026-08-12 경고). 화면까지
 * 문자열로 나르고, 포맷이 필요하면 그 자리에서 연·월·일을 직접 쪼개 씁니다.
 */
const calendarDate = z.iso.date('행사 날짜를 선택해 주세요.');

/**
 * 집계 개수. 0은 나오지만 음수는 나올 수 없습니다.
 *
 * 화면에서 clamp하지 않고 여기서 막습니다. 예를 들어 감정 분포에 음수가 들어오면
 * 막대 컴포넌트는 그 값을 0으로 접어 "아직 소감 없음"과 똑같이 그리게 되는데,
 * 그러면 백엔드 집계 버그가 정상 화면으로 위장됩니다.
 */
const count = z.int().nonnegative();

/**
 * 목록 응답 봉투. v1에 페이지네이션은 없지만, 나중에 nextCursor/hasMore를
 * 필드 추가만으로 도입할 수 있도록 봉투를 씌워둔 상태입니다(비파괴 seam).
 * FE는 반드시 `.items`로 언랩해야 합니다.
 */
export const listResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item) });

export const apiErrorBodySchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/**
 * 에러 코드 → HTTP 상태 매핑입니다.
 * 에러 봉투에는 코드만 들어오므로, 재시도 여부처럼 상태가 필요한 판단은 이 표를 거칩니다.
 */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHORIZED: 401,
  NOT_OWNER: 403,
  /**
   * ⚠️ 상태가 명세에 없어 FE가 먼저 정했습니다(김효인 님 확인 필요, #81).
   * double-submit 토큰이 안 맞으면 로그인 자체는 유효하므로 401이 아니라 403으로 뒀습니다.
   * Spring Security의 `CsrfFilter` 기본 동작도 403입니다.
   */
  CSRF_TOKEN_INVALID: 403,
  EMAIL_ALREADY_EXISTS: 409,
  EVENT_NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  FEEDBACK_NOT_FOUND: 404,
  REPORT_NOT_FOUND: 404,
  EVENT_NOT_LIVE: 409,
  SESSION_CLOSED: 409,
  INVALID_EVENT_STATE_TRANSITION: 409,
  EVENT_ALREADY_DELETED: 409,
  FEEDBACK_ALREADY_DELETED: 409,
  SESSION_ALREADY_DELETED: 409,
  EVENT_NOT_ENDED: 409,
  REPORT_ALREADY_EXISTS: 409,
  RATE_LIMIT_EXCEEDED: 429,
  REPORT_GENERATION_FAILED: 502,
  GAME_NOT_FOUND: 404,
  GAME_NOT_OPEN: 409,
  INVALID_GAME_STATE_TRANSITION: 409,
  GAME_ALREADY_FINISHED: 409,
  INTERNAL_ERROR: 500,
};

/** 다시 물어봐도 같은 답이 오는 실패인지 판별합니다(재시도 금지 대상). */
export const isClientError = (code: string): boolean => {
  const status = API_ERROR_STATUS[code as ApiErrorCode];
  return status !== undefined && status >= 400 && status < 500;
};

// ─────────────────────────────────────────────────────────────
// auth
// ─────────────────────────────────────────────────────────────

/**
 * 비밀번호 정책: 8~32자, 영문·숫자 각 1자 이상, 특수문자 허용.
 * BE가 `@Size(8,32)` + 이 정규식으로 검증하므로 FE도 같은 값을 써야 합니다
 * (2026-08-05 김효인 확정, "FE zod 스키마도 이 정규식으로 동기화 필요").
 */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다.')
  .max(32, '비밀번호는 32자 이하여야 합니다.')
  .regex(PASSWORD_PATTERN, '영문과 숫자를 각각 1자 이상 포함해야 합니다.');

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const signupRequestSchema = z.object({
  email: z.email('이메일 형식이 올바르지 않습니다.'),
  password: passwordSchema,
});

/**
 * 로그인·회원가입·`GET /auth/me`가 공통으로 돌려주는 유저 정보입니다.
 *
 * 토큰은 바디에 없습니다(2026-08-07 명세). `accessToken`이 HttpOnly 쿠키로 내려오므로
 * FE는 값을 읽을 수 없고, 새로고침 뒤 로그인 상태 복원은 `/auth/me`로 확인합니다.
 */
export const authUserSchema = z.object({
  id,
  email: z.email(),
  createdAt: isoDateTime,
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;

// ─────────────────────────────────────────────────────────────
// event
// ─────────────────────────────────────────────────────────────

/**
 * openapi 스키마명은 `Event`지만, DOM 전역 `Event`(JS 이벤트)와 이름이 겹칩니다.
 * 용어집이 이 혼동을 명시적으로 경고하고 있어 접두사를 붙였습니다.
 * https://app.notion.com/p/3b25f62e8684818ca55dcd2825d5e988
 */
export const pulseEventSchema = z.object({
  id,
  /** 참가자 진입 링크용 식별자, UNIQUE. 공개 조회 경로는 전부 이 값을 씁니다. */
  code: z.string().min(1),
  title: z.string().min(2).max(60),
  description: z.string().max(500).nullable(),
  /** 행사 당일 날짜. 이벤트를 만든 시각인 `createdAt`과 다릅니다(2026-08-12 명세). */
  eventDate: calendarDate,
  ownerId: id,
  status: eventStatusSchema,
  createdAt: isoDateTime,
});

/**
 * 공개 상세 조회(`GET /events/{eventCode}`) 응답입니다.
 * 내부 식별자를 밖으로 내지 않으려고 `id`·`ownerId`를 뺐습니다.
 *
 * 뺀 필드를 나열하지 않고 파생시킨 이유: 나중에 `Event`에 필드가 붙어도
 * 공개뷰가 자동으로 따라오면서 두 스키마가 어긋날 수 없기 때문입니다.
 */
export const eventViewSchema = pulseEventSchema.omit({ id: true, ownerId: true });

export const eventCreateRequestSchema = z.object({
  title: z.string().min(2, '제목은 2자 이상이어야 합니다.').max(60, '제목은 60자 이하여야 합니다.'),
  description: z.string().max(500, '설명은 500자 이하여야 합니다.').optional(),
  /** 생성 시 필수입니다. 나머지 선택 필드와 달리 빠지면 VALIDATION_ERROR입니다. */
  eventDate: calendarDate,
});

/** 전 필드 optional(부분 수정). code/ownerId/createdAt은 수정 대상이 아닙니다. */
export const eventUpdateRequestSchema = z.object({
  title: z.string().min(2).max(60).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['LIVE', 'ENDED']).optional(),
  eventDate: calendarDate.optional(),
});

export const sessionSchema = z.object({
  id,
  eventId: id,
  title: z.string().min(1),
  order: z.int(),
  status: sessionStatusSchema,
});

/**
 * 소프트 삭제를 뺀 상태입니다. `DELETED`는 목록 응답에서 제외되고 수정 요청으로도 갈 수 없어서
 * (그쪽은 `DELETE`가 담당합니다) 공개뷰와 수정 요청이 같은 좁힌 집합을 씁니다.
 */
const openSessionStatusSchema = sessionStatusSchema.exclude(['DELETED']);

/**
 * 공개 세션 목록(`GET /events/{eventCode}/sessions`) 응답입니다.
 *
 * `eventId`는 code로 조회한 목록이라 중복이어서 뺐습니다. `id`는 남습니다 — 게스트가
 * 소감을 제출하려면 `sessionId`가 필요합니다.
 *
 * `status`는 2026-08-07 명세부터 공개뷰에도 담깁니다. 세션이 `CLOSED`면 제출이 409로
 * 막히는데, 이 필드가 없으면 화면이 그걸 미리 알 방법이 없어 눌러보고 실패해야 합니다.
 */
export const sessionViewSchema = sessionSchema
  .omit({ eventId: true })
  .extend({ status: openSessionStatusSchema });

export const sessionCreateRequestSchema = z.object({
  title: z.string().min(1),
  order: z.int(),
});

/** 전 필드 optional(부분 수정). `status`는 피드백 마감/재개(`ACTIVE`↔`CLOSED`)에 씁니다. */
export const sessionUpdateRequestSchema = z.object({
  title: z.string().min(1).optional(),
  order: z.int().optional(),
  status: openSessionStatusSchema.optional(),
});

export const eventListResponseSchema = listResponseSchema(pulseEventSchema);

export type PulseEvent = z.infer<typeof pulseEventSchema>;
export type EventView = z.infer<typeof eventViewSchema>;
export type EventCreateRequest = z.infer<typeof eventCreateRequestSchema>;
export type EventUpdateRequest = z.infer<typeof eventUpdateRequestSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionView = z.infer<typeof sessionViewSchema>;
export type SessionCreateRequest = z.infer<typeof sessionCreateRequestSchema>;
export type SessionUpdateRequest = z.infer<typeof sessionUpdateRequestSchema>;

// ─────────────────────────────────────────────────────────────
// feedback
// ─────────────────────────────────────────────────────────────

/** 0~5개, 각 1~20자, 중복 불가 (요구사항 "클라이언트 태깅 출력 계약") */
export const keywordsSchema = z
  .array(z.string().min(1).max(20))
  .max(5)
  .refine((values) => new Set(values).size === values.length, '키워드는 중복될 수 없습니다.');

export const feedbackSubmitRequestSchema = z.object({
  sessionId: id,
  text: z.string().min(1).max(200),
  sentiment: sentimentSchema,
  toxic: z.boolean(),
  keywords: keywordsSchema,
  /** 태깅 실패 시에도 실제 버전값을 그대로 전송합니다. */
  taggerVersion: z.string().min(1),
});

/**
 * 공개용 소감 뷰. toxic·taggerVersion·status는 의도적으로 빠져 있습니다
 * (공개 엔드포인트라 모더레이션 신호를 노출하지 않습니다).
 */
export const feedbackViewSchema = z.object({
  id,
  sessionId: id,
  text: z.string(),
  sentiment: sentimentSchema,
  keywords: z.array(z.string()),
  createdAt: isoDateTime,
});

/** 관리자 풀뷰. /admin/* 응답 전용입니다. */
export const feedbackSchema = feedbackViewSchema.extend({
  toxic: z.boolean(),
  taggerVersion: z.string(),
  status: feedbackStatusSchema,
});

export const keywordCountSchema = z.object({
  keyword: z.string(),
  count,
});

export const sentimentBreakdownSchema = z.object({
  POS: count,
  NEU: count,
  NEG: count,
});

/**
 * 스냅샷 슬라이스 크기입니다. 명세가 `maxItems`로 못 박은 값이라 목의 집계도 같은 상수를 봐야
 * 합니다. 양쪽이 따로 숫자를 들고 있으면 목이 11개를 내는 순간 자기 스키마 검증에 걸립니다.
 */
export const TOP_KEYWORD_LIMIT = 10;
export const RECENT_FEEDBACK_LIMIT = 50;

/**
 * 폴링 스냅샷. 서버 집계(순수 SQL)이며 VISIBLE 소감만 대상입니다.
 * sentimentBreakdown·unclassifiedCount는 전량 집계, recentFeedbacks만 최신 슬라이스입니다.
 */
export const feedbackSnapshotSchema = z.object({
  /** sentiment != UNKNOWN 집계 */
  sentimentBreakdown: sentimentBreakdownSchema,
  /** sentiment = UNKNOWN(태깅 실패) 건수. 대시보드에 "미분류 N건"으로 별도 표시합니다. */
  unclassifiedCount: count,
  /** 빈도순 상위 10 */
  topKeywords: z.array(keywordCountSchema).max(TOP_KEYWORD_LIMIT),
  /** 최신 50 */
  recentFeedbacks: z.array(feedbackViewSchema).max(RECENT_FEEDBACK_LIMIT),
});

export const feedbackListResponseSchema = listResponseSchema(feedbackSchema);

export type FeedbackSubmitRequest = z.infer<typeof feedbackSubmitRequestSchema>;
export type FeedbackView = z.infer<typeof feedbackViewSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type KeywordCount = z.infer<typeof keywordCountSchema>;
export type SentimentBreakdown = z.infer<typeof sentimentBreakdownSchema>;
export type FeedbackSnapshot = z.infer<typeof feedbackSnapshotSchema>;

// ─────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────

export const reportSchema = z.object({
  id,
  eventId: id,
  /** NONE(행 없음)은 개념적 상태라 DB에도 응답에도 나타나지 않습니다. */
  status: reportStatusSchema,
  summaryText: z.string().nullable(),
  sentimentBreakdown: sentimentBreakdownSchema.nullable(),
  /** 집계 전(GENERATING·FAILED)에는 null입니다. 나머지 집계 필드와 함께 채워집니다. */
  unclassifiedCount: count.nullable(),
  topKeywords: z.array(keywordCountSchema).nullable(),
  isPublic: z.boolean(),
  generatedAt: isoDateTime.nullable(),
});

/**
 * 게스트 공개 뷰. 생성이 끝난 리포트만 이 모양으로 나가므로 집계 필드가 전부 non-null입니다.
 *
 * `unclassifiedCount`가 여기 있어야 하는 이유: 감정 분포는 UNKNOWN을 빼고 세기 때문에
 * POS+NEU+NEG가 전체 소감 수보다 작습니다. 이 값이 없으면 화면이 "총 몇 건을 분석했는지"를
 * 복원할 수 없어 비율이 실제보다 부풀어 보입니다.
 */
export const publicReportSchema = z.object({
  summaryText: z.string(),
  sentimentBreakdown: sentimentBreakdownSchema,
  unclassifiedCount: count,
  topKeywords: z.array(keywordCountSchema),
});

export type Report = z.infer<typeof reportSchema>;
export type PublicReport = z.infer<typeof publicReportSchema>;

// ─────────────────────────────────────────────────────────────
// game
// ─────────────────────────────────────────────────────────────

/**
 * 행사 시작용 미니게임입니다(#243). 이벤트 하나에 여러 개를 둘 수 있고 세션에 딸리지
 * 않습니다 — 아이스브레이킹·쉬는 시간 등 시점을 주최자가 정하기 때문입니다.
 *
 * 세션의 `ACTIVE`↔`CLOSED`와 달리 되돌릴 수 없습니다. 결과가 나온 뒤 다시 열면
 * 순위가 무의미해집니다. 다시 하려면 새 게임을 만듭니다.
 */
export const gameStatusSchema = z.enum(['DRAFT', 'OPEN', 'RUNNING', 'FINISHED']);

/**
 * 지금은 핀볼뿐입니다. `ROULETTE`·`VOTE`는 화면이 생길 때 값을 늘립니다 —
 * 미리 정의하면 그릴 수 없는 값을 스키마가 통과시킵니다.
 *
 * 이 필드가 있어야 나중에 `results`를 타입별로 넓힐 때 비파괴적입니다(#246 BE 제안).
 */
export const gameTypeSchema = z.enum(['PINBALL']);

/** 여러 게임을 구분하는 값이라 필수입니다. */
const GAME_TITLE_MAX = 50;

/** 프로젝터에 구슬로 뜨는 값이라 짧아야 합니다. */
const GAME_NICKNAME_MAX = 12;

/**
 * 공개 참가자입니다. `clientId`가 없습니다 — 브라우저 식별자를 공개 응답에 내보내면
 * 안 됩니다. 소감 공개 뷰에서 `toxic`·`status`를 빼는 것과 같은 이유입니다.
 * 저장소 쪽 내부 타입(`mocks/data/store.ts`)만 `clientId`를 들고 있습니다.
 */
export const gameParticipantSchema = z.object({
  id,
  nickname: z.string().min(1).max(GAME_NICKNAME_MAX),
  joinedAt: isoDateTime,
});

export const gameSchema = z.object({
  id,
  eventId: id,
  title: z.string().min(1).max(GAME_TITLE_MAX),
  gameType: gameTypeSchema,
  status: gameStatusSchema,
  /**
   * 완주 순서입니다. 1등이 첫 원소이고 값은 `participantId`입니다.
   * `FINISHED` 전에는 빈 배열입니다.
   */
  ranking: z.array(id),
  createdAt: isoDateTime,
});

/**
 * 공개 조회 응답입니다. 참가자를 함께 실어 화면이 한 번에 그립니다.
 * `eventId`는 code로 조회한 것이라 중복이어서 뺐습니다.
 *
 * 인원은 `participants.length`로 셉니다. 서버가 `participantCount`를 따로 주지
 * 않아서(2026-08-28 실서버 확인) 파생값을 만들지 않습니다.
 */
export const gameViewSchema = gameSchema.omit({ eventId: true }).extend({
  participants: z.array(gameParticipantSchema),
});

export const gameCreateRequestSchema = z.object({
  title: z
    .string()
    .min(1, '제목을 입력해 주세요')
    .max(GAME_TITLE_MAX, `제목은 ${GAME_TITLE_MAX}자 이하여야 합니다.`),
  /** 값이 하나뿐이라 지금은 생략 가능합니다. 늘어나면 필수로 바꿉니다 */
  gameType: gameTypeSchema.default('PINBALL'),
});

/** `DRAFT`로는 되돌아갈 수 없어서 전이 대상에서 뺐습니다. */
export const gameUpdateRequestSchema = z.object({
  status: gameStatusSchema.exclude(['DRAFT']),
});

export const gameJoinRequestSchema = z.object({
  nickname: z
    .string()
    .min(1, '닉네임을 입력해 주세요')
    .max(GAME_NICKNAME_MAX, `닉네임은 ${GAME_NICKNAME_MAX}자 이하여야 합니다.`),
});

/**
 * 프로젝터가 물리 시뮬레이션 결과를 올립니다. `participantId`를 도착 순서대로 담습니다.
 * 서버는 순위 자체를 검증하지 않고 소속·중복만 봅니다(#246 BE 확인).
 */
export const gameResultsRequestSchema = z.object({
  ranking: z
    .array(id)
    .min(1)
    .refine((values) => new Set(values).size === values.length, '참가자가 중복될 수 없습니다.'),
});

export const gameListResponseSchema = listResponseSchema(gameViewSchema);

export type GameStatus = z.infer<typeof gameStatusSchema>;
export type GameType = z.infer<typeof gameTypeSchema>;
export type Game = z.infer<typeof gameSchema>;
export type GameView = z.infer<typeof gameViewSchema>;
export type GameParticipant = z.infer<typeof gameParticipantSchema>;
export type GameCreateRequest = z.input<typeof gameCreateRequestSchema>;
export type GameUpdateRequest = z.infer<typeof gameUpdateRequestSchema>;
export type GameJoinRequest = z.infer<typeof gameJoinRequestSchema>;
export type GameResultsRequest = z.infer<typeof gameResultsRequestSchema>;
