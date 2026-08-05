import { http, HttpResponse } from 'msw';
import type { Feedback, FeedbackStatus } from '@/lib/schemas/api';
import {
  HOST_USER,
  db,
  findEventByCode,
  findEventOfSession,
  findFeedbackById,
  findSessionById,
} from '@/mocks/data/store';
import { API_BASE_URL, errorResponse, requireAuth, toNumericId } from '@/mocks/handlers/shared';

/**
 * 모더레이션 핸들러입니다. 전부 인증 + 소유자 검증이 붙습니다.
 *
 * `eventCode`·`sessionId` 필터는 2026-08-05에 BE가 추가했습니다. 필터 없이 호출하면
 * 계정 전체 큐가 나오므로, 이벤트별 화면은 반드시 `eventCode`를 붙여야 합니다.
 */

/** 소감이 로그인한 Host의 이벤트에 속하는지 확인합니다(feedback → session → event → ownerId). */
const isOwnedByHost = (feedback: Feedback): boolean =>
  findEventOfSession(feedback.sessionId)?.ownerId === HOST_USER.id;

const transition = (request: Request, feedbackId: string | readonly string[] | undefined, next: FeedbackStatus) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const id = toNumericId(feedbackId);
  const feedback = id === null ? undefined : findFeedbackById(id);
  if (!feedback) return errorResponse('FEEDBACK_NOT_FOUND');
  if (!isOwnedByHost(feedback)) return errorResponse('NOT_OWNER');

  // DELETED는 종단 상태입니다.
  if (feedback.status === 'DELETED') return errorResponse('FEEDBACK_ALREADY_DELETED');

  feedback.status = next;
  return HttpResponse.json(feedback);
};

/**
 * 확정된 쿼리 파라미터(eventCode·sessionId·toxic)로 큐를 추립니다.
 * 검증에 실패하면 에러 응답을 그대로 돌려줍니다.
 *
 * 제안 단계인 status 필터가 이 함수를 재사용합니다(mocks/handlers/proposed.ts).
 * 필터 조건을 여기 한 곳에만 두려고 분리했습니다.
 */
export const selectModerationQueue = (query: URLSearchParams): Feedback[] | Response => {
  const eventCode = query.get('eventCode');
  const rawSessionId = query.get('sessionId');
  const rawToxic = query.get('toxic');

  let items = db.feedbacks.filter(isOwnedByHost);

  if (eventCode !== null) {
    const event = findEventByCode(eventCode);
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    items = items.filter((feedback) => findSessionById(feedback.sessionId)?.eventId === event.id);
  }

  if (rawSessionId !== null) {
    const sessionId = toNumericId(rawSessionId);
    if (sessionId === null) {
      return errorResponse('VALIDATION_ERROR', 'sessionId는 양의 정수여야 합니다.');
    }
    items = items.filter((feedback) => feedback.sessionId === sessionId);
  }

  if (rawToxic !== null) {
    if (rawToxic !== 'true' && rawToxic !== 'false') {
      return errorResponse('VALIDATION_ERROR', 'toxic은 true 또는 false여야 합니다.');
    }
    items = items.filter((feedback) => feedback.toxic === (rawToxic === 'true'));
  }

  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
};

export const adminHandlers = [
  http.get(`${API_BASE_URL}/admin/feedbacks`, ({ request }) => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const selected = selectModerationQueue(new URL(request.url).searchParams);
    if (selected instanceof Response) return selected;

    return HttpResponse.json({ items: selected });
  }),

  http.patch(`${API_BASE_URL}/admin/feedbacks/:feedbackId/hide`, ({ request, params }) =>
    transition(request, params.feedbackId, 'HIDDEN'),
  ),

  http.patch(`${API_BASE_URL}/admin/feedbacks/:feedbackId/delete`, ({ request, params }) =>
    transition(request, params.feedbackId, 'DELETED'),
  ),
];
