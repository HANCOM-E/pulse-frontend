import { describe, expect, it } from 'vitest';
import {
  buildTrend,
  countKeywords,
  isNegativeAlerting,
  isPositiveSurging,
  summarizeSentiments,
} from '@/components/dashboard/metrics';
import type { Feedback, Sentiment } from '@/lib/schemas/api';

/**
 * 대시보드 숫자를 정하는 계산입니다. 화면에 붙은 뒤에는 눈으로 검산하기 어렵습니다.
 * 22건이 들어온 화면에서 "긍정 40%"가 맞는지 세어볼 수 없어서 여기서 봅니다.
 *
 * 칸 라벨(`09:05`)은 `toLocaleTimeString`이 실행 환경 시간대를 따르므로 문자열을
 * 박아두지 않습니다. 대신 칸이 몇 개인지, 경계가 5분에 맞춰졌는지, 뒤에 소감이
 * 붙어도 앞 칸이 그대로인지를 봅니다.
 */

/** 09:03 — 일부러 5분 경계가 아닌 시각입니다. 내림이 실제로 도는지 보려는 것입니다. */
const FIRST_AT = Date.parse('2026-08-13T09:03:00.000Z');

const at = (minutesLater: number) => new Date(FIRST_AT + minutesLater * 60_000).toISOString();

const makeFeedback = (overrides: Partial<Feedback> = {}): Feedback => ({
  id: 1,
  sessionId: 101,
  text: '소감',
  sentiment: 'POS',
  keywords: [],
  createdAt: at(0),
  toxic: false,
  taggerVersion: 'v1',
  status: 'VISIBLE',
  ...overrides,
});

const withSentiments = (...sentiments: Sentiment[]) =>
  sentiments.map((sentiment, index) => makeFeedback({ id: index + 1, sentiment }));

/** 라벨에서 분만 뽑습니다. `09:05` → 5 */
const minuteOf = (label: string) => Number(label.split(':')[1]);

describe('buildTrend', () => {
  it('소감이 없으면 빈 배열이다', () => {
    expect(buildTrend([])).toEqual([]);
  });

  it('첫 칸의 경계를 5분 단위로 내린다', () => {
    const [first] = buildTrend([makeFeedback()]);

    expect(minuteOf(first.label) % 5).toBe(0);
  });

  it('같은 5분 안의 소감은 한 칸에 모인다', () => {
    const trend = buildTrend([
      makeFeedback({ id: 1, createdAt: at(0) }),
      makeFeedback({ id: 2, createdAt: at(1), sentiment: 'NEG' }),
    ]);

    expect(trend).toHaveLength(1);
    expect(trend[0]).toMatchObject({ POS: 1, NEU: 0, NEG: 1 });
  });

  it('소감이 없는 칸도 자리를 채운다', () => {
    // 09:03과 09:17 → 09:00 · 09:05 · 09:10 · 09:15 네 칸
    const trend = buildTrend([
      makeFeedback({ id: 1, createdAt: at(0) }),
      makeFeedback({ id: 2, createdAt: at(14) }),
    ]);

    expect(trend).toHaveLength(4);
    expect(trend.map((point) => point.POS)).toEqual([1, 0, 0, 1]);
  });

  it('뒤에 붙는 소감이 앞 칸의 경계를 밀지 않는다', () => {
    const before = buildTrend([makeFeedback()]);
    const after = buildTrend([makeFeedback(), makeFeedback({ id: 2, createdAt: at(14) })]);

    expect(after[0].label).toBe(before[0].label);
  });

  it('UNKNOWN은 감정선에 올리지 않는다', () => {
    const trend = buildTrend([makeFeedback({ sentiment: 'UNKNOWN' })]);

    expect(trend).toHaveLength(1);
    expect(trend[0]).toMatchObject({ POS: 0, NEU: 0, NEG: 0 });
  });
});

describe('countKeywords', () => {
  it('빈도순으로 준다', () => {
    const keywords = countKeywords([
      makeFeedback({ id: 1, keywords: ['데모', '속도'] }),
      makeFeedback({ id: 2, keywords: ['데모'] }),
    ]);

    expect(keywords).toEqual([
      ['데모', 2],
      ['속도', 1],
    ]);
  });

  it('같은 횟수면 가나다순으로 고정한다', () => {
    const keywords = countKeywords([makeFeedback({ keywords: ['진행', '내용', '발표'] })]);

    expect(keywords.map(([keyword]) => keyword)).toEqual(['내용', '발표', '진행']);
  });

  it('열 개까지만 준다', () => {
    const many = Array.from({ length: 12 }, (_, index) => `키워드${index}`);

    expect(countKeywords([makeFeedback({ keywords: many })])).toHaveLength(10);
  });
});

describe('summarizeSentiments', () => {
  it('감정별로 센다', () => {
    const summary = summarizeSentiments(withSentiments('POS', 'POS', 'NEU', 'NEG', 'UNKNOWN'));

    expect(summary).toMatchObject({ positive: 2, neutral: 1, negative: 1, unclassified: 1 });
  });

  it('긍정 비율의 분모에서 미분류를 뺀다', () => {
    // 분류된 건 POS 1 · NEU 1뿐이라 50%입니다. 미분류를 넣으면 25%가 됩니다.
    const summary = summarizeSentiments(withSentiments('POS', 'NEU', 'UNKNOWN', 'UNKNOWN'));

    expect(summary.positiveRate).toBe(50);
  });

  it('분류된 소감이 하나도 없으면 0%다', () => {
    expect(summarizeSentiments(withSentiments('UNKNOWN')).positiveRate).toBe(0);
    expect(summarizeSentiments([]).positiveRate).toBe(0);
  });
});

/*
 * 여기부터는 주최자 실시간 알림 판정입니다(#253).
 *
 * 임계값을 상수로 불러오지 않고 숫자를 그대로 적습니다. 상수를 쓰면 값을 잘못 바꿔도
 * 테스트가 같이 따라가서 아무것도 잡지 못합니다. 여기 적힌 숫자가 어긋나면 그건
 * 규칙이 바뀌었다는 뜻이고, 바꾼 사람이 이 파일도 같이 고쳐야 합니다.
 */

/** 급증 판정은 `now`로부터의 나이만 봅니다. 위 `at()`과 기준이 달라 따로 둡니다. */
const NOW = Date.parse('2026-08-13T10:00:00.000Z');

const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

/** 지금으로부터 몇 분 전인지를 받아 긍정 소감을 만듭니다(`makeFeedback`의 기본이 POS입니다). */
const positivesAgo = (minutes: number[]) =>
  minutes.map((minute, index) => makeFeedback({ id: index + 1, createdAt: minutesAgo(minute) }));

/**
 * 최근 창(1분 30초) 안에 흩어진 긍정 4건입니다. 하한을 딱 채우는 수입니다.
 */
const RECENT_FOUR = [0.2, 0.5, 0.9, 1.3];

/**
 * 기준 구간(1분 30초~7분 30초) 밖의 아주 오래된 기록 한 건입니다.
 *
 * 판정이 기준 구간을 온전히 6분으로 잡게 만드는 표식입니다. 이게 없으면 목록이 이제 막
 * 시작된 것으로 보여 관측 폭 보정이 걸리고, 배수를 확인하려던 케이스가 보류로 새어 나갑니다.
 */
const OLD_MARK = [20];

/**
 * 세션이 `elapsed`분 진행되는 동안 분당 `perMinute`건이 일정하게 들어온 경우입니다.
 * 속도가 한 번도 변하지 않았으므로 어느 시점에 재도 급증이면 안 됩니다.
 */
const steadyAges = (elapsed: number, perMinute: number) =>
  Array.from({ length: Math.round(elapsed * perMinute) }, (_, index) => index / perMinute);

describe('isNegativeAlerting', () => {
  it('표본이 모자라면 비율이 높아도 알리지 않는다', () => {
    // 3건 중 2건이 부정이면 67%지만, 이벤트 초반의 우연을 경고로 올릴 수는 없습니다.
    expect(isNegativeAlerting({ negativeRate: 67, classified: 3, wasAlerting: false })).toBe(false);
  });

  it('표본이 차고 켜지는 선에 닿으면 알린다', () => {
    expect(isNegativeAlerting({ negativeRate: 50, classified: 20, wasAlerting: false })).toBe(true);
  });

  it('켜지는 선에 한 칸 못 미치면 알리지 않는다', () => {
    expect(isNegativeAlerting({ negativeRate: 49, classified: 20, wasAlerting: false })).toBe(
      false,
    );
  });

  it('한 번 켜지면 켜지는 선 아래로 내려가도 유지된다', () => {
    // 45%는 새로 켤 수 없는 값입니다. 이미 떠 있을 때만 유지됩니다 — 이게 히스테리시스입니다.
    expect(isNegativeAlerting({ negativeRate: 45, classified: 20, wasAlerting: true })).toBe(true);
    expect(isNegativeAlerting({ negativeRate: 45, classified: 20, wasAlerting: false })).toBe(
      false,
    );
  });

  it('꺼지는 선 아래로 내려가면 꺼진다', () => {
    expect(isNegativeAlerting({ negativeRate: 41, classified: 20, wasAlerting: true })).toBe(false);
  });

  it('표본이 하한 아래로 줄면 떠 있던 것도 꺼진다', () => {
    // 소감을 지우거나 세션 필터를 좁히면 분모가 줄어듭니다.
    expect(isNegativeAlerting({ negativeRate: 90, classified: 19, wasAlerting: true })).toBe(false);
  });
});

describe('isPositiveSurging', () => {
  it('최근 긍정이 하한에 못 미치면 급증이 아니다', () => {
    // 앞 구간이 통째로 비어 있어도 3건은 "늘었다"고 하지 않습니다.
    expect(isPositiveSurging(positivesAgo([0.2, 0.5, 0.9, ...OLD_MARK]), NOW)).toBe(false);
  });

  it('앞 구간이 비었어도 하한을 채우면 급증이다', () => {
    expect(isPositiveSurging(positivesAgo([...RECENT_FOUR, ...OLD_MARK]), NOW)).toBe(true);
  });

  it('앞 구간과 견줘 배수에 못 미치면 급증이 아니다', () => {
    // 기준 6분에 24건이면 창(1분 30초)당 6건입니다. 최근 4건은 오히려 줄어든 것입니다.
    const baseline = Array.from({ length: 24 }, (_, index) => 2 + index * 0.19);

    expect(isPositiveSurging(positivesAgo([...RECENT_FOUR, ...baseline, ...OLD_MARK]), NOW)).toBe(
      false,
    );
  });

  it('앞 구간의 두 배 이상이면 급증이다', () => {
    // 기준 6분에 4건이면 창당 1건. 최근 4건은 두 배를 넘습니다.
    const baseline = [2, 3, 4, 5];

    expect(isPositiveSurging(positivesAgo([...RECENT_FOUR, ...baseline, ...OLD_MARK]), NOW)).toBe(
      true,
    );
  });

  it('기준 구간보다 오래된 소감은 세지 않는다', () => {
    // 8~12분 전에 50건이 몰렸어도 지금 판정에는 끼지 않습니다. 끼면 급증이 묻힙니다.
    const old = Array.from({ length: 50 }, (_, index) => 8 + index * 0.08);

    expect(isPositiveSurging(positivesAgo([...RECENT_FOUR, ...old]), NOW)).toBe(true);
  });

  it('긍정이 아닌 소감은 세지 않는다', () => {
    const negatives = RECENT_FOUR.map((minute, index) =>
      makeFeedback({ id: index + 1, createdAt: minutesAgo(minute), sentiment: 'NEG' }),
    );

    expect(isPositiveSurging(negatives, NOW)).toBe(false);
  });

  it('서버 시각이 조금 앞서도 최근 구간으로 센다', () => {
    // 미래로 찍힌 소감은 방금 들어온 것입니다. 버리면 급증이 한 박자 늦게 잡힙니다.
    expect(isPositiveSurging(positivesAgo([-0.1, 0.5, 0.9, 1.3, ...OLD_MARK]), NOW)).toBe(true);
  });

  it('시간이 지나 최근 구간을 벗어나면 저절로 거짓이 된다', () => {
    // 같은 목록을 3분 뒤에 다시 판정한 것입니다. 배너가 알아서 내려가는 근거입니다.
    const surged = positivesAgo([...RECENT_FOUR, ...OLD_MARK]);

    expect(isPositiveSurging(surged, NOW)).toBe(true);
    expect(isPositiveSurging(surged, NOW + 3 * 60_000)).toBe(false);
  });

  /*
   * 아래 두 개가 관측 폭 보정입니다. 기준 구간이 아직 다 차지 않은 세션에서, 속도가 한 번도
   * 변하지 않았는데 급증으로 잡히던 문제를 막습니다. 보정이 없으면 둘 다 참이 됩니다.
   */

  it('기준 구간이 덜 찬 세션에서 속도가 일정하면 급증이 아니다', () => {
    // 시작 4분째, 분당 6건이 계속 들어오는 중입니다. 빨라진 적이 없습니다.
    expect(isPositiveSurging(positivesAgo(steadyAges(4, 6)), NOW)).toBe(false);
  });

  it('견줄 앞 구간이 최근 구간보다 짧으면 판정을 미룬다', () => {
    // 시작 2분째. 비교할 과거가 없는 것이지 반응이 몰린 게 아닙니다.
    expect(isPositiveSurging(positivesAgo(steadyAges(2, 6)), NOW)).toBe(false);
  });
});
