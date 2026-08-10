import { notFound } from 'next/navigation';
import { Donut } from '@/components/feedback/Donut';
import { toRates } from '@/components/feedback/sentiment';
import { Stat } from '@/components/ui/Stat';
import { fetchEventByCode, fetchPublicReport, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';

interface ReportPageProps {
  params: Promise<{ code: string }>;
}

/**
 * 404로 넘길 에러입니다.
 *
 * 게스트 응답에서 "리포트 없음"·"비공개"·"생성 중"은 서버가 이미 REPORT_NOT_FOUND 하나로
 * 합쳐서 줍니다(mocks/handlers/report.ts). 비공개 리포트의 존재 자체를 알리지 않으려는
 * 의도라 화면에서도 구분하지 않습니다. 없는 이벤트 코드로 들어오면 EVENT_NOT_FOUND가
 * 먼저 나오는데, 이것도 사용자 입장에서는 같은 "없는 페이지"입니다.
 */
const NOT_FOUND_CODES = ['REPORT_NOT_FOUND', 'EVENT_NOT_FOUND'];

const toNotFound = (error: unknown): never => {
  if (error instanceof ApiError && NOT_FOUND_CODES.includes(error.code)) {
    notFound();
  }
  throw error;
};

const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle bg-background-default p-4';

/**
 * 서버 타임존에 따라 하루가 밀리지 않도록 Asia/Seoul로 고정합니다.
 * Vercel 서버는 UTC라 자정 근처에 만든 이벤트의 날짜가 어긋납니다.
 */
const formatDate = (iso: string) => {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${valueOf('year')}.${valueOf('month')}.${valueOf('day')}`;
};

// 목 데이터가 매 요청 반영되도록 캐시하지 않습니다(app/dev/msw/ssr/page.tsx와 같은 이유).
export const dynamic = 'force-dynamic';

const ReportPage = async ({ params }: ReportPageProps) => {
  const { code } = await params;

  // 서로 기다릴 이유가 없어 병렬로 부릅니다. 셋 다 같은 404 규칙을 씁니다.
  const [event, report, sessions] = await Promise.all([
    fetchEventByCode(code).catch(toNotFound),
    fetchPublicReport(code).catch(toNotFound),
    fetchSessionsByEventCode(code).catch(toNotFound),
  ]);

  const { summaryText, sentimentBreakdown, topKeywords } = report;
  const counts = {
    positive: sentimentBreakdown.POS,
    neutral: sentimentBreakdown.NEU,
    negative: sentimentBreakdown.NEG,
  };

  /**
   * 게스트 응답에는 미분류(UNKNOWN) 건수가 없어 감정 세 칸의 합이 곧 총 소감 수입니다.
   * 태깅에 실패한 소감은 이 숫자에서 빠집니다.
   */
  const feedbackCount = counts.positive + counts.neutral + counts.negative;

  // Donut 범례와 같은 숫자가 나오도록 반올림을 toRates 한 곳에 맡깁니다.
  const positiveRate = toRates(counts).positive;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-5 md:p-8">
      <header className="flex flex-col gap-1">
        <time dateTime={event.createdAt} className="text-xs leading-4 text-text-tertiary">
          {formatDate(event.createdAt)} · 참가자 {feedbackCount}명
        </time>

        <h1 className="text-2xl font-semibold leading-8">{event.title}</h1>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="총 소감" value={`${feedbackCount}`} />
        <Stat label="긍정 비율" value={`${positiveRate}%`} tone="positive" />
        <Stat label="세션" value={`${sessions.length}`} />
      </div>

      <section className={CARD}>
        <h2 className="text-xs leading-4 text-text-tertiary">AI 요약</h2>
        <p className="whitespace-pre-line text-sm leading-6 text-text-primary">{summaryText}</p>
      </section>

      <section className={`${CARD} items-center`}>
        <h2 className="self-start text-xs leading-4 text-text-tertiary">감정 분포</h2>
        {/* API는 POS/NEU/NEG, Donut은 positive/neutral/negative라 여기서 이름만 맞춰 넘깁니다. */}
        <Donut {...counts} className="py-2" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs leading-4 text-text-tertiary">주요 키워드</h2>
        {/* Chip은 button + aria-pressed라 읽기 전용 목록에는 쓰지 않습니다(토글로 읽힙니다). */}
        <ul className="flex flex-wrap gap-2">
          {topKeywords.map(({ keyword, count }) => (
            <li
              key={keyword}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-default bg-background-default px-3.5 text-sm leading-5 text-text-secondary"
            >
              {keyword}
              <span className="text-text-tertiary">{count}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};

export default ReportPage;
