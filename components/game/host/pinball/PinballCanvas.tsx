'use client';

import { useEffect, useRef, useState } from 'react';

import {
  BALL_RADIUS,
  BOARD,
  FINISH_Y,
  NAME_TAG_LIMIT,
  PEGS,
  PEG_RADIUS,
} from '@/components/game/host/pinball/board';
import {
  MAX_FRAMES,
  createRace,
  createRandom,
  step,
  type Ball,
  type RaceFrame,
} from '@/components/game/host/pinball/simulation';
import type { GameParticipant } from '@/lib/schemas/api';

/**
 * 레이스를 캔버스에 그립니다. 물리는 `simulation.ts`가 맡고 여기는 그리기만 합니다.
 *
 * 프레임 상태를 React state로 두지 않습니다. 60fps로 `setState`를 부르면 초당 60번
 * 리렌더가 돌아서 47개 구슬을 그리기 전에 화면이 먼저 멈춥니다. 캔버스에 직접 그리고,
 * 상태는 **완주자가 늘어날 때만** 올립니다.
 */

/** 구슬 색입니다. 이름을 못 읽는 거리에서도 자기 구슬을 색으로 찾습니다. */
const BALL_TOKENS = [
  '--color-primary-lighter',
  '--color-positive-lighter',
  '--color-warning-lighter',
  '--color-negative-lighter',
  '--color-toxic-lighter',
] as const;

/**
 * 캔버스는 CSS 클래스를 못 씁니다. 토큰 값을 읽어와야 하드코딩된 hex가 안 남습니다.
 *
 * `getComputedStyle`이 비싸서 한 번만 읽고 들고 다닙니다. 프레임마다 부르면 60fps에서
 * 레이아웃 계산이 초당 60번 돕니다.
 */
const readPalette = (element: HTMLElement) => {
  const styles = getComputedStyle(element);
  const token = (name: string) => styles.getPropertyValue(name).trim();

  return {
    board: token('--color-background-inverse'),
    peg: token('--color-neutral-default'),
    finish: token('--color-neutral-lighter'),
    label: token('--color-text-inverse'),
    balls: BALL_TOKENS.map(token),
  };
};

type Palette = ReturnType<typeof readPalette>;

const draw = (
  context: CanvasRenderingContext2D,
  frame: RaceFrame,
  palette: Palette,
  showNames: boolean,
) => {
  context.fillStyle = palette.board;
  context.fillRect(0, 0, BOARD.width, BOARD.height);

  context.fillStyle = palette.peg;
  for (const peg of PEGS) {
    context.beginPath();
    context.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = palette.finish;
  context.lineWidth = 4;
  context.setLineDash([18, 12]);
  context.beginPath();
  context.moveTo(0, FINISH_Y);
  context.lineTo(BOARD.width, FINISH_Y);
  context.stroke();
  context.setLineDash([]);

  context.textAlign = 'center';
  /*
   * 폰트 이름을 직접 씁니다. 캔버스 `font`는 CSS 변수를 해석하지 않아서 `var(--font-sans)`를
   * 넣으면 문자열 전체가 무효가 되고 기본값 10px로 떨어집니다. `globals.css`의 `--font-sans`와
   * 같은 값을 손으로 맞춰둔 것이라, 그쪽이 바뀌면 여기도 봐야 합니다.
   */
  context.font = "500 36px 'Pretendard Variable', system-ui, sans-serif";

  frame.balls.forEach((ball: Ball, index) => {
    context.fillStyle = palette.balls[index % palette.balls.length];
    context.beginPath();
    context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    context.fill();

    if (!showNames) return;

    context.fillStyle = palette.label;
    // 구슬 위에 답니다. 안에 넣으면 반지름 16에 12자가 안 들어갑니다.
    context.fillText(ball.nickname, ball.x, ball.y - BALL_RADIUS - 12);
  });
};

interface PinballCanvasProps {
  /** 마운트 시점에 고정된 목록이어야 합니다. 바뀌면 레이스가 처음부터 다시 돕니다. */
  participants: readonly GameParticipant[];
  seed: number;
  /** 완주 순서입니다. 1등부터 담은 `participantId` 배열입니다. */
  onFinish: (ranking: number[]) => void;
}

const PinballCanvas = ({ participants, seed, onFinish }: PinballCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [finished, setFinished] = useState<GameParticipant[]>([]);

  /*
   * 최신 `onFinish`를 ref에 담아둡니다. deps에 넣으면 렌더마다 정체성이 바뀌어 effect가
   * 다시 돌고 레이스가 처음부터 시작합니다. 프로젝터 화면이 3초마다 폴링하니 실제로
   * 그렇게 됩니다.
   */
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const palette = readPalette(canvas);
    const showNames = participants.length <= NAME_TAG_LIMIT;
    const random = createRandom(seed);

    let frame = createRace(participants, seed);
    let frames = 0;
    let reported = 0;
    let animationId = 0;

    const loop = () => {
      const isOver = frame.isComplete || frames >= MAX_FRAMES;

      if (!isOver) {
        frame = step(frame, random, BALL_RADIUS);
        frames += 1;
      }

      draw(context, frame, palette, showNames);

      /*
       * 완주자가 늘어난 프레임에만 상태를 올립니다. 매 프레임 올리면 60fps 리렌더가 되고,
       * 아예 안 올리면 옆 순위표가 안 채워집니다.
       */
      if (frame.finished.length !== reported) {
        reported = frame.finished.length;
        const byId = new Map(participants.map((participant) => [participant.id, participant]));
        setFinished(
          frame.finished
            .map((id) => byId.get(id))
            .filter((participant): participant is GameParticipant => participant !== undefined),
        );
      }

      if (isOver) {
        /*
         * `MAX_FRAMES`에 걸려 끝난 경우 완주 못 한 구슬이 남습니다. 서버는 부분 순위를
         * 허용하므로(#246) 남은 사람은 결과에서 빠집니다. 레이스가 안 끝나 화면이 굳는
         * 것보다는 낫다고 봤습니다.
         */
        onFinishRef.current(frame.finished);
        return;
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [participants, seed]);

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
      <canvas
        ref={canvasRef}
        width={BOARD.width}
        height={BOARD.height}
        className="max-h-[55dvh] w-full max-w-[70vw] rounded-xl"
        aria-label="핀볼 레이스"
      />

      <div className="flex w-full flex-col gap-4 md:w-80">
        <p className="text-base font-normal leading-6 text-text-secondary">도착 순서</p>
        <ol className="flex flex-col gap-3">
          {/*
            5칸을 미리 그려둡니다. 도착할 때마다 칸을 만들면 목록이 아래로 자라면서
            옆 캔버스와 높이가 어긋나고, 프로젝터에서 화면이 들썩입니다.
          */}
          {Array.from({ length: 5 }, (_, index) => {
            const participant = finished[index];

            return (
              <li
                key={index}
                className="flex items-center gap-4 rounded-xl border border-border-subtle px-5 py-4"
              >
                <span className="w-6 text-lg font-normal leading-7 text-text-tertiary">
                  {index + 1}
                </span>
                <span
                  className={
                    participant
                      ? 'text-2xl font-semibold leading-8 text-text-primary'
                      : 'text-2xl font-normal leading-8 text-text-disabled'
                  }
                >
                  {participant?.nickname ?? '—'}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};

export { PinballCanvas };
