import { http, HttpResponse } from 'msw';
import type { Report } from '@/lib/schemas/api';
import {
  buildSnapshot,
  db,
  findEventByCode,
  findReportByEventId,
  nextReportId,
} from '@/mocks/data/store';
import { API_BASE_URL, errorResponse, requireOwnedEvent } from '@/mocks/handlers/shared';

/**
 * 리포트 핸들러입니다.
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
  report.topKeywords = snapshot.topKeywords.map((item) => item.keyword);
  report.generatedAt = new Date().toISOString();
};

export const reportHandlers = [
  http.post(`${API_BASE_URL}/events/:eventCode/report/generate`, ({ request, params }) => {
    const event = requireOwnedEvent(request, params.eventCode);
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
      topKeywords: null,
      isPublic: false,
      generatedAt: null,
    };
    report.status = 'GENERATING';
    if (!existing) db.reports.push(report);

    setTimeout(() => completeReport(report.id), GENERATION_DELAY_MS);

    return HttpResponse.json(report, { status: 202 });
  }),

  // 공개 리포트. 없을 때와 비공개일 때를 프라이버시상 같은 코드로 병합합니다.
  http.get(`${API_BASE_URL}/events/:eventCode/report`, ({ params }) => {
    const event = findEventByCode(String(params.eventCode));
    if (!event) return errorResponse('EVENT_NOT_FOUND');

    const report = findReportByEventId(event.id);
    if (!report || !report.isPublic || report.status !== 'GENERATED') {
      return errorResponse('REPORT_NOT_FOUND');
    }

    return HttpResponse.json({
      summaryText: report.summaryText ?? '',
      sentimentBreakdown: report.sentimentBreakdown ?? { POS: 0, NEU: 0, NEG: 0 },
      topKeywords: report.topKeywords ?? [],
    });
  }),
];
