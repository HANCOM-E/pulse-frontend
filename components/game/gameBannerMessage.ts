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
  if (game.status === 'OPEN') return `지금 게임이 열렸어요 · ${game.participantCount}명 참가 중`;
  if (game.status === 'RUNNING') return '레이스 진행 중이에요 · 참가는 마감됐어요';

  /*
   * 계약상 `FINISHED`면 `results`가 채워지지만, 목이 아니라 실제 서버가 빠뜨리면 여기서
   * 터집니다. 1등 이름은 거들 뿐이라 없으면 문구만 바꿉니다.
   */
  const winner = game.results?.[0]?.nickname;
  return winner ? `결과가 나왔어요 · 1등 ${winner}` : '결과가 나왔어요';
};

export { gameBannerMessage, isVisibleGame, type VisibleGame };
