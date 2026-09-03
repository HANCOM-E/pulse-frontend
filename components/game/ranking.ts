import { GameParticipant, GameView } from '@/lib/schemas/api';

/**
 * 순위를 이름과 짝짓습니다.
 *
 * 서버는 순위에 `participantId`만 담고 닉네임은 안 줍니다(2026-08-28 실서버 확인).
 * 이름은 `participants`에서 찾아 붙여야 합니다.
 *
 * 명단에 없는 id는 버립니다 — 주최자가 게임을 다시 만들었거나 서버가 이상한 값을 준
 * 경우인데, 이름 없는 줄을 그리는 것보다 낫습니다.
 *
 * 참가자 결과 화면(`GameResult`)과 프로젝터 시상대(`GameFinished`)가 같은 판단을 씁니다.
 * 두 벌로 두면 한쪽만 고치는 실수가 열립니다(#299와 같은 이유).
 */

interface RankedEntry {
  /** 1등이 1입니다. */
  rank: number;
  participant: GameParticipant;
}

const toRankedEnties = (game: GameView): RankedEntry[] => {
  const byId = new Map(game.participants.map((participant) => [participant.id, participant]));

  return game.ranking
    .map((participantId, index) => ({ rank: index + 1, participant: byId.get(participantId) }))
    .filter((entry): entry is RankedEntry => entry.participant !== undefined);
};

export { toRankedEnties, type RankedEntry };
