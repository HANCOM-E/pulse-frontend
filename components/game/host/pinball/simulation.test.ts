import { describe, expect, it } from 'vitest';

import { BALL_RADIUS, BOARD, FINISH_Y } from '@/components/game/host/pinball/board';
import {
  MAX_FRAMES,
  createRace,
  createRandom,
  step,
  type RaceFrame,
} from '@/components/game/host/pinball/simulation';
import type { GameParticipant } from '@/lib/schemas/api';

/**
 * 물리는 눈으로 봐서는 맞는지 알 수 없습니다. 구슬 하나가 사라지거나 못을 뚫고 지나가도
 * 47개가 굴러가는 화면에서는 티가 안 나고, 행사에서 드러나면 이미 늦습니다.
 */

const build = (count: number): GameParticipant[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    nickname: `참가자${index + 1}`,
    joinedAt: '2026-08-05T04:00:00.000Z',
  }));

/** 끝날 때까지 돌립니다. 실제 화면은 프레임마다 그리지만 테스트는 결과만 봅니다. */
const runToEnd = (participants: GameParticipant[], seed: number) => {
  const random = createRandom(seed);

  let frame: RaceFrame = createRace(participants, seed);
  let frames = 0;

  while (!frame.isComplete && frames < MAX_FRAMES) {
    frame = step(frame, random, BALL_RADIUS);
    frames += 1;
  }

  return { frame, frames };
};

describe('createRace', () => {
  it('구슬이 보드 안에서 출발한다', () => {
    const { balls } = createRace(build(20), 1);

    for (const ball of balls) {
      expect(ball.x).toBeGreaterThanOrEqual(0);
      expect(ball.x).toBeLessThanOrEqual(BOARD.width);
      expect(ball.y).toBeLessThan(FINISH_Y);
      expect(ball.rank).toBeNull();
    }
  });

  it('참가자가 없으면 곧바로 끝난 상태다', () => {
    const frame = createRace([], 1);

    expect(frame.balls).toHaveLength(0);
    expect(frame.isComplete).toBe(true);
  });
});

describe('step', () => {
  /*
   * 이게 이 파일의 요점입니다. `Math.random()`을 썼다면 여기서 걸립니다.
   *
   * 결정적이지 않으면 화면이 리렌더될 때마다 레이스가 흔들리고, 무엇보다 아래 검사들이
   * 전부 "이번엔 우연히 통과"가 됩니다.
   */
  it('같은 시드면 같은 순서가 나온다', () => {
    const participants = build(12);

    const first = runToEnd(participants, 42).frame.finished;
    const second = runToEnd(participants, 42).frame.finished;

    expect(first).toEqual(second);
  });

  it('시드가 다르면 대체로 다른 순서가 나온다', () => {
    const participants = build(12);

    const a = runToEnd(participants, 1).frame.finished;
    const b = runToEnd(participants, 2).frame.finished;

    expect(a).not.toEqual(b);
  });

  /*
   * 구슬이 하나라도 사라지면 `POST /results`의 `ranking`에서 빠집니다. 서버는 부분 순위를
   * 허용하므로(#246) 에러 없이 통과하고, 그 참가자만 결과에서 조용히 없어집니다.
   */
  it('아무도 사라지거나 중복되지 않는다', () => {
    const participants = build(30);
    const { frame } = runToEnd(participants, 7);

    expect(frame.isComplete).toBe(true);
    expect([...frame.finished].sort((a, b) => a - b)).toEqual(participants.map((p) => p.id));
  });

  it('구슬이 보드 밖으로 나가지 않는다', () => {
    const participants = build(30);
    const radius = BALL_RADIUS;
    const random = createRandom(3);

    let frame = createRace(participants, 3);
    for (let count = 0; count < MAX_FRAMES && !frame.isComplete; count += 1) {
      frame = step(frame, random, radius);

      for (const ball of frame.balls) {
        expect(ball.x).toBeGreaterThanOrEqual(radius - 0.001);
        expect(ball.x).toBeLessThanOrEqual(BOARD.width - radius + 0.001);
        expect(ball.y).toBeLessThanOrEqual(FINISH_Y);
      }
    }
  });

  /*
   * 47명이 이 게임의 상한입니다(#243의 규모 구간). 그보다 많으면 룰렛으로 가는 게
   * 3단계인데, 그전까지는 47명이 실제로 완주해야 합니다.
   */
  it('47명도 전원 완주한다', () => {
    const { frame, frames } = runToEnd(build(47), 11);

    expect(frame.isComplete).toBe(true);
    expect(frame.finished).toHaveLength(47);
    expect(frames).toBeLessThan(MAX_FRAMES);
  });

  /*
   * 30초~1분을 노렸습니다(#243). 60fps 기준 1800~3600 프레임입니다.
   *
   * 범위를 넓게 잡은 이유는 이 값이 못 줄 수·중력·구슬 크기에 다 걸려 있어서입니다.
   * 너무 좁히면 상수를 조금만 만져도 깨지는 테스트가 됩니다. 여기서 보려는 건
   * "몇 초 만에 끝나거나 몇 분씩 걸리지 않는다"입니다.
   */
  it('레이스가 너무 짧거나 길지 않다', () => {
    const { frames } = runToEnd(build(20), 5);

    expect(frames).toBeGreaterThan(600); // 10초
    expect(frames).toBeLessThan(4_200); // 70초
  });

  /*
   * 반지름을 인원에 따라 바꿨더니 12명 레이스가 47명보다 5배 오래 걸렸습니다. 큰 구슬이
   * 못 사이를 잘 못 빠져나가서입니다. 물리가 인원에 따라 달라지면 레이스 길이를 예측할
   * 수 없어서 반지름을 고정했고, 이 검사가 그 결정을 지킵니다.
   */
  it('인원이 달라도 레이스 길이가 비슷하다', () => {
    const short = runToEnd(build(12), 3).frames;
    const long = runToEnd(build(47), 11).frames;

    expect(Math.max(short, long) / Math.min(short, long)).toBeLessThan(2);
  });

  it('원본 프레임을 건드리지 않는다', () => {
    const participants = build(10);
    const random = createRandom(9);
    const frame = createRace(participants, 9);
    const before = frame.balls.map((ball) => ball.y);

    step(frame, random, BALL_RADIUS);

    expect(frame.balls.map((ball) => ball.y)).toEqual(before);
  });
});
