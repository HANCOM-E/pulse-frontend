import { describe, expect, it } from 'vitest';

import { buildRevealOrder, toRanking } from '@/components/game/host/raceOrder';
import type { GameParticipant } from '@/lib/schemas/api';

/**
 * 셔플이 균등한지는 눈으로 못 봅니다. 먼저 들어온 사람이 자꾸 1등이어도 몇 판 돌려서는
 * 티가 안 나고, 행사에서 드러나면 이미 늦습니다.
 */

const build = (count: number): GameParticipant[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    nickname: `참가자${index + 1}`,
    joinedAt: '2026-08-05T04:00:00.000Z',
  }));

describe('buildRevealOrder', () => {
  it('아무도 빠뜨리거나 더하지 않는다', () => {
    const participants = build(20);
    const order = buildRevealOrder(participants);

    expect(order).toHaveLength(20);
    expect([...order].map((p) => p.id).sort((a, b) => a - b)).toEqual(
      participants.map((p) => p.id),
    );
  });

  /*
   * `game.participants`는 TanStack Query 캐시가 들고 있는 배열입니다. 제자리에서 섞으면
   * 다른 화면이 보는 순서까지 바뀝니다.
   */
  it('원본을 건드리지 않는다', () => {
    const participants = build(10);
    const before = participants.map((p) => p.id);

    buildRevealOrder(participants);

    expect(participants.map((p) => p.id)).toEqual(before);
  });

  it('빈 목록과 한 명도 다루다', () => {
    expect(buildRevealOrder([])).toEqual([]);
    expect(buildRevealOrder(build(1))).toHaveLength(1);
  });

  /*
   * 이게 이 파일의 요점입니다.
   *
   * `sort(() => Math.random() - 0.5)`는 비교 함수가 일관되지 않아서 원래 순서를 부분적으로
   * 남깁니다. 참가 순서가 곧 순위가 되면 추첨이 아닙니다.
   *
   * 각 자리에 각 참가자가 나오는 횟수를 셉니다. 균등하면 1/n에 몰리고, 편향되면 대각선이
   * 도드라집니다. 4명 6000판이면 자리당 기대값이 1500이고, 균등한 셔플이 이 범위를 벗어날
   * 확률은 무시할 만합니다.
   */
  it('특정 참가자가 특정 자리에 쏠리지 않는다', () => {
    const SIZE = 4;
    const ROUNDS = 6_000;
    const EXPECTED = ROUNDS / SIZE;

    const participants = build(SIZE);
    // counts[자리][참가자 index]
    const counts = Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(0));

    for (let round = 0; round < ROUNDS; round += 1) {
      buildRevealOrder(participants).forEach((participant, position) => {
        counts[position][participant.id - 1] += 1;
      });
    }

    for (const row of counts) {
      for (const count of row) {
        expect(count).toBeGreaterThan(EXPECTED * 0.8);
        expect(count).toBeLessThan(EXPECTED * 1.2);
      }
    }
  });
});

describe('toRanking', () => {
  /*
   * 공개는 꼴등부터, 서버에 올리는 건 1등부터입니다. 방향이 반대라 한쪽만 고치면
   * 프로젝터에 1등으로 뜬 사람이 참가자 폰에서는 꼴등이 됩니다.
   */
  it('공개 순서를 뒤집어 1등부터 담는다', () => {
    const order = build(3); // 참가자1, 참가자2, 참가자3 순으로 공개 = 3등, 2등, 1등

    expect(toRanking(order)).toEqual([3, 2, 1]);
  });

  it('원본을 건드리지 않는다', () => {
    const order = build(3);

    toRanking(order);

    expect(order.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('빈 목록이면 빈 배열이다', () => {
    expect(toRanking([])).toEqual([]);
  });
});
