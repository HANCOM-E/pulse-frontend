import { notFound } from 'next/navigation';
import { Donut } from '@/components/feedback/Donut';
import { toRates } from '@/components/feedback/sentiment';
import { EmptyState } from '@/components/ui/EmptyState';
import { Stat } from '@/components/ui/Stat';
import { fetchEventByCode, fetchPublicReport, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';

interface ReportPageProps {
  params: Promise<{ code: string }>;
}

/** 이벤트가 없을 때만 not-found.tsx로 넘깁니다. */
const toNotFound = (error: unknown): never => {
  if (error instanceof ApiError && error.code === 'EVENT_NOT_FOUND') notFound();
  throw error;
};

/**
 * 리포트가 없음·비공개·생성 중이면 서버가 REPORT_NOT_FOUND 하나로 합쳐서 줍니다
 * (mocks/handlers/report.ts). 비공개 리포트의 존재를 알리지 않으려는 의도라 화면도 셋을
 * 구분하지 않고 null 하나로 받습니다. 다만 "이벤트가 없음"은 별개라 여기서 걸러지지 않고
 * toNotFound로 넘어갑니다 — 이벤트는 있는데 "링크를 확인하라"고 하면 틀린 안내입니다.
 */
const fetchReportOrNull = (code: string) =>
  fetchPublicReport(code).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === 'REPORT_NOT_FOUND') return null;
    return toNotFound(error);
  });

// 폭은 형제 페이지(`/e/[code]`·not-found)와 같은 열에 맞춥니다. 레이아웃의 로고도 `max-w-md`라
// 여기만 넓히면 넓은 화면에서 로고와 본문의 왼쪽 끝이 어긋납니다.
const PAGE = 'mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-4';
const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle bg-background-default p-4';

/**
 * `eventDate`는 시각이 없는 `YYYY-MM-DD`라(API 명세) 구분자만 바꿉니다.
 *
 * `Date`로 파싱하지 않습니다. 날짜만 있는 문자열은 UTC 자정으로 읽히는데, 그걸 다시
 * 지역 시간으로 그리면 타임존에 따라 하루가 밀립니다. Vercel 서버는 UTC입니다.
 */
const formatDate = (isoDate: string) => isoDate.replaceAll('-', '.');

// 목 데이터가 매 요청 반영되도록 캐시하지 않습니다(app/dev/msw/ssr/page.tsx와 같은 이유).
export const dynamic = 'force-dynamic';

const ReportPage = async ({ params }: ReportPageProps) => {
  const { code } = await params;

  // 서로 기다릴 이유가 없어 병렬로 부릅니다. sessions는 빈 상태에서 안 쓰지만, 리포트
  // 유무를 보고 부르면 정상 경로가 한 왕복 느려져서 그냥 같이 보냅니다.
  const [event, report, sessions] = await Promise.all([
    fetchEventByCode(code).catch(toNotFound),
    fetchReportOrNull(code),
    fetchSessionsByEventCode(code).catch(toNotFound),
  ]);

  if (report === null) {
    return (
      <main className={PAGE}>
        <EmptyState
          title="공개된 리포트가 없어요"
          description="주최자가 공개하면 이 페이지에서 볼 수 있어요"
        />
      </main>
    );
  }

  const { summaryText, sentimentBreakdown, unclassifiedCount, topKeywords } = report;
  const counts = {
    positive: sentimentBreakdown.POS,
    neutral: sentimentBreakdown.NEU,
    negative: sentimentBreakdown.NEG,
  };

  /**
   * `sentimentBreakdown`은 UNKNOWN을 뺀 집계라 세 칸의 합이 총 소감 수보다 작습니다.
   * 태깅에 실패한 건수를 더해야 "몇 건을 받았는지"가 나옵니다(publicReportSchema 주석).
   */
  const submissionCount = counts.positive + counts.neutral + counts.negative + unclassifiedCount;

  /**
   * 긍정 비율의 분모에는 미분류를 넣지 않습니다. UNKNOWN은 "중립"이 아니라 분석 실패라,
   * 분모에 넣으면 태깅이 많이 실패할수록 긍정 비율이 저절로 내려갑니다(metrics.ts와 같은 규칙).
   * Donut 범례와 같은 숫자가 나오도록 반올림은 toRates 한 곳에 맡깁니다.
   */
  const positiveRate = toRates(counts).positive;

  return (
    <main className={PAGE}>
      <header className="flex flex-col gap-1">
        {/*
          행사 날짜(`eventDate`)입니다. `createdAt`은 주최자가 이벤트를 등록한 시각이라,
          일주일 전에 만들어뒀으면 참가자에게 엉뚱한 날짜가 보입니다.

          소감 수는 날짜가 아니므로 `time` 바깥에 둡니다. 문구는 LiveResult의 같은 줄과 맞췄습니다.
        */}
        <p className="text-xs leading-4 text-text-tertiary">
          <time dateTime={event.eventDate}>{formatDate(event.eventDate)}</time> · 소감{' '}
          {submissionCount}개{unclassifiedCount > 0 && ` (미분류 ${unclassifiedCount}개)`}
        </p>

        <h1 className="text-2xl font-semibold leading-8">{event.title}</h1>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="총 소감" value={`${submissionCount}`} />
        <Stat label="긍정 비율" value={`${positiveRate}%`} tone="positive" />
        <Stat label="세션" value={`${sessions.length}`} />
      </div>

      <section className={CARD}>
        <h2 className="text-xs leading-4 text-text-tertiary">AI 요약</h2>
        <p className="whitespace-pre-line text-sm leading-6 text-text-primary">{summaryText}</p>
      </section>

      <section className={`${CARD} items-center`}>
        {/*
          분모가 헤더의 총 소감보다 작다는 걸 밝힙니다. 이 단서가 없으면 도넛 범례의 합(100%)과
          총 소감 수가 어긋나 보입니다. 미분류가 0이면 뺄 것이 없어 붙이지 않습니다.
        */}
        <h2 className="self-start text-xs leading-4 text-text-tertiary">
          감정 분포{unclassifiedCount > 0 && ' · 미분류 제외'}
        </h2>
        {/* API는 POS/NEU/NEG, Donut은 positive/neutral/negative라 여기서 이름만 맞춰 넘깁니다. */}
        <Donut {...counts} className="py-2" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs leading-4 text-text-tertiary">주요 키워드</h2>
        {/*
          생성이 끝난 리포트라도 소감이 적으면 뽑힐 키워드가 없을 수 있습니다(publicReportSchema).
          이때 제목만 남지 않도록 라이브 화면과 같은 문구를 보여줍니다.
        */}
        {topKeywords.length === 0 ? (
          <p className="text-sm leading-5 text-text-tertiary">아직 모인 키워드가 없어요</p>
        ) : (
          /* Chip은 button + aria-pressed라 읽기 전용 목록에는 쓰지 않습니다(토글로 읽힙니다). */
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
        )}
      </section>
    </main>
  );
};

export default ReportPage;
