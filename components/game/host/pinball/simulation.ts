import {
  BALL_RADIUS,
  BOARD,
  FINISH_Y,
  PEGS,
  PEG_RADIUS,
  START_Y,
} from '@/components/game/host/pinball/board';
import type { GameParticipant } from '@/lib/schemas/api';

/**
 * 핀볼 레이스의 물리입니다. 캔버스도 React도 모르는 순수 계산이라 값을 직접 검사할 수
 * 있습니다(`components/game/host/raceOrder.ts`와 같은 방식).
 *
 * `matter.js`를 안 쓴 이유는 필요한 게 원-원 충돌·중력·벽 반사 셋뿐이라서입니다. 90KB를
 * 더 받는 것보다, 무엇보다 **결정성을 우리가 통제할 수 있는 게** 큽니다 — 라이브러리를
 * 끼면 같은 시드에 같은 결과가 나오는지 보장할 방법이 없습니다.
 */

/** 한 프레임에 더해지는 속도입니다. 못 줄 수와 함께 레이스 길이를 정합니다. */
const GRAVITY = 0.06;

/** 자유낙하 속도 상한입니다. 없으면 아래로 갈수록 못을 뚫고 지나갑니다. */
const MAX_FALL_SPEED = 5;

/** 못에 부딪힌 뒤 남는 속도 비율입니다. 1이면 영원히 튕기고 0이면 붙어버립니다. */
const BOUNCE = 0.6;

/** 벽에 부딪힌 뒤 남는 속도 비율입니다. 못보다 더 많이 죽여야 구석에 갇히지 않습니다. */
const WALL_BOUNCE = 0.45;

/**
 * 못에 부딪힐 때 좌우로 흔드는 세기입니다.
 *
 * 이게 0이면 같은 자리에서 출발한 구슬이 같은 길로만 갑니다. 물리적으로는 맞지만 실제
 * 핀볼은 미세한 회전과 마찰로 갈리므로, 그 몫을 난수로 흉내 냅니다.
 */
const JITTER = 0.6;

/**
 * 무한 루프 방지선입니다. 구슬이 어딘가 끼면 프레임이 끝없이 돌아갑니다.
 *
 * 60fps 기준 90초입니다. 목표(30초~1분)보다 넉넉하게 뒀고, 여기 닿으면 남은 구슬을
 * 지금 위치 순서대로 완주 처리합니다.
 */
const MAX_FRAMES = 5_400;

/**
 * 시드에서 난수를 만듭니다(mulberry32).
 *
 * `Math.random()`을 쓰면 같은 레이스를 두 번 돌릴 수 없어서 테스트가 불가능합니다.
 * 화면이 리렌더될 때 레이스가 흔들리는 문제도 여기서 같이 막힙니다.
 */
const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

interface Ball {
  participantId: number;
  nickname: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 결승선을 통과한 순서입니다. 아직이면 `null`입니다. */
  rank: number | null;
}

interface RaceFrame {
  balls: Ball[];
  /** 완주한 `participantId`를 1등부터 담습니다. */
  finished: number[];
  isComplete: boolean;
}

/**
 * 출발 상태를 만듭니다. 구슬을 보드 위쪽에 가로로 흩뿌립니다.
 *
 * 시작 위치와 속도에 난수를 섞는 이유는, 같은 자리에서 같은 속도로 떨어지면 못에 맞는
 * 각도까지 같아져서 여러 구슬이 겹쳐 다니기 때문입니다.
 */
const createRace = (participants: readonly GameParticipant[], seed: number): RaceFrame => {
  const random = createRandom(seed);
  const lane = (BOARD.width - BALL_RADIUS * 2) / Math.max(participants.length, 1);

  return {
    balls: participants.map((participant, index) => ({
      participantId: participant.id,
      nickname: participant.nickname,
      x: BALL_RADIUS + lane * (index + 0.5) + (random() - 0.5) * lane * 0.6,
      y: START_Y + random() * 40,
      vx: (random() - 0.5) * 2,
      vy: 0,
      rank: null,
    })),
    finished: [],
    isComplete: participants.length === 0,
  };
};

/**
 * 한 프레임을 진행합니다. 상태를 새로 만들어 돌려주고 인자를 건드리지 않습니다.
 *
 * `random`을 인자로 받는 이유는 프레임마다 같은 난수열을 이어 써야 하기 때문입니다.
 * 안에서 새로 만들면 매 프레임 같은 값이 나와 구슬이 전부 같은 방향으로 흔들립니다.
 */
const step = (frame: RaceFrame, random: () => number, radius: number): RaceFrame => {
  const finished = [...frame.finished];

  const balls = frame.balls.map((ball) => {
    if (ball.rank !== null) return ball;

    let { x, y, vx, vy } = ball;

    vy = Math.min(vy + GRAVITY, MAX_FALL_SPEED);
    x += vx;
    y += vy;

    // 벽. 반지름만큼 안쪽에서 튕겨야 구슬이 테두리를 파고들지 않습니다.
    if (x < radius) {
      x = radius;
      vx = Math.abs(vx) * WALL_BOUNCE;
    } else if (x > BOARD.width - radius) {
      x = BOARD.width - radius;
      vx = -Math.abs(vx) * WALL_BOUNCE;
    }

    /*
     * 못 충돌입니다. 겹친 만큼 밀어낸 뒤 법선 방향 속도를 뒤집습니다.
     *
     * 모든 못을 훑습니다. 108개 × 47구슬 = 5천 번인데 프레임당이라 60fps에서도 여유가
     * 있습니다. 격자로 나누는 최적화는 실제로 느려지면 그때 합니다.
     */
    for (const peg of PEGS) {
      const dx = x - peg.x;
      const dy = y - peg.y;
      const distance = Math.hypot(dx, dy);
      const minimum = radius + PEG_RADIUS;

      if (distance >= minimum || distance === 0) continue;

      const nx = dx / distance;
      const ny = dy / distance;
      x = peg.x + nx * minimum;
      y = peg.y + ny * minimum;

      const dot = vx * nx + vy * ny;
      vx = (vx - 2 * dot * nx) * BOUNCE + (random() - 0.5) * JITTER * 2;
      vy = (vy - 2 * dot * ny) * BOUNCE;
    }

    if (y >= FINISH_Y) {
      finished.push(ball.participantId);
      return { ...ball, x, y: FINISH_Y, vx: 0, vy: 0, rank: finished.length };
    }

    return { ...ball, x, y, vx, vy };
  });

  return { balls, finished, isComplete: finished.length >= balls.length };
};

export { createRace, createRandom, step, MAX_FRAMES };
export type { Ball, RaceFrame };
