'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { GameJoinForm } from '@/components/game/GameJoinForm';
import { GameResult } from '@/components/game/GameResult';
import { GameWaiting } from '@/components/game/GameWaiting';
import { buttonStyle } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCurrentGame } from '@/hooks/useCurrentGame';
import { joinGame } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import {
  readNickname,
  readParticipantId,
  rememberNickname,
  rememberParticipant,
  subscribe,
} from '@/lib/storage/gameParticipant';
import type { GameView } from '@/lib/schemas/api';

/**
 * 참가자 게임 화면의 클라이언트 경계입니다.
 *
 * `app/e/[code]/game/page.tsx`가 서버에서 첫 게임을 받아 넘기고, 그다음부터는
 * `useCurrentGame`의 폴링이 갱신을 맡습니다. 분기를 서버에 두면 주최자가 게임을 열거나
 * 시작해도 참가자 화면이 새로고침 전까지 모릅니다(`EventEntryView`와 같은 이유).
 */

/**
 * 참가 실패를 참가자가 읽을 수 있는 말로 바꿉니다.
 *
 * `GAME_NOT_OPEN`만 따로 잡는 이유는 이게 실패가 아니라 타이밍이기 때문입니다 — 닉네임을
 * 쓰는 사이에 주최자가 레이스를 시작하면 여기 걸립니다. "다시 시도"를 권하면 안 됩니다.
 */
const joinErrorMessage = (error: Error | null): string | undefined => {
  if (error === null) return undefined;
  if (error instanceof ApiError && error.code === 'GAME_NOT_OPEN') {
    return '방금 참가가 마감됐어요';
  }
  return '참가하지 못했어요. 잠시 후 다시 시도해주세요';
};

interface ParticipantGameViewProps {
  eventCode: string;
  initialGame: GameView | null;
}

const ParticipantGameView = ({ eventCode, initialGame }: ParticipantGameViewProps) => {
  const { game } = useCurrentGame({ eventCode, initialGame });
  const queryClient = useQueryClient();

  const gameId = game?.id ?? null;

  /*
   * 서버에는 localStorage가 없습니다. 세 번째 인자가 SSR에서 쓰이는 값이라, 첫 HTML은
   * "기록 없음"으로 그려지고 클라이언트가 붙으면서 실제 값으로 바뀝니다.
   *
   * effect에서 setState로 옮겨 담지 않는 이유는 React 19가 그걸 막기 때문입니다
   * (react-hooks/set-state-in-effect). 이 훅이 바깥 저장소를 읽는 정식 통로입니다.
   */
  const defaultNickname = useSyncExternalStore(subscribe, readNickname, () => '');

  const participantId = useSyncExternalStore(
    subscribe,
    () => (gameId === null ? null : readParticipantId(gameId)),
    () => null,
  );

  const joinMutation = useMutation({
    mutationFn: (variables: { gameId: number; nickname: string }) =>
      joinGame(eventCode, variables.gameId, { nickname: variables.nickname }),
    onSuccess: (participant, variables) => {
      rememberParticipant(variables.gameId, participant.id);
      rememberNickname(participant.nickname);
      // 참가 인원이 바로 반영되게 합니다. 안 하면 다음 폴링까지 내가 빠진 숫자를 봅니다.
      void queryClient.invalidateQueries({ queryKey: ['currentGame', eventCode] });
    },
  });

  const handleJoin = (nickname: string) => {
    if (gameId === null) return;
    joinMutation.mutate({ gameId, nickname });
  };

  if (game === null) {
    return (
      <EmptyState title="열린 게임이 없어요" description="주최자가 열면 여기에서 참가할 수 있어요">
        <Link href={`/e/${eventCode}`} className={buttonStyle('secondary')}>
          소감 남기러 가기
        </Link>
      </EmptyState>
    );
  }

  /*
   * 공개 응답에 `clientId`가 없어서(계약대로) 명단에서 나를 골라낼 값이 이것뿐입니다.
   * 로컬에 적어둔 id가 실제 명단에 있어야 참가한 것으로 봅니다 — 주최자가 게임을 다시
   * 만들면 id가 남아 있어도 명단에는 없습니다.
   */
  const me = game.participants.find((participant) => participant.id === participantId) ?? null;

  if (game.status === 'FINISHED') {
    return <GameResult game={game} myParticipantId={participantId} />;
  }

  if (game.status === 'OPEN' && me === null) {
    return (
      <GameJoinForm
        defaultNickname={defaultNickname}
        participantCount={game.participants.length}
        isPending={joinMutation.isPending}
        submitError={joinErrorMessage(joinMutation.error)}
        onSubmit={handleJoin}
      />
    );
  }

  return <GameWaiting game={game} me={me} />;
};

export { ParticipantGameView };
