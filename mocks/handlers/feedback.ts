import { http, HttpResponse } from 'msw';
import type { Feedback } from '@/lib/schemas/api';
import { feedbackSubmitRequestSchema } from '@/lib/schemas/api';
import {
  buildSnapshot,
  db,
  findEventByCode,
  findSessionById,
  isRateLimited,
  nextFeedbackId,
  toFeedbackView,
} from '@/mocks/data/store';
import { API_BASE_URL, errorResponse, parseBody, toNumericId } from '@/mocks/handlers/shared';

/**
 * 소감 제출·집계 핸들러입니다. 둘 다 공개 엔드포인트라 인증을 요구하지 않습니다.
 *
 * 집계 응답(FeedbackSnapshot)은 VISIBLE 소감만 대상이라, 모더레이션에서 숨긴 소감이
 * 다음 폴링부터 대시보드·실시간 화면에서 사라집니다.
 */

export const feedbackHandlers = [
  http.post(`${API_BASE_URL}/events/:eventCode/feedbacks`, async ({ request, params }) => {
    const event = findEventByCode(String(params.eventCode));
    if (!event) return errorResponse('EVENT_NOT_FOUND');

    const body = await parseBody(request, feedbackSubmitRequestSchema);
    if (!body.ok) return body.response;

    const session = findSessionById(body.data.sessionId);
    if (!session || session.eventId !== event.id || session.status === 'DELETED') {
      return errorResponse('SESSION_NOT_FOUND');
    }

    // LIVE 상태에서만 제출을 받습니다.
    if (event.status !== 'LIVE') return errorResponse('EVENT_NOT_LIVE');

    // 이벤트가 LIVE여도 해당 순서가 마감(CLOSED)이면 신규 소감을 거부합니다(2026-08-07 명세).
    if (session.status === 'CLOSED') return errorResponse('SESSION_CLOSED');

    // 빈도 제한 키 = (sessionId, X-Client-Id). FE가 익명 브라우저 UUID를 헤더로 보냅니다.
    const clientId = request.headers.get('X-Client-Id') ?? 'anonymous';
    if (isRateLimited(session.id, clientId)) return errorResponse('RATE_LIMIT_EXCEEDED');

    const feedback: Feedback = {
      id: nextFeedbackId(),
      sessionId: session.id,
      text: body.data.text,
      sentiment: body.data.sentiment,
      toxic: body.data.toxic,
      keywords: body.data.keywords,
      taggerVersion: body.data.taggerVersion,
      status: 'VISIBLE',
      createdAt: new Date().toISOString(),
    };
    db.feedbacks.push(feedback);

    // 제출자에게는 공개 뷰만 돌려줍니다(toxic·status 노출 금지).
    return HttpResponse.json(toFeedbackView(feedback), { status: 201 });
  }),

  http.get(`${API_BASE_URL}/events/:eventCode/feedbacks`, ({ params, request }) => {
    const event = findEventByCode(String(params.eventCode));
    if (!event) return errorResponse('EVENT_NOT_FOUND');

    const rawSessionId = new URL(request.url).searchParams.get('sessionId');
    if (rawSessionId !== null) {
      const sessionId = toNumericId(rawSessionId);
      if (sessionId === null) {
        return errorResponse('VALIDATION_ERROR', 'sessionId는 양의 정수여야 합니다.');
      }
      const session = findSessionById(sessionId);
      if (!session || session.eventId !== event.id) return errorResponse('SESSION_NOT_FOUND');
      return HttpResponse.json(buildSnapshot(event.id, sessionId));
    }

    return HttpResponse.json(buildSnapshot(event.id));
  }),
];
