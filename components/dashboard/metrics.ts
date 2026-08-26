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

/** 감정별 건수와 비율입니다. */
interface SentimentSummary {
  positive: number;
  neutral: number;
  negative: number;
  unclassified: number;
  /**
   * 비율의 분모입니다. 미분류를 뺀 수라 밖에서 다시 만들 수 없어서 같이 내보냅니다.
   * 부정 알림이 "표본이 너무 적으면 알리지 않는다"를 판단할 때 이 값을 봅니다.
   */
  classified: number;
  positiveRate: number;
  negativeRate: number;
}

/** 키워드 하나와 그 횟수입니다. `Map` 엔트리 모양 그대로라 라벨로 자리를 표시합니다. */
type KeywordCount = [keyword: string, count: number];

/**
 * 추이 계산이 실제로 읽는 필드입니다.
 *
 * `Feedback` 전체를 받지 않는 이유는 강연자 화면이 같은 차트를 공개 스냅샷의
 * `FeedbackView`로 그리기 때문입니다. 저쪽에는 `toxic`·`status`가 없지만 추이에 필요한 두
 * 필드는 있어서, 인자 타입을 여기까지만 좁혀두면 두 화면이 같은 계산을 나눠 씁니다.
 */
type TrendInput = Pick<Feedback, 'createdAt' | 'sentiment'>;

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
const buildTrend = (feedbacks: TrendInput[]) => {
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
const countKeywords = (feedbacks: Feedback[]): KeywordCount[] => {
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
 * 감정별로 세고 비율까지 냅니다.
 *
 * 분모에서 미분류를 뺍니다. `UNKNOWN`은 태깅이 실패했다는 뜻이라 "중립"과 다릅니다.
 * 분모에 넣으면 분석이 많이 실패할수록 긍정 비율이 저절로 내려갑니다.
 *
 * 세는 일과 나누는 일을 한 함수에 둔 이유가 이것입니다. 떨어져 있으면 분모를 다시 만들 때
 * 미분류를 빼는 규칙이 따라오지 않습니다. 부정 비율도 여기서 같이 내는 이유가 같습니다.
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
    classified,
    positiveRate: classified === 0 ? 0 : Math.round((positive / classified) * 100),
    negativeRate: classified === 0 ? 0 : Math.round((negative / classified) * 100),
  };
};

/*
 * 여기부터는 주최자에게 띄울 알림을 판정하는 계산입니다(#253).
 *
 * 폴링은 5초마다 누적 목록을 통째로 다시 줍니다. 그래서 "직전에 받은 목록과 견줘 늘었으면
 * 알린다"로 만들면 새로고침이나 세션 필터 변경 한 번에 가짜 급증이 잡힙니다. 아래 판정은
 * 전부 서버가 찍어준 `createdAt`과 지금 목록만 보고, 몇 번을 다시 계산해도 같은 답이 나옵니다.
 *
 * 세 알림 모두 "조건이 참인 동안 떠 있는" 상태입니다. 처음에는 급증과 독성을 지나가는
 * 사건으로 보고 토스트로 띄웠는데, 4초 만에 사라져서 화면을 보고 있어도 놓쳤습니다. 배너로
 * 옮기면서 "언제 한 번만 띄울지"를 정할 일이 없어졌고, 발화 시각과 이미 알린 단계를 들고
 * 있던 화면 쪽 상태도 같이 사라졌습니다. 조건이 풀리면 알아서 내려갑니다.
 */

/** 부정 알림이 켜지는 선입니다. */
const NEGATIVE_ALERT_ON_RATE = 50;

/**
 * 부정 알림이 꺼지는 선입니다. 켜지는 선보다 낮은 이유는, 같은 값이면 49%와 50%를 오갈 때마다
 * 배너가 5초 주기로 나타났다 사라지기 때문입니다. 한 번 켜지면 여유를 두고 내려가야 꺼집니다.
 */
const NEGATIVE_ALERT_OFF_RATE = 42;

/**
 * 비율을 믿을 수 있는 최소 표본입니다. 3건 중 2건이 부정이면 67%지만 알릴 일이 아닙니다.
 * 이벤트 초반에 부정 한 건이 들어왔다고 경고가 뜨는 것을 막습니다.
 */
const NEGATIVE_ALERT_MIN_SAMPLE = 20;

/**
 * 급증 판정이 "지금"으로 보는 구간입니다.
 *
 * 세션이 짧게 쪼개지는 행사를 염두에 두고 짧게 잡았습니다. 여기를 늘리면 판정이 둔해지는 데다
 * 배너도 그만큼 오래 남습니다 — 조건이 거짓이 되어야 내려가는데 그 조건이 이 구간이라서입니다.
 */
const SURGE_WINDOW_MS = 90_000;

/** 비교 기준이 되는 직전 구간입니다. `SURGE_WINDOW_MS`가 끝나는 지점부터 셉니다. */
const SURGE_BASELINE_MS = 6 * 60_000;

/** 최근 구간이 기준 구간(같은 길이로 환산)의 몇 배여야 급증인지입니다. */
const SURGE_RATIO = 2;

/**
 * 배수와 함께 봐야 하는 절대 하한입니다. 배수만 보면 앞 구간이 0건일 때 1건만 들어와도
 * 급증이 됩니다. 사람이 "늘었다"고 느낄 만한 최소 건수를 같이 요구합니다.
 */
const SURGE_MIN_COUNT = 4;

/**
 * 모더레이션 큐가 이만큼 쌓이면 알립니다.
 *
 * 누적 제출 건수가 아니라 "아직 큐에 남아 있는 건수"를 셉니다. 독성은 "지금 분위기"가 아니라
 * "처리할 것이 쌓였다"는 신호라, 10분 전에 들어온 악성 소감도 큐에 있으면 여전히 처리 대상입니다.
 * 반대로 주최자가 큐를 비우면 알릴 이유도 없어집니다 — 누적으로 세면 다 처리한 뒤에도 배너가
 * 영영 남습니다.
 *
 * 세는 대상이 화면의 모더레이션 큐와 같아서 배너 숫자와 큐 배지 숫자가 항상 맞습니다.
 * 큐에는 자동 판정된 독성뿐 아니라 주최자가 직접 숨긴 소감도 들어가므로, 문구도 "독성"이 아니라
 * "처리할 소감"이라고 씁니다.
 */
const MODERATION_ALERT_MIN_COUNT = 5;

interface NegativeAlertInput {
  negativeRate: number;
  classified: number;
  /** 지금 배너가 떠 있는지입니다. 켜지는 선과 꺼지는 선을 가르는 데 씁니다. */
  wasAlerting: boolean;
}

/** 부정 비율 경고를 띄울 상태인지 봅니다. 조건이 참인 동안 계속 참입니다(레벨 조건). */
const isNegativeAlerting = ({
  negativeRate,
  classified,
  wasAlerting,
}: NegativeAlertInput): boolean => {
  if (classified < NEGATIVE_ALERT_MIN_SAMPLE) return false;

  return negativeRate >= (wasAlerting ? NEGATIVE_ALERT_OFF_RATE : NEGATIVE_ALERT_ON_RATE);
};

/**
 * 최근 긍정 반응이 직전 구간보다 눈에 띄게 늘었는지 봅니다.
 *
 * 최근 2분만 보기 때문에 반응이 잦아들면 저절로 거짓이 됩니다. 배너를 내리는 별도 장치가
 * 필요 없는 것이 이 때문입니다.
 *
 * `now`를 인자로 받는 이유는 테스트 때문입니다. 안에서 `Date.now()`를 부르면 시각을 고정할
 * 수 없어서 경계값을 확인할 수 없습니다.
 *
 * 서버 시각이 클라이언트보다 조금 앞서면 `age`가 음수가 되는데, 그대로 최근 구간에 넣습니다.
 * 방금 들어온 소감이라는 뜻이라 다른 칸에 둘 이유가 없습니다.
 */
const isPositiveSurging = (feedbacks: TrendInput[], now: number): boolean => {
  let recent = 0;
  let baseline = 0;
  /* 목록이 언제부터의 기록인지입니다. 아래에서 기준 구간이 실제로 얼마나 채워졌는지 재는 데 씁니다. */
  let oldestAge = 0;

  feedbacks.forEach((feedback) => {
    if (feedback.sentiment !== 'POS') return;

    const age = now - Date.parse(feedback.createdAt);
    if (age > oldestAge) oldestAge = age;

    if (age < SURGE_WINDOW_MS) recent += 1;
    else if (age < SURGE_WINDOW_MS + SURGE_BASELINE_MS) baseline += 1;
  });

  if (recent < SURGE_MIN_COUNT) return false;

  /*
   * 기준 구간에 기록이 실제로 얼마나 있는지 잽니다. `SURGE_BASELINE_MS`로 바로 나누면 안 됩니다.
   *
   * 시작한 지 얼마 안 된 세션에서는 그 구간이 아직 다 차지 않았습니다. 3분밖에 안 된 세션의
   * 기준 구간에는 1분 남짓한 기록뿐인데 6분치로 치고 나누면 평소 속도가 실제의 몇 분의 일로
   * 잡히고, 그러면 속도가 하나도 안 변했는데도 전부 급증으로 보입니다. 세션이 기준 구간보다
   * 짧으면 세션 내내 그렇습니다.
   *
   * `oldestAge`에서 최근 구간을 빼는 이유는, 저 값이 "지금부터" 잰 나이라 최근 구간까지
   * 포함하고 있기 때문입니다. 여기서 알고 싶은 건 최근 구간이 끝나는 지점부터의 폭입니다.
   * 기록이 충분히 오래됐으면 원래대로 `SURGE_BASELINE_MS`를 씁니다.
   */
  const observed = Math.min(SURGE_BASELINE_MS, oldestAge - SURGE_WINDOW_MS);

  /*
   * 견줄 앞 구간이 최근 구간보다도 짧으면 판정을 미룹니다. 이제 막 시작해서 비교 대상이 없는
   * 것이지 반응이 몰린 게 아닙니다. 시작 직후에 소감이 들어오는 건 급증이 아니라 당연한 일입니다.
   */
  if (observed < SURGE_WINDOW_MS) return false;

  /* 기준 구간을 최근 구간과 같은 길이로 줄여야 두 수를 견줄 수 있습니다. */
  const baselinePerWindow = (baseline * SURGE_WINDOW_MS) / observed;

  return recent >= baselinePerWindow * SURGE_RATIO;
};

export {
  MODERATION_ALERT_MIN_COUNT,
  TREND_BUCKET_MS,
  buildTrend,
  countKeywords,
  isNegativeAlerting,
  isPositiveSurging,
  summarizeSentiments,
  toRelativeTime,
  type KeywordCount,
  type SentimentSummary,
  type TrendInput,
  type TrendPoint,
};
