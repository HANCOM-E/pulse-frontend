import { z } from 'zod';

/**
 * Pulse API 계약 스키마 (openapi.yaml v0.2 · 2026-08-05 기준)
 *
 * 원본: Notion "openapi.yaml 초안" 페이지의 v0.2 블록.
 * https://app.notion.com/p/3b25f62e868481dbbf3efcb698ecb072
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
export const sessionStatusSchema = z.enum(['ACTIVE', 'DELETED']);
export const feedbackStatusSchema = z.enum(['VISIBLE', 'HIDDEN', 'DELETED']);
export const reportStatusSchema = z.enum(['GENERATING', 'GENERATED', 'FAILED']);

/** UNKNOWN은 태깅 실패를 뜻하며 NEU(진짜 중립)와 다릅니다. 감정 분포 집계에서 제외됩니다. */
export const sentimentSchema = z.enum(['POS', 'NEU', 'NEG', 'UNKNOWN']);

/** 에러 코드 v1 (18개, 2026-08-05 김효인 확정) */
export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'UNAUTHORIZED',
  'NOT_OWNER',
  'EMAIL_ALREADY_EXISTS',
  'EVENT_NOT_FOUND',
  'SESSION_NOT_FOUND',
  'FEEDBACK_NOT_FOUND',
  'REPORT_NOT_FOUND',
  'EVENT_NOT_LIVE',
  'INVALID_EVENT_STATE_TRANSITION',
  'EVENT_ALREADY_DELETED',
  'FEEDBACK_ALREADY_DELETED',
  'EVENT_NOT_ENDED',
  'REPORT_ALREADY_EXISTS',
  'RATE_LIMIT_EXCEEDED',
  'REPORT_GENERATION_FAILED',
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
 * 목록 응답 봉투. v1에 페이지네이션은 없지만, 나중에 nextCursor/hasMore를
 * 필드 추가만으로 도입할 수 있도록 봉투를 씌워둔 상태입니다(비파괴 seam).
 * FE는 반드시 `.items`로 언랩해야 합니다.
 */
export const listResponseSchema = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });

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
  EMAIL_ALREADY_EXISTS: 409,
  EVENT_NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  FEEDBACK_NOT_FOUND: 404,
  REPORT_NOT_FOUND: 404,
  EVENT_NOT_LIVE: 409,
  INVALID_EVENT_STATE_TRANSITION: 409,
  EVENT_ALREADY_DELETED: 409,
  FEEDBACK_ALREADY_DELETED: 409,
  EVENT_NOT_ENDED: 409,
  REPORT_ALREADY_EXISTS: 409,
  RATE_LIMIT_EXCEEDED: 429,
  REPORT_GENERATION_FAILED: 502,
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

export const authTokenResponseSchema = z.object({
  accessToken: z.string(),
  /** 초 단위. 1시간 = 3600 */
  expiresIn: z.int(),
});

export const signupResponseSchema = authTokenResponseSchema.extend({
  id,
  email: z.email(),
  createdAt: isoDateTime,
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>;
export type SignupResponse = z.infer<typeof signupResponseSchema>;

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
  ownerId: id,
  status: eventStatusSchema,
  createdAt: isoDateTime,
});

export const eventCreateRequestSchema = z.object({
  title: z.string().min(2).max(60),
  description: z.string().max(500).optional(),
});

/** 전 필드 optional(부분 수정). code/ownerId/createdAt은 수정 대상이 아닙니다. */
export const eventUpdateRequestSchema = z.object({
  title: z.string().min(2).max(60).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['LIVE', 'ENDED']).optional(),
});

export const sessionSchema = z.object({
  id,
  eventId: id,
  title: z.string().min(1),
  order: z.int(),
  status: sessionStatusSchema,
});

export const sessionCreateRequestSchema = z.object({
  title: z.string().min(1),
  order: z.int(),
});

export const eventListResponseSchema = listResponseSchema(pulseEventSchema);

export type PulseEvent = z.infer<typeof pulseEventSchema>;
export type EventCreateRequest = z.infer<typeof eventCreateRequestSchema>;
export type EventUpdateRequest = z.infer<typeof eventUpdateRequestSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionCreateRequest = z.infer<typeof sessionCreateRequestSchema>;

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
  count: z.int(),
});

export const sentimentBreakdownSchema = z.object({
  POS: z.int(),
  NEU: z.int(),
  NEG: z.int(),
});

/**
 * 폴링 스냅샷. 서버 집계(순수 SQL)이며 VISIBLE 소감만 대상입니다.
 * sentimentBreakdown·unclassifiedCount는 전량 집계, recentFeedbacks만 최신 슬라이스입니다.
 */
export const feedbackSnapshotSchema = z.object({
  /** sentiment != UNKNOWN 집계 */
  sentimentBreakdown: sentimentBreakdownSchema,
  /** sentiment = UNKNOWN(태깅 실패) 건수. 대시보드에 "미분류 N건"으로 별도 표시합니다. */
  unclassifiedCount: z.int(),
  /** 빈도순 상위 10 */
  topKeywords: z.array(keywordCountSchema),
  /** 최신 50 */
  recentFeedbacks: z.array(feedbackViewSchema),
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
  topKeywords: z.array(z.string()).nullable(),
  isPublic: z.boolean(),
  generatedAt: isoDateTime.nullable(),
});

export const publicReportSchema = z.object({
  summaryText: z.string(),
  sentimentBreakdown: sentimentBreakdownSchema,
  topKeywords: z.array(z.string()),
});

export type Report = z.infer<typeof reportSchema>;
export type PublicReport = z.infer<typeof publicReportSchema>;
