import { describe, expect, it } from 'vitest';

import { gameBannerMessage, isVisibleGame, type VisibleGame } from './gameBannerMessage';
import type { GameView } from '@/lib/schemas/api';

const build = (overrides: Partial<GameView>): GameView => ({
  id: 1,
  title: '시작 전 몸풀기',
  gameType: 'PINBALL',
  status: 'OPEN',
  participants: [],
  ranking: [],
  createdAt: '2026-08-05T04:00:00.000Z',
  ...overrides,
});

describe('isVisibleGame', () => {
  /*
   * 서버가 `current`에서 DRAFT를 빼주지만 화면이 그걸 믿고만 있으면, 실제 서버가 빠뜨렸을 때
   * "참가하기"가 뜨고 눌러보면 GAME_NOT_OPEN이 납니다.
   */
  it('DRAFT는 걸러낸다', () => {
    expect(isVisibleGame(build({ status: 'DRAFT' }))).toBe(false);
    expect(isVisibleGame(build({ status: 'OPEN' }))).toBe(true);
  });
});

describe('gameBannerMessage', () => {
  it('모집 중이면 인원을 같이 보여준다', () => {
    const game = build({
      status: 'OPEN',
      participants: Array.from({ length: 47 }, (_, index) => ({
        id: index + 1,
        nickname: `참가자${index + 1}`,
        joinedAt: '2026-08-05T04:00:00.000Z',
      })),
    }) as VisibleGame;

    expect(gameBannerMessage(game)).toBe('지금 게임이 열렸어요 · 47명 참가 중');
  });

  it('끝났으면 1등을 보여준다', () => {
    const game = build({
      status: 'FINISHED',
      participants: [{ id: 5, nickname: '커피', joinedAt: '2026-08-05T04:00:00.000Z' }],
      ranking: [5],
    }) as VisibleGame;

    expect(gameBannerMessage(game)).toBe('결과가 나왔어요 · 1등 커피');
  });

  /*
   * 계약상 FINISHED면 ranking이 채워집니다. 다만 명단에 없는 id가 오거나 ranking이 비어
   * 있을 수 있어서, 그때 배너가 통째로 터지면 안 됩니다.
   */
  it('1등을 못 찾아도 터지지 않는다', () => {
    expect(gameBannerMessage(build({ status: 'FINISHED', ranking: [] }) as VisibleGame)).toBe(
      '결과가 나왔어요',
    );
    expect(gameBannerMessage(build({ status: 'FINISHED', ranking: [99] }) as VisibleGame)).toBe(
      '결과가 나왔어요',
    );
  });
});
