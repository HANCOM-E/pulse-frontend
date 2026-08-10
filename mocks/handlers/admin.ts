import { http, HttpResponse } from 'msw';
import type { Feedback, FeedbackStatus } from '@/lib/schemas/api';
import {
  db,
  findEventByCode,
  findEventOfSession,
  findFeedbackById,
  findSessionById,
} from '@/mocks/data/store';
import type { RequestCookies } from '@/mocks/handlers/shared';
import { API_BASE_URL, errorResponse, requireAccount, toNumericId } from '@/mocks/handlers/shared';

/**
 * 모더레이션 핸들러입니다. 전부 인증 + 소유자 검증이 붙습니다.
 *
 * `eventCode`·`sessionId` 필터는 2026-08-05에 BE가 추가했습니다. 필터 없이 호출하면
 * 계정 전체 큐가 나오므로, 이벤트별 화면은 반드시 `eventCode`를 붙여야 합니다.
 *
 * 2026-08-06 명세에서 `/admin/*`은 모더레이션 큐만 남았습니다. 리포트 관리는
 * `/events/{eventCode}/report`로 옮겨갔습니다(handlers/report.ts).
 */

/**
 * 소감이 요청을 보낸 계정의 이벤트에 속하는지 확인합니다(feedback → session → event → ownerId).
 *
 * 삭제된 이벤트의 소감은 소유자여도 대상에서 뺍니다. 이벤트 소프트 삭제는 하위 Session·Feedback을
 * 연쇄 삭제하지 않으므로(API 명세 `DELETE /events/{eventId}`), 걸러내는 책임이 조회 쪽에 있습니다.
 *
 * ⚠️ 명세에 모더레이션 큐의 삭제 이벤트 처리가 적혀 있지 않아 목이 먼저 정한 규칙입니다.
 * 김효인 님 확인 후 명세에 반영해야 합니다.
 */
const isOwnedBy = (feedback: Feedback, accountId: number): boolean => {
  const event = findEventOfSession(feedback.sessionId);
  if (!event || event.status === 'DELETED') return false;
  return event.ownerId === accountId;
};

const transition = (
  request: Request,
  cookies: RequestCookies,
  feedbackId: string | readonly string[] | undefined,
  next: FeedbackStatus,
) => {
  const account = requireAccount(request, cookies);
  if (account instanceof Response) return account;

  const id = toNumericId(feedbackId);
  const feedback = id === null ? undefined : findFeedbackById(id);
  if (!feedback) return errorResponse('FEEDBACK_NOT_FOUND');
  if (!isOwnedBy(feedback, account.id)) return errorResponse('NOT_OWNER');

  // DELETED는 종단 상태입니다.
  if (feedback.status === 'DELETED') return errorResponse('FEEDBACK_ALREADY_DELETED');

  feedback.status = next;
  return HttpResponse.json(feedback);
};

/**
 * 쿼리 파라미터(eventCode·sessionId·toxic·includeHidden)로 큐를 추립니다.
 * 검증에 실패하면 에러 응답을 그대로 돌려줍니다.
 *
 * DELETED는 `includeHidden` 값과 무관하게 항상 빠집니다. 종단 상태라 되돌릴 수 없고
 * (`/hide`·`/show`가 409를 냅니다) 모더레이션이 더 할 일이 없기 때문입니다.
 *
 * ⚠️ 명세는 `includeHidden=true`가 "HIDDEN 상태 소감도 포함"이라고만 적고 DELETED를
 * 언급하지 않습니다. 위 규칙은 목이 먼저 정한 것이라 김효인 님 확인이 필요합니다.
 */
const selectModerationQueue = (
  query: URLSearchParams,
  accountId: number,
): Feedback[] | Response => {
  const eventCode = query.get('eventCode');
  const rawSessionId = query.get('sessionId');
  const rawToxic = query.get('toxic');
  const rawIncludeHidden = query.get('includeHidden');

  if (rawIncludeHidden !== null && rawIncludeHidden !== 'true' && rawIncludeHidden !== 'false') {
    return errorResponse('VALIDATION_ERROR', 'includeHidden은 true 또는 false여야 합니다.');
  }
  const includeHidden = rawIncludeHidden === 'true';

  let items = db.feedbacks
    .filter((feedback) => isOwnedBy(feedback, accountId))
    .filter(
      (feedback) =>
        feedback.status === 'VISIBLE' || (includeHidden && feedback.status === 'HIDDEN'),
    );

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
  http.get(`${API_BASE_URL}/admin/feedbacks`, ({ request, cookies }) => {
    const account = requireAccount(request, cookies);
    if (account instanceof Response) return account;

    const selected = selectModerationQueue(new URL(request.url).searchParams, account.id);
    if (selected instanceof Response) return selected;

    return HttpResponse.json({ items: selected });
  }),

  http.patch(`${API_BASE_URL}/admin/feedbacks/:feedbackId/hide`, ({ request, params, cookies }) =>
    transition(request, cookies, params.feedbackId, 'HIDDEN'),
  ),

  // 숨김 해제. 실수로 숨긴 건을 되돌리는 유일한 경로입니다(요구사항 소감 상태 전이 4번).
  http.patch(`${API_BASE_URL}/admin/feedbacks/:feedbackId/show`, ({ request, params, cookies }) =>
    transition(request, cookies, params.feedbackId, 'VISIBLE'),
  ),

  http.patch(`${API_BASE_URL}/admin/feedbacks/:feedbackId/delete`, ({ request, params, cookies }) =>
    transition(request, cookies, params.feedbackId, 'DELETED'),
  ),
];
