import Link from 'next/link';
import { buttonStyle } from '@/components/ui/Button';

import { toRankedEnties } from '@/components/game/ranking';
import type { GameView } from '@/lib/schemas/api';

/**
 * 레이스가 끝난 뒤입니다.
 *
 * 내 순위를 먼저 보여주고 상위권을 그 아래 둡니다. 참가자가 제일 궁금한 건 자기
 * 등수라, 목록에서 자기를 찾게 하면 안 됩니다.
 *
 * 서버는 순위에 `participantId`만 담고 닉네임은 안 줍니다(2026-08-28 실서버 확인).
 * 이름은 `participants`에서 찾아 붙입니다.
 */

/** 화면에 담을 상위권 수입니다. 폰 화면이라 더 넣으면 스크롤이 생깁니다. */
const TOP_LIMIT = 3;

const RANK_LABEL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

interface GameResultProps {
  game: GameView;
  /** 참가자 목록에서 찾은 내 id입니다. 못 찾았으면 `null`입니다. */
  myParticipantId: number | null;
  /** `GameView`에 `eventId`가 없어서(계약대로) 링크 주소를 밖에서 받습니다. */
  eventCode: string;
}

const GameResult = ({ game, myParticipantId, eventCode }: GameResultProps) => {
  const ranked = toRankedEnties(game);

  const mine = ranked.find((entry) => entry.participant.id === myParticipantId);
  const top = ranked.slice(0, TOP_LIMIT);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold leading-6 text-text-primary">결과가 나왔어요</h2>

      {mine ? (
        <div className="flex flex-col gap-1 rounded-xl bg-primary-subtle p-4">
          <p className="text-xs font-normal leading-4 text-primary-darker">
            {mine.participant.nickname}
          </p>
          <p className="text-2xl font-semibold leading-8 text-primary-darker">{mine.rank}등</p>
          <p className="text-xs font-normal leading-4 text-primary-darker">
            {game.participants.length}명 중
          </p>
        </div>
      ) : null}

      {top.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {top.map((entry) => (
            <li
              key={entry.participant.id}
              className="flex items-center gap-3 rounded-xl border border-border-subtle p-3"
            >
              <span className="text-sm font-normal leading-5 text-text-secondary">
                {RANK_LABEL[entry.rank] ?? `${entry.rank}등`}
              </span>
              <span className="text-sm font-normal leading-5 text-text-primary">
                {entry.participant.nickname}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-normal leading-5 text-text-secondary">
          결과를 불러오지 못했어요
        </p>
      )}
      {/*
        레이스가 끝나면 참가자는 할 일이 없어집니다. 게임을 붙인 이유가 소감 참여율이라(#243)
        여기서 다음 걸음을 안 알려주면 등수만 보고 화면을 닫습니다. 위 화살표와 따로 두는
        이유는 저건 이동 수단이고 이건 권하는 행동이기 때문입니다.
      */}
      <Link href={`/e/${eventCode}`} className={buttonStyle('primary')}>
        소감 남기러 가기
      </Link>
    </section>
  );
};

export { GameResult };
