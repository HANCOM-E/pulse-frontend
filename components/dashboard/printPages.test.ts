import { describe, expect, it } from 'vitest';

import { buildPrintPages } from '@/components/dashboard/printPages';
import type { Feedback, SessionView } from '@/lib/schemas/api';

/**
 * PDF 한 장에 들어갈 숫자입니다. 화면과 달리 눈으로 검산할 수 없어서 여기서 봅니다 —
 * 버튼을 눌러야 나타나고, 인쇄창을 닫으면 사라지고, 틀려도 종이에서만 틀립니다.
 *
 * 특히 독성 플래그는 화면에서는 맞고 PDF에서만 0으로 나가는 종류의 실수라(집계 모집단이
 * 다른 유일한 숫자입니다) 따로 못 박아둡니다.
 */

const makeFeedback = (overrides: Partial<Feedback> = {}): Feedback => ({
  id: 1,
  sessionId: 101,
  text: '소감',
  sentiment: 'POS',
  keywords: [],
  createdAt: '2026-08-13T09:03:00.000Z',
  toxic: false,
  taggerVersion: 'v1',
  status: 'VISIBLE',
  ...overrides,
});

const makeSession = (id: number, title: string): SessionView => ({
  id,
  title,
  order: id,
  status: 'ACTIVE',
});

const SESSIONS = [makeSession(101, '오프닝'), makeSession(102, '키노트')];

describe('buildPrintPages', () => {
  it('"전체" 한 장으로 시작해 세션을 받은 순서대로 잇는다', () => {
    const pages = buildPrintPages([], SESSIONS);

    expect(pages.map((page) => page.title)).toEqual(['전체', '오프닝', '키노트']);
    expect(pages.map((page) => page.sessionId)).toEqual([null, 101, 102]);
  });

  it('소감이 한 건도 없는 세션도 자기 장을 받는다', () => {
    const pages = buildPrintPages([makeFeedback({ sessionId: 101 })], SESSIONS);

    expect(pages).toHaveLength(3);
    expect(pages[2]).toMatchObject({ title: '키노트', visibleCount: 0, toxicCount: 0 });
    expect(pages[2].trend).toEqual([]);
    expect(pages[2].keywords).toEqual([]);
  });

  it('세션 장은 그 세션의 소감만 센다', () => {
    const pages = buildPrintPages(
      [
        makeFeedback({ id: 1, sessionId: 101, sentiment: 'POS' }),
        makeFeedback({ id: 2, sessionId: 101, sentiment: 'NEG' }),
        makeFeedback({ id: 3, sessionId: 102, sentiment: 'POS' }),
      ],
      SESSIONS,
    );

    expect(pages[0].visibleCount).toBe(3);
    expect(pages[1]).toMatchObject({ visibleCount: 2, summary: { positive: 1, negative: 1 } });
    expect(pages[2]).toMatchObject({ visibleCount: 1, summary: { positive: 1, negative: 0 } });
  });

  it('숨긴 소감은 집계에서 뺀다', () => {
    const pages = buildPrintPages(
      [
        makeFeedback({ id: 1, sessionId: 101 }),
        makeFeedback({ id: 2, sessionId: 101, status: 'HIDDEN', keywords: ['숨김'] }),
      ],
      SESSIONS,
    );

    expect(pages[1].visibleCount).toBe(1);
    expect(pages[1].summary.positive).toBe(1);
    expect(pages[1].keywords).toEqual([]);
  });

  it('독성 플래그만은 숨긴 소감까지 센다', () => {
    /* 독성 소감은 제출 시점에 이미 HIDDEN이라, VISIBLE만 세면 늘 0입니다. */
    const pages = buildPrintPages(
      [
        makeFeedback({ id: 1, sessionId: 101, status: 'HIDDEN', toxic: true }),
        makeFeedback({ id: 2, sessionId: 102, status: 'HIDDEN', toxic: true }),
        makeFeedback({ id: 3, sessionId: 102, status: 'VISIBLE' }),
      ],
      SESSIONS,
    );

    expect(pages[0]).toMatchObject({ visibleCount: 1, toxicCount: 2 });
    expect(pages[1]).toMatchObject({ visibleCount: 0, toxicCount: 1 });
    expect(pages[2]).toMatchObject({ visibleCount: 1, toxicCount: 1 });
  });

  it('키워드와 추이도 장마다 따로 뽑는다', () => {
    const pages = buildPrintPages(
      [
        makeFeedback({ id: 1, sessionId: 101, keywords: ['발표'] }),
        makeFeedback({ id: 2, sessionId: 102, keywords: ['질문'] }),
      ],
      SESSIONS,
    );

    expect(pages[0].keywords).toEqual([
      ['발표', 1],
      ['질문', 1],
    ]);
    expect(pages[1].keywords).toEqual([['발표', 1]]);
    expect(pages[2].keywords).toEqual([['질문', 1]]);
    expect(pages[1].trend).toHaveLength(1);
  });

  it('세션이 없으면 "전체" 한 장뿐이다', () => {
    const pages = buildPrintPages([makeFeedback()], []);

    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('전체');
  });
});
