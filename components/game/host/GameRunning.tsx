'use client';

import { useState } from 'react';

import { PinballCanvas } from './pinball/PinballCanvas';
import type { GameView } from '@/lib/schemas/api';

/**
 * 레이스 중 화면입니다. 핀볼을 그리고, 전원이 결승선을 지나면 순위를 올립니다.
 *
 * 순차 공개 연출(1단계)을 여기서 걷어냈습니다. 계약은 안 바뀝니다 — `onFinish`가 받는
 * 값의 모양이 같아서, 연출을 갈아 끼워도 위쪽은 그대로입니다(#243).
 */

interface GameRunningProps {
  /** 지금 열린 세션 제목입니다. 게임 제목은 주최자용 메모라 참가자에게 안 보여줍니다. */
  sessionTitle: string;
  game: GameView;
  onFinish: (ranking: number[]) => void;
}

const GameRunning = ({ sessionTitle, game, onFinish }: GameRunningProps) => {
  /*
   * 참가자 목록과 시드를 마운트 시점에 고정합니다.
   *
   * 프로젝터 화면이 3초마다 폴링해서 `game.participants`가 새 배열로 옵니다. 그대로
   * 넘기면 `PinballCanvas`의 effect가 다시 돌아 레이스가 처음부터 시작합니다.
   *
   * 시드도 같은 이유로 여기서 한 번만 뽑습니다. 렌더마다 뽑으면 매번 다른 레이스가 됩니다.
   */
  const [race] = useState(() => ({
    participants: game.participants,
    seed: Math.floor(Math.random() * 0xffffffff),
  }));

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-col items-center gap-1 pt-[6dvh]">
        {sessionTitle ? (
          <p className="text-base font-normal leading-6 text-text-secondary">{sessionTitle}</p>
        ) : null}
        <h1 className="text-4xl font-semibold leading-tight text-text-primary">레이스 중이에요</h1>
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <PinballCanvas participants={race.participants} seed={race.seed} onFinish={onFinish} />
      </div>
    </section>
  );
};

export { GameRunning };
