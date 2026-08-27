'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createGame,
  fetchGamesOfEvent,
  submitGameResults,
  updateGameStatus,
} from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import { isClientError, type GameView } from '@/lib/schemas/api';

/**
 * 프로젝터 화면(`/events/[eventCode]/game`)이 보는 게임과 주최자가 취할 수 있는 조치입니다.
 *
 * 조회·생성·상태 전이·결과 확정을 한 훅에 묶은 이유는 넷이 하나의 상태 머신이기 때문입니다.
 * 조치가 성공하면 곧바로 목록을 다시 받아야 화면이 다음 단계로 넘어가는데, 그 조율이 화면으로
 * 흘러나가면 "성공했는데 화면이 그대로"인 경우가 열립니다(`useEventReport`와 같은 이유).
 *
 * 참가자용 `useCurrentGame`과 다른 훅인 이유는 보는 게 달라서입니다. 참가자는 `DRAFT`를
 * 못 보고(서버가 `current`에서 뺍니다) 주최자는 그걸 봐야 합니다 — 만들어두고 아직 안 연
 * 게임을 다시 찾는 게 주최자 목록의 존재 이유입니다(#258).
 */

/**
 * 참가 인원이 늘어나는 걸 프로젝터가 보여줘야 "지금 들어와야겠다"가 됩니다.
 *
 * 게스트 화면(5초)보다 촘촘한 이유는 이 화면이 **한 대뿐**이라서입니다. 게스트 요청은
 * 참가자 수만큼 곱해지지만 프로젝터는 곱해지지 않습니다.
 */
const REFRESH_INTERVAL_MS = 3000;

/** `useEventEntryFeed`·`useDashboardFeed`와 같은 기준입니다. 넷째라 공용으로 뺄 때가 됐습니다. */
const isPermanentFailure = (error: Error | null): boolean =>
  error instanceof ApiError && (error.code === 'INVALID_RESPONSE' || isClientError(error.code));

/**
 * 프로젝터가 띄울 게임 하나를 고릅니다.
 *
 * 가장 최근에 만든 것입니다(목록이 id 내림차순). 주최자가 새 게임을 만들면 화면이 자동으로
 * 그쪽으로 넘어가고, 지난 게임은 목록에만 남습니다.
 */
const pickCurrent = (games: GameView[]): GameView | null => games[0] ?? null;

interface UseHostGameResult {
  /** 띄울 게임입니다. 하나도 없으면 `null`입니다. */
  game: GameView | null;
  isLoading: boolean;
  isError: boolean;
  /** 진행 중인 조치가 있으면 참입니다. 버튼을 잠그는 데 씁니다. */
  isPending: boolean;
  create: (title: string) => void;
  open: () => void;
  start: () => void;
  finish: (ranking: number[]) => void;
}

const useHostGame = (eventCode: string): UseHostGameResult => {
  const queryClient = useQueryClient();
  const queryKey = ['hostGames', eventCode];

  const gamesQuery = useQuery({
    queryKey,
    queryFn: () => fetchGamesOfEvent(eventCode),
    /*
     * `RUNNING`에서도 멈추지 않습니다. 참가는 마감됐지만 결과 확정이 남아 있고, 주최자가
     * 다른 창에서 뭘 했을 수도 있습니다. 멈춰야 하는 상태가 따로 없어서 실패 정지만 둡니다.
     */
    refetchInterval: ({ state }) => (isPermanentFailure(state.error) ? false : REFRESH_INTERVAL_MS),
  });

  const game = pickCurrent(gamesQuery.data ?? []);

  /** 조치가 끝나면 목록을 다시 받습니다. 안 하면 다음 폴링까지 화면이 이전 단계에 머뭅니다. */
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  const createMutation = useMutation({
    mutationFn: (title: string) => createGame(eventCode, { title }),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: (variables: { gameId: number; status: 'OPEN' | 'RUNNING' }) =>
      updateGameStatus(eventCode, variables.gameId, { status: variables.status }),
    onSuccess: invalidate,
  });

  const resultsMutation = useMutation({
    mutationFn: (variables: { gameId: number; ranking: number[] }) =>
      submitGameResults(eventCode, variables.gameId, { ranking: variables.ranking }),
    onSuccess: invalidate,
  });

  return {
    game,
    isLoading: gamesQuery.isLoading,
    isError: gamesQuery.isError,
    isPending: createMutation.isPending || statusMutation.isPending || resultsMutation.isPending,
    create: (title) => createMutation.mutate(title),
    /*
     * 셋 다 게임이 없으면 아무것도 안 합니다. 화면이 이미 버튼을 안 그리지만, 훅이 그걸
     * 믿으면 화면을 고칠 때마다 여기까지 같이 봐야 합니다.
     */
    open: () => {
      if (game) statusMutation.mutate({ gameId: game.id, status: 'OPEN' });
    },
    start: () => {
      if (game) statusMutation.mutate({ gameId: game.id, status: 'RUNNING' });
    },
    finish: (ranking) => {
      if (game) resultsMutation.mutate({ gameId: game.id, ranking });
    },
  };
};

export { useHostGame };
