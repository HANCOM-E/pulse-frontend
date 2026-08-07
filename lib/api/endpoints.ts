import apiClient, { ApiError } from '@/lib/apiClient';
import { getClientId } from '@/lib/clientId';
import type {
  AuthTokenResponse,
  EventView,
  Feedback,
  FeedbackSnapshot,
  FeedbackSubmitRequest,
  FeedbackView,
  LoginRequest,
  PublicReport,
  PulseEvent,
  Report,
  Session,
  SessionUpdateRequest,
  SessionView,
  SignupRequest,
  SignupResponse,
} from '@/lib/schemas/api';
import {
  authTokenResponseSchema,
  eventViewSchema,
  feedbackListResponseSchema,
  feedbackSchema,
  feedbackSnapshotSchema,
  feedbackViewSchema,
  listResponseSchema,
  publicReportSchema,
  pulseEventSchema,
  reportSchema,
  sessionSchema,
  sessionViewSchema,
  signupResponseSchema,
} from '@/lib/schemas/api';
import type { z } from 'zod';

/**
 * API 엔드포인트 바인딩입니다. 화면은 경로 문자열을 직접 만들지 말고 이 함수들을 호출합니다.
 *
 * 응답을 계약 스키마로 한 번 검사합니다. BE 응답이 명세와 어긋나면 화면 어딘가에서
 * `undefined`로 조용히 터지는 대신 여기서 바로 드러나게 하려는 것입니다.
 * 검증에 실패하면 환경과 무관하게 `INVALID_RESPONSE`를 던집니다.
 *
 * 이벤트를 가리키는 인자는 전부 `eventCode`입니다(2026-08-06 명세). 공개 응답에서 내부
 * 숫자 `id`가 빠져서 화면이 그 값을 손에 넣을 방법이 없습니다.
 */

/**
 * 검증 실패를 프로덕션에서 로그만 남기고 넘기던 분기가 있었습니다. 타입만 캐스팅한 값이
 * 그대로 화면까지 흘러가 `items.map`처럼 필드에 손대는 순간 터졌고, 이 함수가 막으려던
 * "조용한 undefined"가 그대로 재현됐습니다. 실패는 호출자가 알아야 하므로 던집니다.
 *
 * `INVALID_RESPONSE`는 `API_ERROR_STATUS`에 없어서 `isClientError`가 false를 주고,
 * 그래서 `QueryProvider`의 기본 정책상 2회까지 재시도됩니다. 배포 시차로 BE·FE 버전이
 * 잠깐 어긋난 경우를 넘길 수 있어 그대로 둡니다.
 */
const parseResponse = <T extends z.ZodType>(schema: T, data: unknown, path: string): z.infer<T> => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join(' / ');
    throw new ApiError('INVALID_RESPONSE', `[api] ${path} 응답이 계약과 다릅니다 — ${detail}`);
  }

  return result.data;
};

// ─────────────────────────────────────────────────────────────
// auth
// ─────────────────────────────────────────────────────────────

export const login = async (body: LoginRequest): Promise<AuthTokenResponse> => {
  const data = await apiClient<unknown>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  });
  return parseResponse(authTokenResponseSchema, data, 'POST /auth/login');
};

export const signup = async (body: SignupRequest): Promise<SignupResponse> => {
  const data = await apiClient<unknown>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  });
  return parseResponse(signupResponseSchema, data, 'POST /auth/signup');
};

// ─────────────────────────────────────────────────────────────
// event
// ─────────────────────────────────────────────────────────────

/** 내 이벤트 목록. 봉투를 벗겨서 배열만 돌려줍니다. */
export const fetchMyEvents = async (): Promise<PulseEvent[]> => {
  const data = await apiClient<unknown>('/events');
  return parseResponse(listResponseSchema(pulseEventSchema), data, 'GET /events').items;
};

/**
 * 공개 상세 조회. 응답은 내부 `id`·`ownerId`를 뺀 `EventView`입니다.
 * 쓰기 API도 전부 `eventCode`를 받으므로 화면이 숫자 id를 알 필요가 없습니다.
 */
export const fetchEventByCode = async (eventCode: string): Promise<EventView> => {
  const data = await apiClient<unknown>(`/events/${eventCode}`, { skipAuth: true });
  return parseResponse(eventViewSchema, data, 'GET /events/{eventCode}');
};

/** 세션 목록. 게스트 제출 대상 선택과 소유자 세션 탭이 같이 씁니다. `DELETED`는 빠집니다. */
export const fetchSessionsByEventCode = async (eventCode: string): Promise<SessionView[]> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/sessions`, { skipAuth: true });
  return parseResponse(
    listResponseSchema(sessionViewSchema),
    data,
    'GET /events/{eventCode}/sessions',
  ).items;
};

export const updateSession = async (
  eventCode: string,
  sessionId: number,
  body: SessionUpdateRequest,
): Promise<Session> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return parseResponse(sessionSchema, data, 'PATCH /events/{eventCode}/sessions/{sessionId}');
};

// ─────────────────────────────────────────────────────────────
// feedback
// ─────────────────────────────────────────────────────────────

export const submitFeedback = async (
  eventCode: string,
  body: FeedbackSubmitRequest,
): Promise<FeedbackView> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/feedbacks`, {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
    // 빈도 제한 카운트 키. 강연장 공용 WiFi는 IP가 다 같아서 브라우저 단위 식별자가 필요합니다.
    headers: { 'X-Client-Id': getClientId() },
  });
  return parseResponse(feedbackViewSchema, data, 'POST /events/{eventCode}/feedbacks');
};

/** 폴링 스냅샷. `sessionId`를 주면 해당 세션만 집계합니다. */
export const fetchFeedbackSnapshot = async (
  eventCode: string,
  sessionId?: number,
): Promise<FeedbackSnapshot> => {
  const query = sessionId === undefined ? '' : `?sessionId=${sessionId}`;
  const data = await apiClient<unknown>(`/events/${eventCode}/feedbacks${query}`, {
    skipAuth: true,
  });
  return parseResponse(feedbackSnapshotSchema, data, 'GET /events/{eventCode}/feedbacks');
};

// ─────────────────────────────────────────────────────────────
// moderation
// ─────────────────────────────────────────────────────────────

interface ModerationQueueParams {
  /** 이벤트별 화면이면 반드시 넘겨야 합니다. 빼면 계정 전체 큐가 옵니다. */
  eventCode?: string;
  sessionId?: number;
  toxic?: boolean;
  /** 기본 false. 숨김 해제 UI처럼 HIDDEN 건까지 보여줘야 하는 화면만 켭니다. */
  includeHidden?: boolean;
}

export const fetchModerationQueue = async (
  params: ModerationQueueParams = {},
): Promise<Feedback[]> => {
  const query = new URLSearchParams();
  if (params.eventCode !== undefined) query.set('eventCode', params.eventCode);
  if (params.sessionId !== undefined) query.set('sessionId', String(params.sessionId));
  if (params.toxic !== undefined) query.set('toxic', String(params.toxic));
  if (params.includeHidden !== undefined) query.set('includeHidden', String(params.includeHidden));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const data = await apiClient<unknown>(`/admin/feedbacks${suffix}`);
  return parseResponse(feedbackListResponseSchema, data, 'GET /admin/feedbacks').items;
};

export const hideFeedback = async (feedbackId: number): Promise<Feedback> => {
  const data = await apiClient<unknown>(`/admin/feedbacks/${feedbackId}/hide`, { method: 'PATCH' });
  return parseResponse(feedbackSchema, data, 'PATCH /admin/feedbacks/{feedbackId}/hide');
};

export const deleteFeedback = async (feedbackId: number): Promise<Feedback> => {
  const data = await apiClient<unknown>(`/admin/feedbacks/${feedbackId}/delete`, {
    method: 'PATCH',
  });
  return parseResponse(feedbackSchema, data, 'PATCH /admin/feedbacks/{feedbackId}/delete');
};

/** 숨김 해제. 이미 DELETED인 건에는 409가 옵니다. */
export const showFeedback = async (feedbackId: number): Promise<Feedback> => {
  const data = await apiClient<unknown>(`/admin/feedbacks/${feedbackId}/show`, { method: 'PATCH' });
  return parseResponse(feedbackSchema, data, 'PATCH /admin/feedbacks/{feedbackId}/show');
};

// ─────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────

export const generateReport = async (eventCode: string): Promise<Report> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/report/generate`, { method: 'POST' });
  return parseResponse(reportSchema, data, 'POST /events/{eventCode}/report/generate');
};

/**
 * 공개 리포트. 비공개거나 없으면 REPORT_NOT_FOUND(404)가 옵니다.
 *
 * `fetchOwnReport`와 같은 경로를 씁니다. 서버가 `Authorization` 헤더 유무로 응답 모양을
 * 가르므로, 게스트 응답(`PublicReport`)을 받으려면 로그인 상태여도 토큰을 빼야 합니다.
 * `skipAuth`가 그 역할입니다 — 빼먹으면 주최자 화면에서 스키마 검증이 터집니다.
 */
export const fetchPublicReport = async (eventCode: string): Promise<PublicReport> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/report`, { skipAuth: true });
  return parseResponse(publicReportSchema, data, 'GET /events/{eventCode}/report (게스트)');
};

/** 주최자용 조회. 공개 여부와 무관하게 `status`·`isPublic`까지 전부 옵니다(생성 진행 폴링용). */
export const fetchOwnReport = async (eventCode: string): Promise<Report> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/report`);
  return parseResponse(reportSchema, data, 'GET /events/{eventCode}/report (소유자)');
};

export const setReportPublic = async (eventCode: string, isPublic: boolean): Promise<Report> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/report`, {
    method: 'PATCH',
    body: JSON.stringify({ isPublic }),
  });
  return parseResponse(reportSchema, data, 'PATCH /events/{eventCode}/report');
};
