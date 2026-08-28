'use client';

import Link from 'next/link';
import { Button, buttonStyle } from '@/components/ui/Button';
import type { GameParticipant, GameView } from '@/lib/schemas/api';

/**
 * 결과 화면입니다. 시상대 모양으로 1·2·3등을 보여줍니다.
 *
 * 멀리서 읽혀야 해서 1등을 크게 씁니다. 4등 아래는 안 보여줍니다 — 프로젝터에서
 * 47명을 훑는 사람은 없고, 자기 등수는 각자 폰에 이미 떠 있습니다.
 */

/** 시상대에 올리는 인원입니다. */
const PODIUM_LIMIT = 3;

const RANK_STYLE: Record<number, { size: string; badge: string }> = {
  1: { size: 'text-8xl', badge: 'bg-warning-subtle text-warning-darker text-xl px-5 py-2' },
  2: { size: 'text-5xl', badge: 'bg-neutral-subtle text-neutral-darker text-base px-4 py-1' },
  3: { size: 'text-5xl', badge: 'bg-neutral-subtle text-neutral-darker text-base px-4 py-1' },
};

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
  /*
   * 순위를 이름과 짝지어 둡니다. 서버는 `participantId`만 담고 닉네임은 안 줍니다
   * (2026-08-28 실서버 확인). 명단에 없는 id는 버립니다 — 이름 없는 자리를 시상대에
   * 올리는 것보다 낫습니다.
   */
  const byId = new Map(game.participants.map((participant) => [participant.id, participant]));

  const podium = game.ranking
    .map((participantId, index) => ({ rank: index + 1, participant: byId.get(participantId) }))
    .filter(
      (entry): entry is { rank: number; participant: GameParticipant } =>
        entry.participant !== undefined,
    )
    .slice(0, PODIUM_LIMIT);

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-col items-center gap-1 pt-[6dvh]">
        {sessionTitle ? (
          <p className="text-base font-normal leading-6 text-text-secondary">{sessionTitle}</p>
        ) : null}
        <h1 className="text-4xl font-semibold leading-tight text-text-primary">결과가 나왔어요</h1>
      </div>

      {/* 본문만 남는 공간에서 가운데 정렬합니다. 제목은 화면마다 같은 높이에 있어야 합니다. */}
      <div className="flex flex-1 flex-col items-center gap-12">
        {podium.length > 0 ? (
          <ol className="flex flex-wrap items-end justify-center gap-16 pt-[6dvh]">
            {podium.map((entry) => {
              const style = RANK_STYLE[entry.rank] ?? RANK_STYLE[3];

              return (
                <li key={entry.participant.id} className="flex flex-col items-center gap-3">
                  <span className={`rounded-full font-normal leading-6 ${style.badge}`}>
                    {entry.rank}등
                  </span>
                  <span className={`${style.size} font-semibold leading-tight text-text-primary`}>
                    {entry.participant.nickname}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-xl font-normal leading-7 text-text-secondary">
            결과를 불러오지 못했어요
          </p>
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/events/${eventCode}/dashboard`} className={buttonStyle('secondary')}>
              대시보드로
            </Link>
            <Button onClick={onCreateNext} disabled={isPending}>
              새 게임 만들기
            </Button>
          </div>
          <p className="text-sm font-normal leading-5 text-text-tertiary">
            {game.participants.length}명이 참가했어요
          </p>
        </div>
      </div>
    </section>
  );
};

export { GameFinished };
