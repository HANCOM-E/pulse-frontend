'use client';

import Link from 'next/link';
import { Button, buttonStyle } from '@/components/ui/Button';
import { toRankedEnties } from '@/components/game/ranking';
import type { GameView } from '@/lib/schemas/api';

/**
 * 결과 화면입니다. 시상대 모양으로 1·2·3등을 보여줍니다.
 *
 * 멀리서 읽혀야 해서 1등을 크게 씁니다. 4등 아래는 안 보여줍니다 — 프로젝터에서
 * 47명을 훑는 사람은 없고, 자기 등수는 각자 폰에 이미 떠 있습니다.
 */

/** 시상대에 올리는 인원입니다. */
const PODIUM_LIMIT = 3;

const RANK_STYLE: Record<number, string> = {
  1: 'bg-warning-subtle text-warning-darker',
  2: 'bg-neutral-subtle text-neutral-darker',
  3: 'bg-neutral-subtle text-neutral-darker',
};

/** 시상대에 세우는 순서입니다. 1등이 가운데 서야 화면이 안 쏠립니다. */
const PODIUM_ORDER = [2, 1, 3] as const;

interface GameFinishedProps {
  /** 지금 열린 세션 제목입니다. 게임 제목은 주최자용 메모라 참가자에게 안 보여줍니다. */
  sessionTitle: string;
  game: GameView;
  eventCode: string;
  isPending: boolean;
  onCreateNext: () => void;
}

const GameFinished = ({
  sessionTitle,
  game,
  eventCode,
  isPending,
  onCreateNext,
}: GameFinishedProps) => {
  const podium = toRankedEnties(game).slice(0, PODIUM_LIMIT);

  /*
   * 셋이 다 있을 때만 자리를 바꿉니다. 참가자가 적어 2등·3등이 비면 그대로 두어야
   * 빈자리가 안 생깁니다.
   */
  const arranged =
    podium.length === PODIUM_LIMIT ? PODIUM_ORDER.map((rank) => podium[rank - 1]) : podium;

  return (
    <section className="flex flex-1 flex-col">
      {/* 제목과 시상대는 한 덩어리입니다. 가운데 정렬로 떼어놓으면 사이가 벌어집니다. */}
      <div className="flex flex-col items-center gap-10 pt-[6dvh]">
        <div className="flex flex-col items-center gap-1">
          {sessionTitle ? (
            <p className="text-base font-normal leading-6 text-text-secondary">{sessionTitle}</p>
          ) : null}
          <h1 className="text-4xl font-semibold leading-tight text-text-primary">
            결과가 나왔어요
          </h1>
          <p className="text-base font-normal leading-6 text-text-tertiary">
            {game.participants.length}명이 참가했어요
          </p>
        </div>

        {arranged.length > 0 ? (
          <ol className="flex flex-wrap items-end justify-center gap-16">
            {arranged.map((entry) => (
              <li key={entry.participant.id} className="flex flex-col items-center gap-3">
                <span
                  className={`rounded-full px-4 py-1 text-base font-normal leading-6 ${RANK_STYLE[entry.rank] ?? RANK_STYLE[3]}`}
                >
                  {entry.rank}등
                </span>
                <span
                  className={`${entry.rank === 1 ? 'text-8xl' : 'text-5xl'} font-semibold leading-tight text-text-primary`}
                >
                  {entry.participant.nickname}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xl font-normal leading-7 text-text-secondary">
            결과를 불러오지 못했어요
          </p>
        )}
      </div>

      {/*
        주최자용 조작입니다. 관객이 보는 화면이라 결과와 같은 무게로 가운데 두지 않고
        아래로 내립니다.
      */}
      <div className="mt-auto flex items-center justify-center gap-3 pb-[6dvh]">
        <Link href={`/events/${eventCode}/dashboard`} className={buttonStyle('secondary')}>
          대시보드로
        </Link>
        <Button onClick={onCreateNext} disabled={isPending}>
          새 게임 만들기
        </Button>
      </div>
    </section>
  );
};

export { GameFinished };
