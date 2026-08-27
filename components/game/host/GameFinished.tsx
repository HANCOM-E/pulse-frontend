'use client';

import Link from 'next/link';
import { Button, buttonStyle } from '@/components/ui/Button';
import type { GameResultEntry, GameView } from '@/lib/schemas/api';

/**
 * 결과 화면입니다. 시상대 모양으로 1·2·3등을 보여줍니다.
 *
 * 멀리서 읽혀야 해서 1등을 크게 씁니다. 4등 아래는 안 보여줍니다 — 프로젝터에서
 * 47명을 훑는 사람은 없고, 자기 등수는 각자 폰에 이미 떠 있습니다.
 */

/** 시상대에 올리는 인원입니다. */
const PODIUM_LIMIT = 3;

const RANK_STYLE: Record<number, { size: string; badge: string }> = {
  1: { size: 'text-5xl', badge: 'bg-warning-subtle text-warning-darker' },
  2: { size: 'text-3xl', badge: 'bg-neutral-subtle text-neutral-darker' },
  3: { size: 'text-3xl', badge: 'bg-neutral-subtle text-neutral-darker' },
};

interface GameFinishedProps {
  game: GameView;
  eventCode: string;
  isPending: boolean;
  onCreateNext: () => void;
}

const GameFinished = ({ game, eventCode, isPending, onCreateNext }: GameFinishedProps) => {
  /*
   * 계약상 `FINISHED`면 `results`가 채워지지만 그 검사는 목에만 있습니다. 실제 서버가
   * 빠뜨려도 화면이 통째로 비지 않게 빈 배열로 떨어뜨립니다.
   */
  const results: GameResultEntry[] = game.results ?? [];
  const podium = results.slice(0, PODIUM_LIMIT);

  return (
    <section className="flex flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-1">
        <p className="text-base font-normal leading-6 text-text-secondary">{game.title}</p>
        <h1 className="text-4xl font-semibold leading-tight text-text-primary">결과가 나왔어요</h1>
      </div>

      {podium.length > 0 ? (
        <ol className="flex flex-wrap items-end justify-center gap-10">
          {podium.map((entry) => {
            const style = RANK_STYLE[entry.rank] ?? RANK_STYLE[3];

            return (
              <li key={entry.participantId} className="flex flex-col items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-base font-normal leading-6 ${style.badge}`}
                >
                  {entry.rank}등
                </span>
                <span className={`${style.size} font-semibold leading-tight text-text-primary`}>
                  {entry.nickname}
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
          {game.participantCount}명이 참가했어요
        </p>
      </div>
    </section>
  );
};

export { GameFinished };
