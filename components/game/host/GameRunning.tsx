'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameView } from '@/lib/schemas/api';
import { buildRevealOrder, toRanking } from '@/components/game/host/raceOrder';

/**
 * 레이스 중 화면입니다. 1단계는 핀볼을 그리지 않고 이름을 꼴등부터 하나씩 드러냅니다(#243).
 *
 * 물리 엔진은 2단계입니다. 계약을 먼저 돌려보려고 연출을 미뤘습니다 — 상태 전이와 결과
 * 확정이 실제로 도는 걸 확인한 뒤에 얹는 게 순서고, 연출을 갈아 끼워도 계약은 안 바뀝니다.
 *
 * 순위는 여기서 정합니다. 물리 시뮬레이션이 없으니 무작위로 섞습니다. 서버가 순위를
 * 검증하지 않기로 해서(#246) 계약을 어기지는 않습니다.
 */

/** 한 명씩 드러나는 간격입니다. 너무 빠르면 긴장감이 없고 느리면 지루합니다. */
const REVEAL_INTERVAL_MS = 800;

interface GameRunningProps {
  game: GameView;
  /** 전원이 드러나면 부릅니다. 1등부터 담은 `participantId` 배열입니다. */
  onFinish: (ranking: number[]) => void;
}

const GameRunning = ({ game, onFinish }: GameRunningProps) => {
  /*
   * 순서를 한 번만 뽑습니다. 렌더마다 다시 섞으면 폴링이 돌 때마다 순위가 바뀝니다.
   * 초기화 함수를 넘겨서 첫 렌더에서만 실행되게 했습니다.
   */
  const [order] = useState(() => buildRevealOrder(game.participants));
  const [revealed, setRevealed] = useState(0);

  /*
   * 결과를 한 번만 올립니다. `onFinish`는 렌더마다 새 함수라 deps에 넣으면 effect가 계속
   * 다시 돕니다 — 올림 → 목록 무효화 → 리렌더 → 새 함수 → 다시 올림으로 무한히 갑니다.
   *
   * state가 아니라 ref인 이유는 이 값이 화면에 안 나오기 때문입니다. state로 두면 바꿀
   * 때마다 렌더가 한 번 더 돌고, effect 안에서 setState를 부르는 게 되어 React 19가 막습니다.
   */
  const hasSubmitted = useRef(false);

  const isComplete = revealed >= order.length;

  useEffect(() => {
    if (isComplete) return;

    const timer = setTimeout(() => setRevealed((count) => count + 1), REVEAL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [revealed, isComplete]);

  /*
   * 전원이 드러나면 결과를 올립니다. 별도 effect로 뺀 이유는 위가 타이머만 맡게 하려는
   * 것이고, `onFinish`가 여러 번 불리지 않도록 `isComplete`가 한 번만 참이 되게 했습니다.
   */
  useEffect(() => {
    if (!isComplete || order.length === 0 || hasSubmitted.current) return;

    hasSubmitted.current = true;
    onFinish(toRanking(order));
  }, [isComplete, order, onFinish]);

  return (
    <section className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-1">
        <p className="text-base font-normal leading-6 text-text-secondary">{game.title}</p>
        <h1 className="text-4xl font-semibold leading-tight text-text-primary">
          {isComplete ? '결과를 정리하는 중이에요' : '레이스 중이에요'}
        </h1>
      </div>

      <p className="text-xl font-normal leading-7 text-text-secondary">
        {order.length - revealed}
        <span className="text-base"> 명 남았어요</span>
      </p>

      <ul className="flex flex-wrap justify-center gap-2">
        {order.slice(0, revealed).map((participant, index) => (
          <li
            key={participant.id}
            className="rounded-full bg-neutral-subtle px-3 py-1 text-base font-normal leading-6 text-neutral-darker"
          >
            {order.length - index}등 {participant.nickname}
          </li>
        ))}
      </ul>
    </section>
  );
};

export { GameRunning };
