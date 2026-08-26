import type { SentimentSummary } from '@/components/dashboard/metrics';
import type { FeedbackView, KeywordCount, SentimentBreakdown } from '@/lib/schemas/api';

/**
 * 강연자 화면이 공개 스냅샷에서 뽑아내는 계산입니다.
 *
 * 대시보드의 `metrics.ts`와 나란히 있지만 입력이 다릅니다. 저쪽은 소감 원본 배열을 받아 직접
 * 세고, 이쪽은 서버가 이미 세어 보낸 집계를 받아 모양만 맞춥니다. 강연자에게는 `/admin`
 * 계열이 닫혀 있어서 원본 배열을 손에 넣을 방법이 없습니다.
 *
 * 그래도 비율 규칙은 저쪽과 같아야 합니다 — 분모에서 미분류를 뺍니다. 규칙이 갈라지면 같은
 * 세션을 주최자와 강연자가 나란히 봤을 때 긍정 비율이 다르게 뜹니다.
 */

/**
 * 서버 집계를 대시보드와 같은 모양으로 옮깁니다.
 *
 * 분모에서 미분류를 뺍니다. `UNKNOWN`은 태깅이 실패했다는 뜻이라 "중립"과 다르고, 분모에
 * 넣으면 분석이 많이 실패할수록 긍정 비율이 저절로 내려갑니다(`summarizeSentiments`와 같은 규칙).
 */
const summarizeBreakdown = (
  breakdown: SentimentBreakdown,
  unclassified: number,
): SentimentSummary => {
  const { POS: positive, NEU: neutral, NEG: negative } = breakdown;
  const classified = positive + neutral + negative;

  return {
    positive,
    neutral,
    negative,
    unclassified,
    classified,
    positiveRate: classified === 0 ? 0 : Math.round((positive / classified) * 100),
    negativeRate: classified === 0 ? 0 : Math.round((negative / classified) * 100),
  };
};

/**
 * 스냅샷의 키워드를 `KeywordCard`가 받는 모양으로 바꿉니다.
 *
 * 계약은 `{ keyword, count }` 객체인데 카드는 `Map` 엔트리 모양의 튜플을 받습니다. 카드 쪽을
 * 고치지 않는 이유는 그쪽 입력이 대시보드의 `countKeywords`(`Map`에서 바로 뽑습니다)라,
 * 객체로 바꾸면 훨씬 많이 쓰이는 경로에 변환이 하나 생기기 때문입니다.
 *
 * 서버가 이미 빈도순 상위 10으로 잘라 보내므로 다시 정렬하지 않습니다.
 */
const toKeywordCounts = (topKeywords: KeywordCount[]): [string, number][] =>
  topKeywords.map(({ keyword, count }) => [keyword, count]);

/** 상단 「총 소감」입니다. 미분류까지 포함한 전체 건수라 비율의 분모와 다릅니다. */
const toTotalCount = (breakdown: SentimentBreakdown, unclassified: number): number =>
  breakdown.POS + breakdown.NEU + breakdown.NEG + unclassified;

/** 추이 차트가 읽는 필드만 남깁니다. 누적 기록을 그대로 `buildTrend`에 넘길 때 씁니다. */
type ArchivedFeedback = Pick<FeedbackView, 'createdAt' | 'sentiment'>;

export { summarizeBreakdown, toKeywordCounts, toTotalCount, type ArchivedFeedback };
