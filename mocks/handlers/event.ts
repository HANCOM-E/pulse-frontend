import { http, HttpResponse } from 'msw';
import type { PulseEvent, Session } from '@/lib/schemas/api';
import { eventCreateRequestSchema, eventUpdateRequestSchema, sessionCreateRequestSchema } from '@/lib/schemas/api';
import {
  HOST_USER,
  db,
  findEventByCode,
  findEventById,
  findSessionById,
  generateEventCode,
  listSessionsOfEvent,
  nextEventId,
  nextSessionId,
} from '@/mocks/data/store';
import { API_BASE_URL, errorResponse, parseBody, requireAuth, toNumericId } from '@/mocks/handlers/shared';

/**
 * 이벤트·세션 핸들러입니다.
 *
 * 경로 파라미터가 두 종류인 점에 주의해야 합니다.
 *   - 공개 읽기(GET 상세·소감·리포트)는 `eventCode`
 *   - 소유자 쓰기(PATCH·DELETE·세션·리포트 생성)는 `eventId`
 * 화면은 URL에서 code를 받고, 쓰기에 필요한 id는 상세 응답의 `id`에서 꺼내 씁니다.
 */

export const eventHandlers = [
  // 내 이벤트 목록. 페이지네이션은 v1에 없지만 봉투는 씌워서 나갑니다.
  http.get(`${API_BASE_URL}/events`, ({ request }) => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const items = db.events.filter(
      (event) => event.ownerId === HOST_USER.id && event.status !== 'DELETED',
    );
    return HttpResponse.json({ items });
  }),

  http.post(`${API_BASE_URL}/events`, async ({ request }) => {
    const unauthorized = requireAuth(request);
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

  // 공개 상세 조회. 게스트 진입 링크가 이 경로를 씁니다.
  http.get(`${API_BASE_URL}/events/:eventCode`, ({ params }) => {
    const event = findEventByCode(String(params.eventCode));
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    return HttpResponse.json(event);
  }),

  http.patch(`${API_BASE_URL}/events/:eventId`, async ({ request, params }) => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const eventId = toNumericId(params.eventId);
    const event = eventId === null ? undefined : findEventById(eventId);
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    if (event.ownerId !== HOST_USER.id) return errorResponse('NOT_OWNER');

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

  http.delete(`${API_BASE_URL}/events/:eventId`, ({ request, params }) => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const eventId = toNumericId(params.eventId);
    const event = eventId === null ? undefined : db.events.find((item) => item.id === eventId);
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    if (event.ownerId !== HOST_USER.id) return errorResponse('NOT_OWNER');
    if (event.status === 'DELETED') return errorResponse('EVENT_ALREADY_DELETED');

    // 소프트 삭제. 하위 Session·Feedback은 연쇄 삭제하지 않습니다.
    event.status = 'DELETED';
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/events/:eventId/sessions`, async ({ request, params }) => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const eventId = toNumericId(params.eventId);
    const event = eventId === null ? undefined : findEventById(eventId);
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    if (event.ownerId !== HOST_USER.id) return errorResponse('NOT_OWNER');

    const body = await parseBody(request, sessionCreateRequestSchema);
    if (!body.ok) return body.response;

    const session: Session = {
      id: nextSessionId(),
      eventId: event.id,
      title: body.data.title,
      order: body.data.order,
      status: 'ACTIVE',
    };
    db.sessions.push(session);

    return HttpResponse.json(session, { status: 201 });
  }),

  http.delete(`${API_BASE_URL}/events/:eventId/sessions/:sessionId`, ({ request, params }) => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const eventId = toNumericId(params.eventId);
    const event = eventId === null ? undefined : findEventById(eventId);
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    if (event.ownerId !== HOST_USER.id) return errorResponse('NOT_OWNER');

    const sessionId = toNumericId(params.sessionId);
    const session = sessionId === null ? undefined : findSessionById(sessionId);
    if (!session || session.eventId !== event.id) return errorResponse('SESSION_NOT_FOUND');

    // 연결된 Feedback 존재 여부는 삭제 조건이 아닙니다.
    session.status = 'DELETED';
    return new HttpResponse(null, { status: 204 });
  }),
];
