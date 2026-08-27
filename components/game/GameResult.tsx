import { GameResultEntry, GameView } from '@/lib/schemas/api';

/**
 * 레이스가 끝난 뒤입니다.
 *
 * 내 순위를 먼저 보여주고 상위권을 그 아래 둡니다. 참가자가 제일 궁금한 건 자기
 * 등수라, 목록에서 자기를 찾게 하면 안 됩니다.
 */

/** 화면에 담을 상위권 수입니다. 폰 화면이라 더 넣으면 스크롤이 생깁니다. */
const TOP_LIMIT = 3;

const RANK_LABEL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

interface GameResultProps {
  game: GameView;
  /** 참가자 목록에서 찾은 내 id입니다. 못 찾았으면 `null`입니다. */
  myParticipantId: number | null;
}

const GameResult = ({ game, myParticipantId }: GameResultProps) => {
  /*
   * 계약상 `FINISHED`면 `results`가 채워지지만 그 검사는 목에만 있습니다. 실제 서버가
   * 빠뜨려도 화면이 통째로 비지 않게 빈 배열로 떨어뜨립니다.
   */
  const results: GameResultEntry[] = game.results ?? [];
  const mine = results.find((entry) => entry.participantId === myParticipantId);
  const top = results.slice(0, TOP_LIMIT);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold leading-6 text-text-primary">결과가 나왔어요</h2>

      {mine ? (
        <div className="flex flex-col gap-1 rounded-xl bg-primary-subtle p-4">
          <p className="text-xs font-normal leading-4 text-primary-darker">{mine.nickname}</p>
          <p className="text-2xl font-semibold leading-8 text-primary-darker">{mine.rank}등</p>
          <p className="text-xs font-normal leading-4 text-primary-darker">
            {game.participantCount}
          </p>
        </div>
      ) : null}

      {top.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {top.map((entry) => (
            <li
              key={entry.participantId}
              className="flex items-center gap-3 rounded-xl border border-border-subtle p-3"
            >
              <span className="text-sm font-normal leading-5 text-text-secondary">
                {RANK_LABEL[entry.rank] ?? `${entry.rank}등`}
              </span>
              <span className="text-sm font-normal leading-5 text-text-primary">
                {entry.nickname}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-normal leading-5 text-text-secondary">
          결과를 불러오지 못했어요
        </p>
      )}
    </section>
  );
};

export { GameResult };
