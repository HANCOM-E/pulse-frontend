import type { GameParticipant, GameView } from '@/lib/schemas/api';

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
}

const GameResult = ({ game, myParticipantId }: GameResultProps) => {
  const byId = new Map(game.participants.map((participant) => [participant.id, participant]));

  /*
   * 순위를 이름과 짝지어 둡니다. 명단에 없는 id는 버립니다 — 주최자가 게임을 다시
   * 만들었거나 서버가 이상한 값을 준 경우인데, 이름 없는 줄을 그리는 것보다 낫습니다.
   */
  const ranked = game.ranking
    .map((participantId, index) => ({ rank: index + 1, participant: byId.get(participantId) }))
    .filter(
      (entry): entry is { rank: number; participant: GameParticipant } =>
        entry.participant !== undefined,
    );

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
    </section>
  );
};

export { GameResult };
