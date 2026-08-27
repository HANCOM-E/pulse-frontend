import { describe, expect, it } from 'vitest';

import { summarizeBreakdown, toKeywordCounts, toTotalCount } from '@/components/speaker/speakerMetrics';

describe('summarizeBreakdown', () => {
  it('미분류를 분모에서 빼고 비율을 낸다', () => {
    /* 분류 20건 중 긍정 10 → 50%. 미분류 30건은 분모에 들어가지 않는다. */
    const summary = summarizeBreakdown({ POS: 10, NEU: 5, NEG: 5 }, 30);

    expect(summary.classified).toBe(20);
    expect(summary.positiveRate).toBe(50);
    expect(summary.negativeRate).toBe(25);
    expect(summary.unclassified).toBe(30);
  });

  it('분류된 소감이 없으면 비율이 0이다', () => {
    const summary = summarizeBreakdown({ POS: 0, NEU: 0, NEG: 0 }, 7);

    expect(summary.classified).toBe(0);
    expect(summary.positiveRate).toBe(0);
    expect(summary.negativeRate).toBe(0);
  });

  it('대시보드와 같은 필드 이름으로 옮긴다', () => {
    const summary = summarizeBreakdown({ POS: 3, NEU: 2, NEG: 1 }, 0);

    expect(summary.positive).toBe(3);
    expect(summary.neutral).toBe(2);
    expect(summary.negative).toBe(1);
  });
});

describe('toTotalCount', () => {
  it('미분류까지 더한 전체 건수다', () => {
    expect(toTotalCount({ POS: 10, NEU: 5, NEG: 5 }, 30)).toBe(50);
  });
});

describe('toKeywordCounts', () => {
  it('객체를 카드가 받는 튜플로 바꾼다', () => {
    expect(
      toKeywordCounts([
        { keyword: '유익함', count: 4 },
        { keyword: '어려움', count: 2 },
      ]),
    ).toEqual([
      ['유익함', 4],
      ['어려움', 2],
    ]);
  });

  it('서버가 정한 순서를 바꾸지 않는다', () => {
    /* 서버가 이미 빈도순 상위 10으로 잘라 보내므로 다시 정렬하면 안 된다. */
    const result = toKeywordCounts([
      { keyword: 'a', count: 1 },
      { keyword: 'b', count: 9 },
    ]);

    expect(result.map(([keyword]) => keyword)).toEqual(['a', 'b']);
  });
});
