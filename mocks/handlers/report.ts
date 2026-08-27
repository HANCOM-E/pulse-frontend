import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import type { Report, Session, SessionReport } from '@/lib/schemas/api';
import { sessionReportGenerateRequestSchema } from '@/lib/schemas/api';
import {
  buildSnapshot,
  db,
  findEventByCode,
  findEventOfSession,
  findReportByEventId,
  findSessionById,
  findSessionReportBySessionId,
  nextReportId,
  nextSessionReportId,
} from '@/mocks/data/store';
import {
  API_BASE_URL,
  authenticatedAccount,
  errorResponse,
  parseBody,
  requireOwnedEvent,
} from '@/mocks/handlers/shared';

/**
 * 리포트 핸들러입니다. 전부 `/events/{eventCode}/report` 아래에 모여 있습니다
 * (2026-08-06 명세에서 `/admin/*` 안이 아니라 이쪽으로 정리됐습니다).
 *
 * 생성은 비동기라 202로 먼저 응답하고 상태만 GENERATING으로 바꿉니다.
 * 목에서는 GENERATION_DELAY_MS 뒤에 GENERATED로 넘겨서, 화면이 상태 전이를
 * 폴링으로 따라가는 흐름을 그대로 확인할 수 있게 했습니다.
 */

const GENERATION_DELAY_MS = 2_500;

/** 실제로는 LLM이 씁니다. 목은 집계 결과로 문장을 조립합니다. */
const buildSummaryText = (eventId: number): string => {
  const snapshot = buildSnapshot(eventId);
  const { POS, NEU, NEG } = snapshot.sentimentBreakdown;
  const total = POS + NEU + NEG;
  const keywords = snapshot.topKeywords.slice(0, 3).map((item) => item.keyword);

  if (total === 0) return '집계할 소감이 없어 요약을 만들지 못했습니다.';

  return (
    `총 ${total}건의 소감을 분석했습니다. 긍정 ${POS}건, 중립 ${NEU}건, 부정 ${NEG}건으로 ` +
    `${POS >= NEG ? '전반적으로 호의적인' : '개선 요구가 두드러진'} 반응이었습니다. ` +
    (keywords.length > 0 ? `가장 자주 언급된 주제는 ${keywords.join(', ')}입니다.` : '')
  );
};

const completeReport = (reportId: number): void => {
  const report = db.reports.find((item) => item.id === reportId);
  if (!report || report.status !== 'GENERATING') return;

  const snapshot = buildSnapshot(report.eventId);
  report.status = 'GENERATED';
  report.summaryText = buildSummaryText(report.eventId);
  report.sentimentBreakdown = snapshot.sentimentBreakdown;
  report.unclassifiedCount = snapshot.unclassifiedCount;
  report.topKeywords = snapshot.topKeywords;
  report.generatedAt = new Date().toISOString();
};

/**
 * 세션을 찾고 이벤트 소속·미삭제까지 확인합니다. BE의 `loadSessionInEvent`와 같은 판정입니다.
 *
 * 삭제됐거나 다른 이벤트 소속이면 존재 자체를 숨겨 `SESSION_NOT_FOUND`로 뭉갭니다. 남의
 * 이벤트 코드에 세션 id를 바꿔 넣어보며 어떤 id가 살아 있는지 훑는 걸 막습니다.
 */
const loadSessionInEvent = (
  eventCode: string | readonly string[] | undefined,
  rawSessionId: string | readonly string[] | undefined,
): Session | Response => {
  const sessionId = Number(rawSessionId);
  const session = Number.isInteger(sessionId) ? findSessionById(sessionId) : undefined;

  if (!session || session.status === 'DELETED') return errorResponse('SESSION_NOT_FOUND');
  if (findEventOfSession(session.id)?.code !== eventCode) {
    return errorResponse('SESSION_NOT_FOUND');
  }

  return session;
};

/**
 * 세션 요약 문장입니다. 실제로는 BE가 LLM에 소감과 자료 요약을 함께 넘겨 만듭니다.
 *
 * 자료 요약이 있으면 문장에 실어 보입니다. 그래야 화면에서 "자료가 실제로 반영됐는지"를
 * 눈으로 확인할 수 있습니다 — 목이 자료를 무시해도 요약은 그럴듯하게 나와서, 안 실으면
 * 배선이 끊긴 걸 알아차릴 방법이 없습니다.
 */
const buildSessionSummaryText = (
  eventId: number,
  sessionId: number,
  materialSummary: string | null,
): string => {
  const snapshot = buildSnapshot(eventId, sessionId);
  const { POS, NEU, NEG } = snapshot.sentimentBreakdown;
  const total = POS + NEU + NEG;

  const feedbackPart =
    total === 0
      ? '집계할 소감이 없어 반응은 요약하지 못했습니다.'
      : `이 세션에는 소감 ${total}건이 모였고 긍정 ${POS}건, 중립 ${NEU}건, 부정 ${NEG}건이었습니다.`;

  if (materialSummary === null) return feedbackPart;

  return `${feedbackPart} 발표 자료 요약을 함께 참고했습니다 — ${materialSummary}`;
};

const completeSessionReport = (sessionReportId: number): void => {
  const report = db.sessionReports.find((item) => item.id === sessionReportId);
  if (!report || report.status !== 'GENERATING') return;

  const event = findEventOfSession(report.sessionId);
  if (!event) return;

  const snapshot = buildSnapshot(event.id, report.sessionId);
  report.status = 'GENERATED';
  report.summaryText = buildSessionSummaryText(event.id, report.sessionId, report.materialSummary);
  report.sentimentBreakdown = snapshot.sentimentBreakdown;
  report.unclassifiedCount = snapshot.unclassifiedCount;
  report.topKeywords = snapshot.topKeywords;
  report.generatedAt = new Date().toISOString();
};

/**
 * 생성 요청의 본문은 계약상 선택입니다(`requestBody.required: false`). 본문 없이 부르는 것도
 * 자료 없는 리포트를 만드는 정상 경로라, 빈 본문을 `{}`로 읽습니다.
 *
 * `parseBody`를 쓰지 않는 이유가 이것입니다. 그쪽은 본문이 비면 `VALIDATION_ERROR`를 냅니다.
 */
const parseGenerateBody = async (
  request: Request,
): Promise<{ ok: true; materialSummary: string | null } | { ok: false; response: Response }> => {
  const raw = await request.text();

  let parsed: unknown = {};
  if (raw.trim() !== '') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        response: errorResponse('VALIDATION_ERROR', '요청 본문이 JSON이 아닙니다.'),
      };
    }
  }

  const result = sessionReportGenerateRequestSchema.safeParse(parsed);
  if (!result.success) {
    const [issue] = result.error.issues;
    return {
      ok: false,
      response: errorResponse('VALIDATION_ERROR', `materialSummary: ${issue.message}`),
    };
  }

  return { ok: true, materialSummary: result.data.materialSummary ?? null };
};

export const reportHandlers = [
  http.post(`${API_BASE_URL}/events/:eventCode/report/generate`, ({ request, params, cookies }) => {
    const event = requireOwnedEvent(request, cookies, params.eventCode);
    if (event instanceof Response) return event;

    if (event.status !== 'ENDED') return errorResponse('EVENT_NOT_ENDED');

    const existing = findReportByEventId(event.id);
    // NONE(행 없음) 또는 FAILED에서만 생성할 수 있습니다.
    if (existing && existing.status !== 'FAILED') return errorResponse('REPORT_ALREADY_EXISTS');

    const report: Report = existing ?? {
      id: nextReportId(),
      eventId: event.id,
      status: 'GENERATING',
      summaryText: null,
      sentimentBreakdown: null,
      unclassifiedCount: null,
      topKeywords: null,
      isPublic: false,
      generatedAt: null,
    };
    report.status = 'GENERATING';
    if (!existing) db.reports.push(report);

    setTimeout(() => completeReport(report.id), GENERATION_DELAY_MS);

    return HttpResponse.json(report, { status: 202 });
  }),

  http.patch(`${API_BASE_URL}/events/:eventCode/report`, async ({ request, params, cookies }) => {
    const event = requireOwnedEvent(request, cookies, params.eventCode);
    if (event instanceof Response) return event;

    const report = findReportByEventId(event.id);
    if (!report) return errorResponse('REPORT_NOT_FOUND');

    const body = await parseBody(request, z.object({ isPublic: z.boolean() }));
    if (!body.ok) return body.response;

    report.isPublic = body.data.isPublic;
    return HttpResponse.json(report);
  }),

  /**
   * 하나의 경로가 인증 여부로 갈립니다.
   *   - 소유자(인증 쿠키 있음): isPublic 무관하게 Report 전체. 화면이 GENERATING → GENERATED를 폴링합니다.
   *   - 게스트(쿠키 없음): isPublic=true이고 생성이 끝났을 때만 PublicReport, 아니면 404.
   *
   * 게스트 쪽에서 "없음"과 "비공개"를 같은 404로 병합하는 건 의도입니다(에러 코드 표의
   * REPORT_NOT_FOUND 설명). 비공개 리포트의 존재 자체를 알리지 않습니다.
   *
   * ⚠️ 로그인은 했지만 남의 이벤트인 경우는 명세에 없어 목이 먼저 정했습니다.
   * 게스트와 같은 취급(공개면 PublicReport, 아니면 404)입니다. 403을 내면 비공개 리포트가
   * 존재한다는 사실이 새어 나가고, 이 경로는 공개 페이지가 SSR로 때리는 자리이기도 합니다.
   */
  http.get(`${API_BASE_URL}/events/:eventCode/report`, ({ request, params, cookies }) => {
    const event = findEventByCode(String(params.eventCode));
    if (!event) return errorResponse('EVENT_NOT_FOUND');

    const report = findReportByEventId(event.id);
    const account = authenticatedAccount(request, cookies);
    const isOwner = account !== null && event.ownerId === account.id;

    if (isOwner) {
      // 행이 없는 상태(개념상 NONE)를 404로 알립니다. 화면은 이걸 "아직 생성 안 함"으로 읽습니다.
      if (!report) return errorResponse('REPORT_NOT_FOUND');
      return HttpResponse.json(report);
    }

    if (!report || !report.isPublic || report.status !== 'GENERATED') {
      return errorResponse('REPORT_NOT_FOUND');
    }

    return HttpResponse.json({
      summaryText: report.summaryText ?? '',
      sentimentBreakdown: report.sentimentBreakdown ?? { POS: 0, NEU: 0, NEG: 0 },
      unclassifiedCount: report.unclassifiedCount ?? 0,
      topKeywords: report.topKeywords ?? [],
    });
  }),

  /**
   * 세션 리포트 생성입니다(비인증). 강연자에게는 계정이 없어서 인증으로 막을 수가 없고,
   * 대신 두 가지가 남용을 막습니다(pulse-backend#43).
   *
   * 1. 세션이 `CLOSED`여야 합니다. `ACTIVE`면 소감이 아직 들어오는 중이라, 지금 만들면
   *    부분 집계가 아래 멱등으로 잠겨버립니다.
   * 2. 세션당 하나뿐입니다. `GENERATING`/`GENERATED`면 막고, `FAILED`만 같은 행을 재사용해
   *    재시도합니다. LLM 호출이 세션당 1회로 묶입니다.
   *
   * 재시도에서 `materialSummary`를 덮어쓰는 것도 BE와 같습니다. 자료를 다시 안 실으면 이전
   * 값이 null로 지워집니다 — 화면이 자료 요약을 들고 있다가 재시도에 다시 실어야 하는 이유입니다.
   */
  http.post(
    `${API_BASE_URL}/events/:eventCode/sessions/:sessionId/report/generate`,
    async ({ request, params }) => {
      const session = loadSessionInEvent(params.eventCode, params.sessionId);
      if (session instanceof Response) return session;

      if (session.status !== 'CLOSED') return errorResponse('SESSION_NOT_CLOSED');

      const body = await parseGenerateBody(request);
      if (!body.ok) return body.response;

      const existing = findSessionReportBySessionId(session.id);
      if (existing && existing.status !== 'FAILED') return errorResponse('REPORT_ALREADY_EXISTS');

      const report: SessionReport = existing ?? {
        id: nextSessionReportId(),
        sessionId: session.id,
        status: 'GENERATING',
        summaryText: null,
        sentimentBreakdown: null,
        unclassifiedCount: null,
        topKeywords: null,
        materialSummary: null,
        generatedAt: null,
      };

      /* 재시도면 집계도 함께 비웁니다. 옛 값이 남으면 새 요약과 짝이 안 맞습니다. */
      report.status = 'GENERATING';
      report.materialSummary = body.materialSummary;
      report.summaryText = null;
      report.sentimentBreakdown = null;
      report.unclassifiedCount = null;
      report.topKeywords = null;
      report.generatedAt = null;

      if (!existing) db.sessionReports.push(report);

      setTimeout(() => completeSessionReport(report.id), GENERATION_DELAY_MS);

      return HttpResponse.json(report, { status: 202 });
    },
  ),

  /**
   * 세션 리포트 조회입니다(공개). 이벤트 리포트와 달리 인증 분기가 없습니다 — 세션 피드백
   * 집계가 원래 공개라 그 요약도 공개이고, `isPublic` 같은 개념 자체가 없습니다.
   */
  http.get(`${API_BASE_URL}/events/:eventCode/sessions/:sessionId/report`, ({ params }) => {
    const session = loadSessionInEvent(params.eventCode, params.sessionId);
    if (session instanceof Response) return session;

    /* 행이 없는 상태를 404로 알립니다. 화면은 이걸 "아직 생성 안 함"으로 읽습니다. */
    const report = findSessionReportBySessionId(session.id);
    if (!report) return errorResponse('REPORT_NOT_FOUND');

    return HttpResponse.json(report);
  }),

  /**
   * 세션 리포트 회수입니다(주최자 전용). 생성이 비인증이라 누군가 자료 없이 혹은 잘못 만들어
   * 멱등으로 잠갔을 때, 주최자가 지워서 재생성을 여는 유일한 경로입니다.
   */
  http.post(
    `${API_BASE_URL}/events/:eventCode/sessions/:sessionId/report/reset`,
    ({ request, params, cookies }) => {
      const event = requireOwnedEvent(request, cookies, params.eventCode);
      if (event instanceof Response) return event;

      const session = loadSessionInEvent(params.eventCode, params.sessionId);
      if (session instanceof Response) return session;

      const index = db.sessionReports.findIndex((item) => item.sessionId === session.id);
      if (index === -1) return errorResponse('REPORT_NOT_FOUND');

      db.sessionReports.splice(index, 1);

      return new HttpResponse(null, { status: 204 });
    },
  ),
];
