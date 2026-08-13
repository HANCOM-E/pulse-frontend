import type { Feedback } from '@/lib/schemas/api';

/**
 * 대시보드가 소감 원본에서 뽑아내는 계산입니다.
 *
 * 화면에서 떼어낸 이유는 두 가지입니다. 숫자를 정하는 규칙(미분류를 분모에서 빼는 것,
 * 칸 경계를 내림하는 것)이 렌더 코드 사이에 흩어져 있으면 나중에 한쪽만 바뀝니다.
 * 그리고 `vitest`가 `environment: 'node'`라, 순수 함수로 있어야 테스트가 붙습니다.
 *
 * 선례는 두 감정 차트가 공유하는 `components/feedback/sentiment.ts`입니다.
 */

/** 추이 차트의 가로 한 칸입니다. */
const TREND_BUCKET_MS = 5 * 60_000;

/** 상위 키워드 노출 개수입니다. 공개 스냅샷 계약(`TOP_KEYWORD_LIMIT`)과 같은 값입니다. */
const KEYWORD_LIMIT = 10;

const toClock = (ms: number) =>
  new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

const toRelativeTime = (iso: string) => {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000);

  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  return `${Math.floor(hours / 24)}일 전`;
};

/** 추이 차트의 한 점입니다. 감정 키는 API의 `Sentiment`를 그대로 씁니다(`UNKNOWN` 제외). */
interface TrendPoint {
  label: string;
  POS: number;
  NEU: number;
  NEG: number;
}

/** 감정별 건수와 긍정 비율입니다. */
interface SentimentSummary {
  positive: number;
  neutral: number;
  negative: number;
  unclassified: number;
  positiveRate: number;
}

/**
 * 소감을 5분 칸으로 묶어 감정별 건수를 셉니다.
 *
 * 누적이 아니라 칸별 건수입니다. 누적은 언제 반응이 몰렸는지가 기울기로만 남아서,
 * 진행 중인 이벤트에서 "지금 분위기가 꺾였다"를 읽어내기 어렵습니다.
 *
 * 첫 소감 시각을 칸 경계로 내림해서 시작합니다. 그래야 폴링으로 뒤에 붙는 소감이
 * 앞 칸들의 경계를 밀지 않아 차트가 흔들리지 않습니다. `UNKNOWN`은 태깅 실패라
 * 감정선에 올리지 않습니다.
 */
const buildTrend = (feedbacks: Feedback[]) => {
  if (feedbacks.length === 0) return [];

  const times = feedbacks.map((feedback) => Date.parse(feedback.createdAt));
  const start = Math.floor(Math.min(...times) / TREND_BUCKET_MS) * TREND_BUCKET_MS;
  const end = Math.max(...times);

  const buckets: TrendPoint[] = [];
  for (let at = start; at <= end; at += TREND_BUCKET_MS) {
    buckets.push({ label: toClock(at), POS: 0, NEU: 0, NEG: 0 });
  }

  feedbacks.forEach((feedback) => {
    if (feedback.sentiment === 'UNKNOWN') return;

    const bucket = buckets[Math.floor((Date.parse(feedback.createdAt) - start) / TREND_BUCKET_MS)];
    if (bucket) bucket[feedback.sentiment] += 1;
  });

  return buckets;
};

/** 빈도순 상위 키워드입니다. 같은 횟수면 가나다순으로 고정해서 폴링마다 순서가 바뀌지 않게 합니다. */
const countKeywords = (feedbacks: Feedback[]) => {
  const counts = new Map<string, number>();

  feedbacks.forEach((feedback) => {
    feedback.keywords.forEach((keyword) => {
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    });
  });

  return [...counts]
    .sort(([leftWord, leftCount], [rightWord, rightCount]) =>
      rightCount === leftCount ? leftWord.localeCompare(rightWord) : rightCount - leftCount,
    )
    .slice(0, KEYWORD_LIMIT);
};

/**
 * 감정별로 세고 긍정 비율까지 냅니다.
 *
 * 분모에서 미분류를 뺍니다. `UNKNOWN`은 태깅이 실패했다는 뜻이라 "중립"과 다릅니다.
 * 분모에 넣으면 분석이 많이 실패할수록 긍정 비율이 저절로 내려갑니다.
 *
 * 세는 일과 나누는 일을 한 함수에 둔 이유가 이것입니다. 떨어져 있으면 분모를 다시 만들 때
 * 미분류를 빼는 규칙이 따라오지 않습니다.
 */
const summarizeSentiments = (feedbacks: Feedback[]): SentimentSummary => {
  const positive = feedbacks.filter((feedback) => feedback.sentiment === 'POS').length;
  const neutral = feedbacks.filter((feedback) => feedback.sentiment === 'NEU').length;
  const negative = feedbacks.filter((feedback) => feedback.sentiment === 'NEG').length;
  const unclassified = feedbacks.filter((feedback) => feedback.sentiment === 'UNKNOWN').length;

  const classified = positive + neutral + negative;

  return {
    positive,
    neutral,
    negative,
    unclassified,
    positiveRate: classified === 0 ? 0 : Math.round((positive / classified) * 100),
  };
};

export {
  TREND_BUCKET_MS,
  buildTrend,
  countKeywords,
  summarizeSentiments,
  toRelativeTime,
  type TrendPoint,
};
