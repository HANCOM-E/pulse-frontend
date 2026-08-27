import type { GameParticipant } from '@/lib/schemas/api';

/**
 * 1단계 레이스의 도착 순서를 만듭니다.
 *
 * 물리 시뮬레이션이 2단계라(#243) 그때까지 순서를 만들 게 없습니다. 서버가 순위를
 * 검증하지 않기로 해서(#246) 프로젝터가 정해도 계약을 어기지 않습니다.
 *
 * 컴포넌트에서 뺀 이유는 테스트하기 위해서입니다. 셔플이 균등하지 않으면 「추첨」이
 * 아니게 되는데, 눈으로는 절대 못 잡습니다(`components/dashboard/metrics.ts`와 같은 방식).
 */

/**
 * Fisher–Yates입니다. 모든 순열이 같은 확률로 나옵니다.
 *
 * `sort(() => Math.random() - 0.5)`를 쓰지 않습니다. 비교 함수가 일관되지 않아서 정렬
 * 알고리즘이 원래 순서를 부분적으로 남기고, 앞자리가 참가 순서에 쏠립니다. 먼저 들어온
 * 사람이 자꾸 1등이면 추첨이 아닙니다.
 *
 * 원본을 안 건드립니다. `game.participants`는 TanStack Query 캐시가 들고 있는 배열이라
 * 제자리에서 섞으면 다른 화면이 보는 순서까지 바뀝니다.
 */
const shuffle = <T>(values: readonly T[]): T[] => {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
};

/**
 * 화면에 드러낼 순서입니다. **꼴등이 앞**입니다 — 순위를 낮은 데서부터 공개해야
 * 1등이 마지막에 나옵니다.
 */
const buildRevealOrder = (participants: readonly GameParticipant[]): GameParticipant[] =>
  shuffle(participants);

/**
 * 서버에 올릴 순위입니다. **1등이 앞**입니다(`gameResultsRequestSchema`의 `ranking`).
 *
 * 공개 순서를 뒤집습니다. 두 방향을 한 함수에서 만들어야 어긋나지 않습니다 — 화면과
 * 요청이 각자 뒤집으면 한쪽만 고치는 실수가 열립니다.
 */
const toRanking = (revealOrder: readonly GameParticipant[]): number[] =>
  [...revealOrder].reverse().map((participant) => participant.id);

export { buildRevealOrder, toRanking };
