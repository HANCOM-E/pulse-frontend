'use client';

import { createPortal } from 'react-dom';

import { KeywordCard } from '@/components/dashboard/KeywordCard';
import type { KeywordCount, SentimentSummary, TrendPoint } from '@/components/dashboard/metrics';
import { SentimentTrendCard } from '@/components/dashboard/SentimentTrendCard';
import { Donut } from '@/components/feedback/Donut';
import { FEED_SENTIMENT, FeedItem } from '@/components/feedback/FeedItem';
import { Badge } from '@/components/ui/Badge';
import { Stat } from '@/components/ui/Stat';
import formatEventDate from '@/lib/formatEventDate';
import type { EventView, FeedbackView, SessionView } from '@/lib/schemas/api';

/**
 * 강연자 화면이 PDF로 내보내는 문서입니다. 언제 붙었다 사라지는지는 `hooks/useSpeakerPrint.ts`가
 * 정합니다.
 *
 * 주최자의 `DashboardPrintDocument`와 달리 한 장입니다. 저쪽은 "전체" 한 칸에 세션마다 한
 * 칸씩 더하고 마지막에 AI 요약을 붙이는데, 강연자는 자기 세션 하나만 보므로 칸을 나누고
 * 종이를 넘길 일이 없습니다. 그래서 칸 높이를 고정하지 않고 내용이 흐르게 뒀습니다.
 *
 * 요약 리포트 칸도 없습니다. 리포트는 이벤트 단위(`Report`에 `sessionId`가 없습니다)라
 * 세션별로 뽑을 수 있는 값이 아니고, 생성 API도 주최자 전용입니다.
 *
 * 「독성 플래그」 타일이 빠진 자리는 그대로 둡니다. 공개 뷰(`FeedbackView`)에 `toxic`이 없어서
 * 셀 수 없고, 모더레이션 신호를 공개 경로로 내보내지 않기로 한 계약이라 앞으로도 오지 않습니다.
 *
 * 화면 밖(`-left-[200vw]`)에 두고 인쇄할 때만 종이 위로 올립니다. `display: none`으로 숨기면
 * 안 되는 이유는 `useDashboardPrint.ts`의 `SETTLE_FRAMES` 주석에 적혀 있습니다.
 *
 * `data-print-document` 속성이 `app/globals.css`의 인쇄 규칙과 짝입니다 — 이 속성이 붙은
 * 문서가 있을 때만 나머지 화면을 걷어냅니다. 주최자 문서와 같은 속성을 쓰므로 규칙을 새로
 * 추가할 필요가 없습니다.
 */

/* 카드 모양이 대시보드의 다른 섹션과 같습니다. `components/ui/`에 카드 프리미티브가 아직 없습니다. */
const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';
const CARD_TITLE = 'text-xs font-normal leading-4 text-text-tertiary';

/**
 * A4 세로의 내용 폭입니다(210mm - `@page`의 좌우 여백 12mm씩).
 *
 * 길이 단위 규칙(CLAUDE.md)에서 벗어난 자리입니다. 여기서 정하는 건 화면 요소의 크기가 아니라
 * 종이 크기라 종이를 재는 단위를 그대로 씁니다. 화면 밖에 있는 동안에도 이 폭을 지켜야
 * 인쇄 순간에 폭이 바뀌지 않고, 그래야 추이 차트가 다시 크기를 재려다 빈칸으로 나가지 않습니다.
 */
const PAGE_WIDTH = 'w-[186mm]';
/**
 * 종이에 적는 시각입니다. 화면이 쓰는 `toRelativeTime`(「20일 전」)은 읽는 시점이 기준이라,
 * 나중에 열어 본 사람에게는 뜻이 달라집니다. 인쇄물에는 절대값이 맞습니다.
 */
const toPrintTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });


interface SpeakerPrintDocumentProps {
  event: EventView;
  session: SessionView;
  /** 서버 집계에서 옮긴 값입니다(`summarizeBreakdown`). */
  summary: SentimentSummary;
  /** 미분류까지 포함한 전체 건수입니다. 비율의 분모와 다릅니다. */
  totalCount: number;
  trend: TrendPoint[];
  keywords: KeywordCount[];
  /**
   * 원문을 실을 소감입니다. 누적 기록(`useSessionArchive`)을 그대로 받습니다 — 스냅샷의
   * 최근 50건이 아니라 화면을 켜둔 동안 모인 전부라, 종이에 담을 수 있는 최대치입니다.
   */
  feedbacks: FeedbackView[];
  /**
   * AI 리포트 본문입니다. 강연자가 화면에서 만들어두지 않았으면 `null`이고, 그때는 칸 자체를
   * 넣지 않습니다 — 빈 제목만 남으면 요약을 만들었는데 실패한 것처럼 보입니다.
   */
  summaryText: string | null;
  /**
   * 리포트를 만들 때 함께 넘긴 발표 자료 요약입니다. 자료를 붙이지 않았으면 `null`입니다.
   *
   * 본문과 나란히 싣는 이유는 이게 요약의 **입력**이기 때문입니다. 리포트 본문은 소감과 이
   * 자료 요약을 함께 보고 쓰인 것이라, 자료 쪽을 빼면 받아 본 사람이 결론만 보고 근거를
   * 되짚을 수 없습니다.
   */
  materialSummary: string | null;
  /** 리포트가 완성된 시각입니다. 언제까지의 소감을 본 요약인지 종이에 남깁니다. */
  generatedAt: string | null;
}

const SpeakerPrintDocument = ({
  event,
  session,
  summary,
  totalCount,
  trend,
  keywords,
  feedbacks,
  summaryText,
  materialSummary,
  generatedAt,
}: SpeakerPrintDocumentProps) => {
  /*
   * `document`를 바로 읽습니다. 이 컴포넌트는 강연자가 버튼을 누른 뒤에만 트리에 들어오므로
   * 서버 렌더에서는 여기까지 오지 않습니다.
   */
  return createPortal(
    <div
      data-print-document
      /* 화면에 보이지 않는 사본입니다. 스크린리더가 같은 내용을 두 번 읽지 않게 합니다. */
      aria-hidden
      className={`absolute top-0 -left-[200vw] flex flex-col gap-3 bg-background-default print:static ${PAGE_WIDTH}`}
    >
      {/*
       * 이벤트 제목과 세션 이름을 함께 답니다. 낱장으로 흩어지거나 다른 보고서에 섞여도
       * 어느 행사의 어느 세션인지 남아야 합니다.
       */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-default pb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl leading-7 font-semibold text-text-primary">{event.title}</h1>
          <Badge tone="info">{session.title}</Badge>
        </div>
        <span className="shrink-0 text-xs leading-4 font-normal text-text-tertiary">
          {formatEventDate(event.eventDate)}
        </span>
      </header>

      {/* 화면 상단 타일과 같은 값·같은 순서입니다. */}
      <div className="grid shrink-0 grid-cols-3 gap-3">
        <Stat label="총 소감" value={`${totalCount}`} />
        <Stat label="긍정 비율" value={`${summary.positiveRate}%`} tone="positive" />
        <Stat label="미분류" value={`${summary.unclassified}`} tone="muted" />
      </div>

      <div className="grid shrink-0 grid-cols-[14rem_1fr] gap-3">
        <section className={CARD}>
          <h2 className={CARD_TITLE}>감정 분포</h2>
          {/* 종이에는 좁은 화면이 없어서 온도계 쪽은 쓰지 않습니다. */}
          <Donut
            positive={summary.positive}
            neutral={summary.neutral}
            negative={summary.negative}
            className="py-1"
          />
        </section>

        {/*
         * 「실시간 갱신 중」도 선이 그려지는 애니메이션도 종이에서는 뜻이 없습니다.
         * 애니메이션은 켜두면 선이 통째로 빠진 채 인쇄됩니다(`SentimentTrendChart`).
         */}
        <SentimentTrendCard
          trend={trend}
          positive={summary.positive}
          neutral={summary.neutral}
          negative={summary.negative}
          isLive={false}
          isAnimated={false}
        />
      </div>

      <KeywordCard keywords={keywords} />

      {/*
       * 요약은 키워드 다음, 원문 장 앞에 둡니다. 요약 → 근거(원문) 순서라 읽는 사람이
       * 문장을 먼저 보고 뒷장에서 확인하게 됩니다.
       */}
      {summaryText !== null && (
        <section className={CARD}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className={CARD_TITLE}>AI 리포트</h2>

            {/* 언제까지의 소감을 본 요약인지 남깁니다. 종이에는 「몇 분 전」이 뜻이 없습니다. */}
            {generatedAt !== null && (
              <span className="shrink-0 text-xs leading-4 font-normal text-text-tertiary">
                {toPrintTime(generatedAt)} 생성
              </span>
            )}
          </div>

          <p className="text-sm leading-6 font-normal whitespace-pre-line text-text-secondary">
            {summaryText}
          </p>

          {/*
           * 자료 요약은 본문 뒤에 둡니다. 결론을 먼저 읽고 그 근거를 확인하는 순서라, 아래
           * 소감 원문과도 같은 배치입니다.
           *
           * 자료를 안 붙인 리포트에서는 칸을 통째로 뺍니다. 「없음」이라고 적으면 자료를 붙였는데
           * 요약에 실패한 것처럼 읽힙니다.
           */}
          {materialSummary !== null && (
            <div className="flex flex-col gap-1 border-t border-border-subtle pt-2">
              <h3 className={CARD_TITLE}>발표 자료 요약</h3>
              <p className="text-sm leading-6 font-normal whitespace-pre-line text-text-secondary">
                {materialSummary}
              </p>
            </div>
          )}
        </section>
      )}

      {/*
       * 추이 차트만 모집단이 다르다는 사실을 종이에도 남깁니다. 위 타일과 도넛은 서버가
       * 전량으로 집계해 보낸 값이지만, 추이는 이 화면을 켜둔 동안 모인 소감으로 그립니다
       * (`lib/storage/sessionArchive.ts`). 받아 본 사람이 두 값을 대조하다 어긋난 것으로
       * 오해하지 않도록 문서 안에 근거를 둡니다.
       */}
      <p className="text-xs leading-4 font-normal text-text-tertiary">
        총 소감·감정 분포·키워드는 전체 집계입니다. 시간대별 추이는 이 화면을 열어둔 동안 모인
        소감으로 그립니다.
      </p>

      {/*
       * 소감 원문입니다. 주최자 문서에는 없는 칸입니다 — 그쪽은 이벤트 전체 소감을 받아 세션마다
       * 장을 만들어서, 원문까지 실으면 문서가 수십 장이 됩니다. 여기는 세션 하나뿐이라 그만큼
       * 나오지 않습니다.
       *
       * 두 단으로 세웁니다. 소감이 한두 줄짜리가 많아 한 단으로 두면 오른쪽이 절반 넘게 빕니다.
       * `column-fill`은 기본값(balance)을 씁니다. `auto`로 두면 안 됩니다 — 높이 제약이 없는
       * 컨테이너에서는 첫 단에 전부 쌓여서 한 단짜리 문서가 됩니다(실측 12330px, 약 12장).
       * `break-inside-avoid`는 소감 하나가 단이나 장 경계에서 잘리는 것을 막습니다.
       *
       * 담는 것은 스냅샷의 최근 50건이 아니라 누적 기록 전부입니다. 화면을 켜기 전에 들어온
       * 소감은 여기에도 마지막 50건까지만 잡힙니다.
       */}
      {feedbacks.length > 0 && (
        <section className="flex break-before-page flex-col gap-3 pt-3">
          <h2 className={CARD_TITLE}>소감 원문 {feedbacks.length}건</h2>

          <div className="columns-2 gap-3">
            {feedbacks.map((feedback) => (
              <div key={feedback.id} className="mb-2 break-inside-avoid">
                <FeedItem
                  state="normal"
                  sentiment={FEED_SENTIMENT[feedback.sentiment]}
                  meta={toPrintTime(feedback.createdAt)}
                  content={feedback.text}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>,
    document.body,
  );
};

export { SpeakerPrintDocument };
