import { describe, expect, it } from 'vitest';

import { gameBannerMessage, isVisibleGame, type VisibleGame } from './gameBannerMessage';
import type { GameView } from '@/lib/schemas/api';

const build = (overrides: Partial<GameView>): GameView => ({
  id: 1,
  title: '시작 전 몸 풀기',
  gameType: 'PINBALL',
  status: 'OPEN',
  participantCount: 0,
  participants: [],
  results: null,
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
    const game = build({ status: 'OPEN', participantCount: 47 }) as VisibleGame;

    expect(gameBannerMessage(game)).toBe('지금 게임이 열렸어요 · 47명 참가 중');
  });

  it('진행 중이면 참가가 마감됐다고 알린다', () => {
    const game = build({ status: 'RUNNING' }) as VisibleGame;

    expect(gameBannerMessage(game)).toBe('레이스 진행 중이에요 · 참가는 마감됐어요');
  });

  it('끝났으면 1등을 보여준다', () => {
    const game = build({
      status: 'FINISHED',
      results: [{ rank: 1, participantId: 5, nickname: '커피' }],
    }) as VisibleGame;

    expect(gameBannerMessage(game)).toBe('결과가 나왔어요 · 1등 커피');
  });

  /*
   * 계약상 FINISHED면 results가 채워집니다. 다만 그 검사는 목에만 있어서 실제 서버가
   * 빠뜨릴 수 있고, 그때 배너가 통째로 터지면 안 됩니다.
   */
  it('끝났는데 결과가 비어있지도 터지지 않는다', () => {
    expect(gameBannerMessage(build({ status: 'FINISHED', results: null }) as VisibleGame)).toBe(
      '결과가 나왔어요',
    );
    expect(gameBannerMessage(build({ status: 'FINISHED', results: [] }) as VisibleGame)).toBe(
      '결과가 나왔어요',
    );
  });
});
