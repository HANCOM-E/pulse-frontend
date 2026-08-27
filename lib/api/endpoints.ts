import apiClient, { ApiError } from '@/lib/apiClient';
import { getClientId } from '@/lib/clientId';
import type {
  AuthUser,
  EventCreateRequest,
  EventUpdateRequest,
  EventView,
  Feedback,
  FeedbackSnapshot,
  FeedbackSubmitRequest,
  FeedbackView,
  GameCreateRequest,
  GameJoinRequest,
  GameParticipant,
  GameResultsRequest,
  GameUpdateRequest,
  GameView,
  LoginRequest,
  PublicReport,
  PulseEvent,
  Report,
  Session,
  SessionCreateRequest,
  SessionReport,
  SessionReportGenerateRequest,
  SessionUpdateRequest,
  SessionView,
  SignupRequest,
} from '@/lib/schemas/api';
import {
  authUserSchema,
  eventViewSchema,
  feedbackListResponseSchema,
  feedbackSchema,
  feedbackSnapshotSchema,
  feedbackViewSchema,
  gameListResponseSchema,
  gameParticipantSchema,
  gameViewSchema,
  listResponseSchema,
  publicReportSchema,
  pulseEventSchema,
  reportSchema,
  sessionReportSchema,
  sessionSchema,
  sessionViewSchema,
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
 * `INVALID_RESPONSE`는 FE가 만든 코드라 `API_ERROR_STATUS` 표에 없습니다. 그래서
 * `isClientError`가 false를 주는데, `QueryProvider`가 이 코드를 따로 걸러 재시도하지
 * 않습니다(#56).
 *
 * 원래는 배포 시차로 BE·FE 버전이 잠깐 어긋난 경우를 넘기려고 재시도를 두었습니다.
 * 기본 정책은 `failureCount < 2`라 최대 2회 재시도(총 3회 요청)이고, 지수 백오프를
 * 포함해도 3초 안에 끝납니다. 배포 시차는 분 단위라 의도한 효과가 없으면서 이미
 * 어긋난 서버로 나가는 요청만 3배가 됐습니다. 집계 API를 3초마다 부르는 화면이
 * 붙으면서 실제로 문제가 됩니다.
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

/**
 * 응답 바디에 토큰이 없습니다(2026-08-07 명세). 서버가 `accessToken`을 HttpOnly 쿠키로
 * 내려주므로, 호출자는 반환값을 저장할 필요 없이 로그인됐다고 보면 됩니다.
 *
 * `skipAuth`를 쓰지 않습니다. 쿠키를 받으려면(`Set-Cookie`) 요청이 `credentials: 'include'`여야 합니다.
 */
export const login = async (body: LoginRequest): Promise<AuthUser> => {
  const data = await apiClient<unknown>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return parseResponse(authUserSchema, data, 'POST /auth/login');
};

export const signup = async (body: SignupRequest): Promise<AuthUser> => {
  const data = await apiClient<unknown>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return parseResponse(authUserSchema, data, 'POST /auth/signup');
};

/** 쿠키 만료는 서버가 `Set-Cookie`로 처리합니다. FE가 지울 수 있는 값이 아닙니다. */
export const logout = async (): Promise<void> => {
  await apiClient<null>('/auth/logout', { method: 'POST' });
};

/**
 * 새로고침 뒤 로그인 상태를 복원합니다. 토큰이 HttpOnly라 FE가 읽고 판단할 수 없어서,
 * "로그인돼 있나"를 알려면 서버에 물어보는 수밖에 없습니다. 미인증이면 401(`UNAUTHORIZED`)입니다.
 */
export const fetchMe = async (signal?: AbortSignal): Promise<AuthUser> => {
  const data = await apiClient<unknown>('/auth/me', { signal });
  return parseResponse(authUserSchema, data, 'GET /auth/me');
};

// ─────────────────────────────────────────────────────────────
// event
// ─────────────────────────────────────────────────────────────

/** 내 이벤트 목록. 봉투를 벗겨서 배열만 돌려줍니다. */
export const fetchMyEvents = async (): Promise<PulseEvent[]> => {
  const data = await apiClient<unknown>('/events');
  return parseResponse(listResponseSchema(pulseEventSchema), data, 'GET /events').items;
};

export const createEvent = async (body: EventCreateRequest): Promise<PulseEvent> => {
  const data = await apiClient<unknown>('/events', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return parseResponse(pulseEventSchema, data, 'POST /events');
};

/**
 * 공개 상세 조회. 응답은 내부 `id`·`ownerId`를 뺀 `EventView`입니다.
 * 쓰기 API도 전부 `eventCode`를 받으므로 화면이 숫자 id를 알 필요가 없습니다.
 */
export const fetchEventByCode = async (eventCode: string): Promise<EventView> => {
  const data = await apiClient<unknown>(`/events/${eventCode}`, { skipAuth: true });
  return parseResponse(eventViewSchema, data, 'GET /events/{eventCode}');
};

export const updateEvent = async (
  eventCode: string,
  body: EventUpdateRequest,
): Promise<PulseEvent> => {
  const data = await apiClient<unknown>(`/events/${eventCode}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return parseResponse(pulseEventSchema, data, 'PATCH /events/{eventCode}');
};

/** 소프트 삭제. 응답 204라 반환값이 없습니다. */
export const deleteEvent = async (eventCode: string): Promise<void> => {
  await apiClient<null>(`/events/${eventCode}`, { method: 'DELETE' });
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

export const createSession = async (
  eventCode: string,
  body: SessionCreateRequest,
): Promise<Session> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/sessions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return parseResponse(sessionSchema, data, 'POST /events/{eventCode}/sessions');
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

/** 소프트 삭제. 응답 204라 반환값이 없습니다. */
export const deleteSession = async (eventCode: string, sessionId: number): Promise<void> => {
  await apiClient<null>(`/events/${eventCode}/sessions/${sessionId}`, { method: 'DELETE' });
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

// ─────────────────────────────────────────────────────────────
// game
// ─────────────────────────────────────────────────────────────

/**
 * 참가자 화면 배너가 쓰는 "지금 열린 게임"입니다(#243).
 *
 * `skipAuth`를 씁니다. 공개 경로라 인증이 필요 없고, 주최자가 자기 폰으로 참가자 화면을
 * 열어도 같은 응답을 받아야 합니다.
 */
export const fetchCurrentGame = async (eventCode: string): Promise<GameView | null> => {
  try {
    const data = await apiClient<unknown>(`/events/${eventCode}/games/current`, { skipAuth: true });
    return parseResponse(gameViewSchema, data, 'GET /events/{eventCode}/games/current');
  } catch (error) {
    /*
     * 열린 게임이 없으면 서버가 GAME_NOT_FOUND(404)를 줍니다. 이 화면에서 그건 실패가
     * 아니라 "아직 안 열렸다"는 정상 상태입니다.
     *
     * 에러로 남기면 useEventEntryFeed의 isPermanentFailure가 4xx로 보고 폴링을 멈춰서,
     * 주최자가 나중에 게임을 열어도 화면이 영영 모릅니다. 리포트 쪽 fetchReportExists가
     * 같은 이유로 404를 삼킵니다.
     */
    if (error instanceof ApiError && error.code === 'GAME_NOT_FOUND') return null;
    throw error;
  }
};

/**
 * 게임 하나를 봅니다. `current`로 찾은 게임을 계속 따라갈 때 씁니다.
 *
 * `current`와 달리 404를 삼키지 않습니다. gameId를 알고 부르는 자리라, 없다는 건
 * 정상 상태가 아니라 링크가 낡았거나 잘못된 것입니다.
 */
export const fetchGameById = async (eventCode: string, gameId: number): Promise<GameView> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/games/${gameId}`, { skipAuth: true });
  return parseResponse(gameViewSchema, data, 'GET /events/{eventCode}/games/{gameId}');
};

/**
 * 게임에 참가합니다. 소감 제출과 같은 `X-Client-Id`로 사람을 가리므로, 같은 브라우저가
 * 다시 부르면 새 참가자가 생기지 않고 닉네임만 갱신됩니다(#246).
 *
 * 응답의 `id`를 반드시 저장해야 합니다. 공개 응답에 `clientId`가 없어서, 저장해두지
 * 않으면 새로고침 뒤에 참가자 목록에서 자기를 못 고릅니다. `RUNNING`이 되면 이
 * 엔드포인트가 `GAME_NOT_OPEN`으로 막혀서 다시 물어볼 수도 없습니다.
 */
export const joinGame = async (
  eventCode: string,
  gameId: number,
  body: GameJoinRequest,
): Promise<GameParticipant> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/games/${gameId}/participants`, {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
    headers: { 'X-Client-Id': getClientId() },
  });
  return parseResponse(
    gameParticipantSchema,
    data,
    'POST /events/{eventCode}/games/{gameId}/participants',
  );
};

/**
 * 주최자가 만든 게임 목록입니다(#258). `current`와 달리 `DRAFT`도 옵니다 — 만들어두고
 * 아직 안 연 게임을 다시 찾는 게 이 목록의 존재 이유입니다.
 */
export const fetchGamesOfEvent = async (eventCode: string): Promise<GameView[]> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/games`);
  return parseResponse(gameListResponseSchema, data, 'GET /events/{eventCode}/games').items;
};

/** 게임을 만듭니다. `DRAFT`로 생깁니다 — 만들자마자 열지 않고 주최자가 시점을 정합니다. */
export const createGame = async (eventCode: string, body: GameCreateRequest): Promise<GameView> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/games`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return parseResponse(gameViewSchema, data, 'POST /events/{eventCode}/games');
};

/**
 * 상태를 한 칸 옮깁니다. `DRAFT → OPEN → RUNNING` 한 방향이고 되돌릴 수 없습니다.
 *
 * `RUNNING → FINISHED`는 여기로 못 갑니다. 결과 확정(`submitGameResults`)만 그 전이를
 * 맡습니다 — 여기서 넘기면 `results`가 `null`인 채 `FINISHED`가 됩니다.
 */
export const updateGameStatus = async (
  eventCode: string,
  gameId: number,
  body: GameUpdateRequest,
): Promise<GameView> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/games/${gameId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return parseResponse(gameViewSchema, data, 'PATCH /events/{eventCode}/games/{gameId}');
};

/**
 * 순위를 확정하고 게임을 끝냅니다. `participantId`를 도착 순서대로 담습니다.
 *
 * 서버는 순위 자체를 검증하지 않습니다(#246). 소속과 중복만 봅니다 — 프로젝터가 물리
 * 시뮬레이션으로 뽑은 결과라 서버가 재현할 수 없기 때문입니다.
 */
export const submitGameResults = async (
  eventCode: string,
  gameId: number,
  body: GameResultsRequest,
): Promise<GameView> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/games/${gameId}/results`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return parseResponse(gameViewSchema, data, 'POST /events/{eventCode}/games/{gameId}/results');
};

// ─────────────────────────────────────────────────────────────
// session report
// ─────────────────────────────────────────────────────────────

/**
 * 세션 리포트 생성을 요청합니다. 202로 `GENERATING` 상태의 리포트가 돌아오고, 집계·요약은
 * 서버가 비동기로 채웁니다. 화면은 `fetchSessionReport`를 폴링해서 완료를 기다립니다.
 *
 * **세션당 한 번뿐입니다.** 서버가 `GENERATING`/`GENERATED`면 `REPORT_ALREADY_EXISTS`로
 * 막습니다(`FAILED`만 같은 행을 재사용해 재시도). 그래서 `materialSummary`는 이 호출 전에
 * 준비돼 있어야 합니다 — 나중에 자료만 덧붙이는 경로가 계약에 없고, 되돌리는 방법은 주최자의
 * `resetSessionReport`뿐입니다.
 *
 * 재시도(`FAILED` → 재생성)할 때도 자료 요약을 다시 실어야 합니다. 서버가 이 값으로 덮어쓰기
 * 때문에, 빼고 보내면 이전에 넣어둔 자료 요약이 null로 지워집니다.
 *
 * 비인증 경로입니다(강연자에게 계정이 없습니다). 남용 방어는 인증이 아니라 세션 `CLOSED`
 * 게이트와 위 멱등입니다.
 */
export const generateSessionReport = async (
  eventCode: string,
  sessionId: number,
  body: SessionReportGenerateRequest,
): Promise<SessionReport> => {
  const data = await apiClient<unknown>(
    `/events/${eventCode}/sessions/${sessionId}/report/generate`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return parseResponse(
    sessionReportSchema,
    data,
    'POST /events/{eventCode}/sessions/{sessionId}/report/generate',
  );
};

/**
 * 세션 리포트 조회입니다. 공개 경로라 소유자/게스트 분기가 없습니다 — 세션 피드백 집계가
 * 원래 공개라서 그 요약도 공개입니다(이벤트 리포트의 `isPublic` 같은 개념이 없습니다).
 *
 * 아직 만들지 않은 세션은 404 `REPORT_NOT_FOUND`입니다. 실패가 아니라 "생성 전"이라는 정상
 * 상태이므로 호출부가 그렇게 읽어야 합니다.
 */
export const fetchSessionReport = async (
  eventCode: string,
  sessionId: number,
): Promise<SessionReport> => {
  const data = await apiClient<unknown>(`/events/${eventCode}/sessions/${sessionId}/report`);
  return parseResponse(
    sessionReportSchema,
    data,
    'GET /events/{eventCode}/sessions/{sessionId}/report',
  );
};

/**
 * 세션 리포트를 회수합니다(주최자 전용). 응답 204라 반환값이 없습니다.
 *
 * 생성이 비인증이라 누군가 자료 없이 혹은 잘못 만들어 멱등으로 잠갔을 때, 주최자가 지워서
 * 재생성을 열어주는 유일한 경로입니다. 강연자 화면에서는 부를 수 없습니다.
 */
export const resetSessionReport = async (eventCode: string, sessionId: number): Promise<void> => {
  await apiClient<null>(`/events/${eventCode}/sessions/${sessionId}/report/reset`, {
    method: 'POST',
  });
};
