import { describe, expect, it } from 'vitest';
import { buildTrend, countKeywords, summarizeSentiments } from '@/components/dashboard/metrics';
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
