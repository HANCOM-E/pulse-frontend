import type { GameStatus, GameView } from '@/lib/schemas/api';

/**
 * 배너 문구를 만드는 순수 함수입니다. 컴포넌트에서 뺀 이유는 테스트하기 위해서입니다 —
 * `vitest.config`가 `environment: 'node'`라 렌더링 테스트를 못 씁니다
 * (`components/dashboard/metrics.ts`와 같은 방식).
 */

/**
 * `DRAFT`는 서버가 `games/current`에서 이미 빼므로 화면에 닿지 않습니다. 타입에서도 빼서
 * 아래 분기가 도달할 수 없는 경우를 다루지 않게 합니다(`eventStatusBadge`와 같은 방식).
 */
type VisibleGameStatus = Exclude<GameStatus, 'DRAFT'>;

type VisibleGame = GameView & { status: VisibleGameStatus };

const isVisibleGame = (game: GameView): game is VisibleGame => game.status !== 'DRAFT';

const gameBannerMessage = (game: VisibleGame): string => {
  const count = game.participants.length;

  if (game.status === 'OPEN') return `지금 게임이 열렸어요 · ${count}명 참가 중`;
  if (game.status === 'RUNNING') return '레이스 진행 중이에요 · 참가는 마감됐어요';

  /*
   * 1등 이름은 `ranking`의 첫 참가자를 명단에서 찾아 붙입니다. 서버가 순위에 id만 담고
   * 닉네임은 안 주기 때문입니다(2026-08-28 실서버 확인).
   *
   * 못 찾아도 터지지 않게 둡니다. 이름은 거들 뿐이라 없으면 문구만 바꿉니다.
   */
  const winnerId = game.ranking[0];
  const winner = game.participants.find((participant) => participant.id === winnerId);

  return winner ? `결과가 나왔어요 · 1등 ${winner.nickname}` : '결과가 나왔어요';
};

export { gameBannerMessage, isVisibleGame, type VisibleGame };
