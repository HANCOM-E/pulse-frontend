'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchCurrentGame } from '@/lib/api/endpoints';
import { isPermanentFailure } from '@/lib/api/retryPolicy';
import { type GameView } from '@/lib/schemas/api';

/**
 * 게임 화면(`/e/[code]/game`, `/events/[eventCode]/game`)이 보는 "지금 열린 게임"입니다.
 *
 * `useEventEntryFeed`에도 같은 쿼리가 있지만 그쪽은 이벤트·세션·리포트까지 함께 받습니다.
 * 게임 화면은 그 셋이 필요 없어서 얇은 훅을 따로 뒀습니다. `queryKey`가 같아 TanStack
 * Query 캐시는 공유되므로, 배너에서 넘어온 직후에는 요청 없이 화면이 바로 그려집니다.
 *
 * CLAUDE.md의 "실시간(클라이언트): 폴링 → SSE 승급, 훅으로 격리" 원칙에 따라 갱신 방식을
 * 아는 코드는 이 파일에만 둡니다. `refetchInterval`을 밖으로 내보내지 않습니다.
 */

/**
 * 게스트 진입 화면과 같은 간격입니다(#237). 참가 인원이 늘어나는 걸 보여줘야 "지금
 * 들어와야겠다"가 되는데, 그건 초 단위 정확도가 필요한 값이 아니고 게스트 요청은
 * 참가자 수만큼 곱해집니다.
 */
const REFRESH_INTERVAL_MS = 5_000;

interface UseCurrentGameResult {
  /** 열린 게임이 없으면 `null`입니다. 404가 정상 상태라 에러가 아닙니다. */
  game: GameView | null;
}

interface UseCurrentGameParams {
  eventCode: string;
  /**
   * 서버 컴포넌트가 이미 받아둔 값입니다. 넘기지 않으면 게스트가 완성된 화면을 받아놓고도
   * 마운트 직후 빈 상태를 한 번 지나갑니다.
   */
  initialGame: GameView | null;
}
const useCurrentGame = ({ eventCode, initialGame }: UseCurrentGameParams): UseCurrentGameResult => {
  const query = useQuery({
    // `useEventEntryFeed`와 같은 키입니다. 다르게 두면 배너에서 넘어올 때 캐시를 못 씁니다.
    queryKey: ['currentGame', eventCode],
    queryFn: () => fetchCurrentGame(eventCode),
    initialData: initialGame,
    /*
     * `FINISHED`에서 멈추지 않습니다. 주최자가 그 뒤에 새 게임을 열 수 있고, 그때
     * `current`가 새 게임을 가리킵니다. 멈추면 참가자 화면이 지난 결과에 굳습니다.
     *
     * 이벤트가 끝났는지는 여기서 안 봅니다. 게임 화면은 이벤트 상태를 받지 않고,
     * 행사가 끝나면 주최자가 게임을 안 열어서 `current`가 어차피 그대로입니다.
     */
    refetchInterval: ({ state }) => (isPermanentFailure(state.error) ? false : REFRESH_INTERVAL_MS),
  });

  return { game: query.data };
};

export { useCurrentGame };
