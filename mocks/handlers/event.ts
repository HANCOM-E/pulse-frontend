import { http, HttpResponse } from 'msw';
import type { PulseEvent, Session } from '@/lib/schemas/api';
import {
  eventCreateRequestSchema,
  eventUpdateRequestSchema,
  sessionCreateRequestSchema,
  sessionUpdateRequestSchema,
} from '@/lib/schemas/api';
import {
  HOST_USER,
  db,
  findEventByCode,
  findEventRowByCode,
  findSessionById,
  generateEventCode,
  listSessionsOfEvent,
  nextEventId,
  nextSessionId,
  toEventView,
  toSessionView,
} from '@/mocks/data/store';
import {
  API_BASE_URL,
  errorResponse,
  parseBody,
  requireAuth,
  requireOwnedEvent,
  toNumericId,
} from '@/mocks/handlers/shared';

/**
 * 이벤트·세션 핸들러입니다.
 *
 * 경로 파라미터는 전부 `eventCode`입니다(2026-08-06 명세). 공개 상세 응답에서 내부 `id`가
 * 빠지면서 화면이 숫자 id를 얻을 방법 자체가 없어졌고, 소유자 쓰기도 code로 통일됐습니다.
 * 저장소 내부는 여전히 숫자 id로 관계를 잇습니다 — 경계에서만 code를 씁니다.
 */

export const eventHandlers = [
  // 내 이벤트 목록. 페이지네이션은 v1에 없지만 봉투는 씌워서 나갑니다.
  http.get(`${API_BASE_URL}/events`, ({ cookies }) => {
    const unauthorized = requireAuth(cookies);
    if (unauthorized) return unauthorized;

    const items = db.events.filter(
      (event) => event.ownerId === HOST_USER.id && event.status !== 'DELETED',
    );
    return HttpResponse.json({ items });
  }),

  http.post(`${API_BASE_URL}/events`, async ({ request, cookies }) => {
    const unauthorized = requireAuth(cookies);
    if (unauthorized) return unauthorized;

    const body = await parseBody(request, eventCreateRequestSchema);
    if (!body.ok) return body.response;

    const event: PulseEvent = {
      id: nextEventId(),
      code: generateEventCode(),
      title: body.data.title,
      description: body.data.description ?? null,
      ownerId: HOST_USER.id,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    };
    db.events.push(event);

    return HttpResponse.json(event, { status: 201 });
  }),

  // 공개 상세 조회. 게스트 진입 링크가 이 경로를 씁니다. 응답은 id·ownerId를 뺀 EventView입니다.
  http.get(`${API_BASE_URL}/events/:eventCode`, ({ params }) => {
    const event = findEventByCode(String(params.eventCode));
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    return HttpResponse.json(toEventView(event));
  }),

  http.patch(`${API_BASE_URL}/events/:eventCode`, async ({ request, params, cookies }) => {
    const event = requireOwnedEvent(cookies, params.eventCode);
    if (event instanceof Response) return event;

    const body = await parseBody(request, eventUpdateRequestSchema);
    if (!body.ok) return body.response;

    if (body.data.status) {
      const isValidTransition =
        (event.status === 'DRAFT' && body.data.status === 'LIVE') ||
        (event.status === 'LIVE' && body.data.status === 'ENDED');
      if (!isValidTransition) return errorResponse('INVALID_EVENT_STATE_TRANSITION');

      // 세션이 하나도 없으면 LIVE로 못 갑니다(요구사항 "4. 이벤트 시작·종료").
      if (body.data.status === 'LIVE' && listSessionsOfEvent(event.id).length === 0) {
        return errorResponse(
          'INVALID_EVENT_STATE_TRANSITION',
          '세션을 1개 이상 만들어야 시작할 수 있습니다.',
        );
      }
      event.status = body.data.status;
    }

    if (body.data.title !== undefined) event.title = body.data.title;
    if (body.data.description !== undefined) event.description = body.data.description;

    return HttpResponse.json(event);
  }),

  http.delete(`${API_BASE_URL}/events/:eventCode`, ({ params, cookies }) => {
    const unauthorized = requireAuth(cookies);
    if (unauthorized) return unauthorized;

    // requireOwnedEvent를 못 쓰는 자리입니다. 그쪽이 쓰는 findEventByCode는 DELETED를 걸러내서,
    // 재삭제가 409 EVENT_ALREADY_DELETED 대신 404로 나갑니다.
    const event = findEventRowByCode(String(params.eventCode));
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    if (event.ownerId !== HOST_USER.id) return errorResponse('NOT_OWNER');
    if (event.status === 'DELETED') return errorResponse('EVENT_ALREADY_DELETED');

    // 소프트 삭제. 하위 Session·Feedback은 연쇄 삭제하지 않습니다.
    event.status = 'DELETED';
    return new HttpResponse(null, { status: 204 });
  }),

  // 공개 세션 목록. 게스트 제출 대상 선택과 소유자 관리 화면이 같이 씁니다.
  http.get(`${API_BASE_URL}/events/:eventCode/sessions`, ({ params }) => {
    const event = findEventByCode(String(params.eventCode));
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    return HttpResponse.json({ items: listSessionsOfEvent(event.id).map(toSessionView) });
  }),

  http.post(`${API_BASE_URL}/events/:eventCode/sessions`, async ({ request, params, cookies }) => {
    const event = requireOwnedEvent(cookies, params.eventCode);
    if (event instanceof Response) return event;

    const body = await parseBody(request, sessionCreateRequestSchema);
    if (!body.ok) return body.response;

    // 생성 직후는 피드백 마감 상태입니다. 발표가 시작될 때 소유자가 PATCH로 엽니다(2026-08-07 명세).
    const session: Session = {
      id: nextSessionId(),
      eventId: event.id,
      title: body.data.title,
      order: body.data.order,
      status: 'CLOSED',
    };
    db.sessions.push(session);

    return HttpResponse.json(session, { status: 201 });
  }),

  http.patch(
    `${API_BASE_URL}/events/:eventCode/sessions/:sessionId`,
    async ({ request, params, cookies }) => {
      const event = requireOwnedEvent(cookies, params.eventCode);
      if (event instanceof Response) return event;

      const sessionId = toNumericId(params.sessionId);
      const session = sessionId === null ? undefined : findSessionById(sessionId);
      if (!session || session.eventId !== event.id) return errorResponse('SESSION_NOT_FOUND');

      /*
       * ⚠️ 명세에 없어 목이 먼저 정한 규칙입니다(김효인 님 확인 필요).
       * 삭제된 세션은 없는 것으로 봅니다. 2026-08-07에 `status`가 수정 대상이 되면서
       * 이 검사가 없으면 PATCH `status=ACTIVE`로 삭제된 세션을 되살릴 수 있습니다.
       */
      if (session.status === 'DELETED') return errorResponse('SESSION_NOT_FOUND');

      const body = await parseBody(request, sessionUpdateRequestSchema);
      if (!body.ok) return body.response;

      if (body.data.title !== undefined) session.title = body.data.title;
      if (body.data.order !== undefined) session.order = body.data.order;
      // ACTIVE↔CLOSED만 옵니다. 삭제는 DELETE가 담당해서 요청 스키마에 DELETED가 없습니다.
      if (body.data.status !== undefined) session.status = body.data.status;

      return HttpResponse.json(session);
    },
  ),

  http.delete(`${API_BASE_URL}/events/:eventCode/sessions/:sessionId`, ({ params, cookies }) => {
    const event = requireOwnedEvent(cookies, params.eventCode);
    if (event instanceof Response) return event;

    const sessionId = toNumericId(params.sessionId);
    const session = sessionId === null ? undefined : findSessionById(sessionId);
    if (!session || session.eventId !== event.id) return errorResponse('SESSION_NOT_FOUND');
    if (session.status === 'DELETED') return errorResponse('SESSION_ALREADY_DELETED');

    // 연결된 Feedback 존재 여부는 삭제 조건이 아닙니다.
    session.status = 'DELETED';
    return new HttpResponse(null, { status: 204 });
  }),
];
