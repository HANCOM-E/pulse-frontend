import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { feedbackStatusSchema } from '@/lib/schemas/api';
import { selectModerationQueue } from '@/mocks/handlers/admin';
import {
  HOST_USER,
  findEventByCode,
  findEventById,
  findEventOfSession,
  findFeedbackById,
  findReportByEventId,
  listSessionsOfEvent,
} from '@/mocks/data/store';
import {
  API_BASE_URL,
  errorResponse,
  parseBody,
  requireAuth,
  toNumericId,
} from '@/mocks/handlers/shared';

/**
 * ⚠️ BE 미확정 엔드포인트입니다 (openapi.yaml v0.2에 없음).
 *
 * 화면을 그리려면 필요한데 명세에 빠져 있는 네 건을 목에서만 먼저 열어둔 것입니다.
 * 계약 우선 개발 원칙(CLAUDE.md "백엔드 연동 원칙")에 따라 FE는 이 모양으로 먼저 붙이고,
 * 김효인 님 확인이 끝나면 확정 핸들러(event.ts / admin.ts / report.ts)로 옮깁니다.
 *
 * 확인이 필요한 이유:
 *   1. 세션 목록 — 요구사항 "3. 세션 관리"는 Session CRUD를 명시하는데 API 명세에는
 *      생성·삭제만 있습니다. 목록이 없으면 게스트가 제출할 세션을 고를 수 없고
 *      (`POST /feedbacks`는 sessionId가 필수), 대시보드·모더레이션도 세션 탭을
 *      그릴 수 없습니다. `GET /events/{eventCode}` 응답에 sessions[]를 넣는 쪽이
 *      왕복 1회로 끝나므로 그편을 권합니다.
 *   2. 숨김 해제 — 요구사항 "소감 상태 전이" 4번에 HIDDEN → VISIBLE이 있는데
 *      API 명세에는 /hide, /delete만 있습니다.
 *   3. 주최자용 리포트 조회 — 확정된 `GET /events/{eventCode}/report`는 공개용이라
 *      비공개 리포트에 404를 냅니다. 그래서 주최자가 자기 리포트의 GENERATING →
 *      GENERATED 진행 상태를 볼 방법이 없습니다(ReportPanel이 폴링할 대상이 없음).
 *   4. 공개 여부 토글 — 요구사항 "3. 리포트 공개"에 isPublic 토글이 있는데
 *      해당 엔드포인트가 명세에 없습니다.
 */

export const proposedHandlers = [
  // [제안] 모더레이션 큐의 status 필터.
  //
  // 확정 핸들러와 같은 경로라, `status`가 없으면 아무것도 반환하지 않고 넘깁니다.
  // MSW는 리졸버가 undefined를 반환하면 다음 핸들러로 요청을 흘려보냅니다.
  // 그래서 이 배열이 handlers.ts에서 확정 핸들러보다 앞에 와야 합니다.
  http.get(`${API_BASE_URL}/admin/feedbacks`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    const rawStatus = query.get('status');
    if (rawStatus === null) return undefined;

    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const parsed = feedbackStatusSchema.safeParse(rawStatus);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'status는 VISIBLE/HIDDEN/DELETED 중 하나여야 합니다.');
    }

    const selected = selectModerationQueue(query);
    if (selected instanceof Response) return selected;

    return HttpResponse.json({
      items: selected.filter((feedback) => feedback.status === parsed.data),
    });
  }),

  // [제안] 세션 목록 조회 (공개)
  http.get(`${API_BASE_URL}/events/:eventCode/sessions`, ({ params }) => {
    const event = findEventByCode(String(params.eventCode));
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    return HttpResponse.json({ items: listSessionsOfEvent(event.id) });
  }),

  // [제안] 숨김 해제 (소유자만)
  http.patch(`${API_BASE_URL}/admin/feedbacks/:feedbackId/show`, ({ request, params }) => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const feedbackId = toNumericId(params.feedbackId);
    const feedback = feedbackId === null ? undefined : findFeedbackById(feedbackId);
    if (!feedback) return errorResponse('FEEDBACK_NOT_FOUND');
    if (!findEventOfSession(feedback.sessionId)) return errorResponse('FEEDBACK_NOT_FOUND');

    // DELETED는 종단 상태라 되돌아오지 않습니다.
    if (feedback.status === 'DELETED') return errorResponse('FEEDBACK_ALREADY_DELETED');

    feedback.status = 'VISIBLE';
    return HttpResponse.json(feedback);
  }),

  // [제안] 주최자용 리포트 조회 (소유자만). 공개용과 달리 status·isPublic이 그대로 나옵니다.
  //
  // 경로를 `/admin/events/...`로 잡은 이유: 확정된 공개 조회가 이미
  // `GET /events/{eventCode}/report`를 차지하고 있어서, 같은 자리에 주최자용 GET을
  // 하나 더 둘 수 없습니다(`{eventCode}`와 `{eventId}`는 라우팅 관점에서 같은 패턴이라
  // MSW에서도 Spring에서도 충돌합니다). 소유자 전용 읽기를 `/admin/*`에 모으는 것은
  // 모더레이션 큐가 이미 쓰고 있는 방식과도 맞습니다.
  http.get(`${API_BASE_URL}/admin/events/:eventId/report`, ({ request, params }) => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const eventId = toNumericId(params.eventId);
    const event = eventId === null ? undefined : findEventById(eventId);
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    if (event.ownerId !== HOST_USER.id) return errorResponse('NOT_OWNER');

    const report = findReportByEventId(event.id);
    // 행이 없는 상태(개념상 NONE)를 404로 알립니다. 화면은 이걸 "아직 생성 안 함"으로 읽습니다.
    if (!report) return errorResponse('REPORT_NOT_FOUND');

    return HttpResponse.json(report);
  }),

  // [제안] 공개 여부 토글 (소유자만)
  http.patch(`${API_BASE_URL}/admin/events/:eventId/report`, async ({ request, params }) => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const eventId = toNumericId(params.eventId);
    const event = eventId === null ? undefined : findEventById(eventId);
    if (!event) return errorResponse('EVENT_NOT_FOUND');
    if (event.ownerId !== HOST_USER.id) return errorResponse('NOT_OWNER');

    const report = findReportByEventId(event.id);
    if (!report) return errorResponse('REPORT_NOT_FOUND');

    const body = await parseBody(request, z.object({ isPublic: z.boolean() }));
    if (!body.ok) return body.response;

    report.isPublic = body.data.isPublic;
    return HttpResponse.json(report);
  }),
];
