import apiClient from '@/lib/apiClient';
import { getClientId } from '@/lib/clientId';
import type {
  AuthTokenResponse,
  Feedback,
  FeedbackSnapshot,
  FeedbackSubmitRequest,
  FeedbackView,
  LoginRequest,
  PublicReport,
  PulseEvent,
  Report,
  Session,
  SignupRequest,
  SignupResponse,
} from '@/lib/schemas/api';
import {
  authTokenResponseSchema,
  feedbackListResponseSchema,
  feedbackSchema,
  feedbackSnapshotSchema,
  feedbackViewSchema,
  listResponseSchema,
  publicReportSchema,
  pulseEventSchema,
  reportSchema,
  sessionSchema,
  signupResponseSchema,
} from '@/lib/schemas/api';
import type { z } from 'zod';

/**
 * API 엔드포인트 바인딩입니다. 화면은 경로 문자열을 직접 만들지 말고 이 함수들을 호출합니다.
 *
 * 응답을 계약 스키마로 한 번 검사합니다. BE 응답이 명세와 어긋나면 화면 어딘가에서
 * `undefined`로 조용히 터지는 대신 여기서 바로 드러나게 하려는 것입니다.
 * 개발 중에는 예외로 던지고, 프로덕션에서는 화면을 죽이지 않도록 경고만 남깁니다.
 *
 * ⚠️ 표시가 붙은 함수는 BE 미확정 엔드포인트입니다(mocks/handlers/proposed.ts 참고).
 * 지금은 목에서만 동작하며, 김효인 님 확인 후 경로가 바뀔 수 있습니다.
 */

const parseResponse = <T extends z.ZodType>(schema: T, data: unknown, path: string): z.infer<T> => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join(' / ');
    const message = `[api] ${path} 응답이 계약과 다릅니다 — ${detail}`;

    if (process.env.NODE_ENV === 'production') {
      console.error(message);
      return data as z.infer<T>;
    }
    throw new Error(message);
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
 * 공개 상세 조회. 쓰기 API가 요구하는 숫자 `id`를 여기서 얻습니다.
 * URL에는 `code`가 들어오고 PATCH·리포트 생성에는 `id`가 필요하기 때문입니다.
 */
export const fetchEventByCode = async (eventCode: string): Promise<PulseEvent> => {
  const data = await apiClient<unknown>(`/events/${eventCode}`, { skipAuth: true });
  return parseResponse(pulseEventSchema, data, 'GET /events/{eventCode}');
};

/** ⚠️ BE 미확정. 세션 목록이 있어야 세션 탭·제출 대상 선택을 그릴 수 있습니다. */
export const fetchSessionsByEventCode = async (eventCode: string): Promise<Session[]> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/sessions`, { skipAuth: true });
  return parseResponse(
    listResponseSchema(sessionSchema),
    data,
    'GET /events/{eventCode}/sessions',
  ).items;
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
  /** ⚠️ BE 미확정 필터. 숨김 해제 UI에는 HIDDEN 건도 필요합니다. */
  status?: 'VISIBLE' | 'HIDDEN' | 'DELETED';
}

export const fetchModerationQueue = async (
  params: ModerationQueueParams = {},
): Promise<Feedback[]> => {
  const query = new URLSearchParams();
  if (params.eventCode !== undefined) query.set('eventCode', params.eventCode);
  if (params.sessionId !== undefined) query.set('sessionId', String(params.sessionId));
  if (params.toxic !== undefined) query.set('toxic', String(params.toxic));
  if (params.status !== undefined) query.set('status', params.status);

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

/** ⚠️ BE 미확정. 요구사항의 HIDDEN → VISIBLE 전이에 대응하는 엔드포인트가 없습니다. */
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

/** 공개 리포트. 비공개거나 없으면 REPORT_NOT_FOUND(404)가 옵니다. */
export const fetchPublicReport = async (eventCode: string): Promise<PublicReport> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/report`, { skipAuth: true });
  return parseResponse(publicReportSchema, data, 'GET /events/{eventCode}/report');
};

/** ⚠️ BE 미확정. 주최자가 자기 리포트의 생성 진행 상태를 볼 경로가 없습니다. */
export const fetchOwnReport = async (eventCode: string): Promise<Report> => {
  const data = await apiClient<unknown>(`/admin/events/${eventCode}/report`);
  return parseResponse(reportSchema, data, 'GET /admin/events/{eventCode}/report');
};

/** ⚠️ BE 미확정. 요구사항의 isPublic 토글에 대응하는 엔드포인트가 없습니다. */
export const setReportPublic = async (eventCode: string, isPublic: boolean): Promise<Report> => {
  const data = await apiClient<unknown>(`/admin/events/${eventCode}/report`, {
    method: 'PATCH',
    body: JSON.stringify({ isPublic }),
  });
  return parseResponse(reportSchema, data, 'PATCH /admin/events/{eventCode}/report');
};
