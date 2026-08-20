'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchEventByCode, fetchPublicReport, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import { isClientError, type EventView, type SessionView } from '@/lib/schemas/api';

/**
 * 게스트 진입 화면(`/e/[code]`)이 보는 이벤트·세션·리포트입니다. 지금은 폴링이고 나중에 SSE로
 * 승급합니다.
 *
 * 셋을 한 훅에 두는 이유는 서로 배타적으로 켜졌다 꺼지는 하나의 상태 머신이기 때문입니다.
 * 이벤트가 `ENDED`를 잡는 순간 세션 폴링을 끄고 리포트 폴링을 켜는 그 조율이 이 훅의 알맹이라,
 * 나눠두면 조율이 화면으로 흘러나갑니다(`useEventReport`가 조회·생성·공개를 묶은 것과 같은 이유).
 *
 * CLAUDE.md의 "실시간(클라이언트): 폴링 → SSE 승급, 훅으로 격리" 원칙에 따라 갱신 방식을 아는
 * 코드는 이 파일에만 둡니다. `refetchInterval`을 밖으로 내보내지 않는 것도 같은 이유입니다.
 */

/**
 * 세션이 열리고 닫히는 것을 따라가는 간격입니다.
 *
 * "세션 시작"은 초 단위 정확도가 필요한 값이 아니고, 게스트 요청은 참가자 수만큼 곱해집니다.
 * 그래서 주최자 화면보다 촘촘하게 갈 이유가 없습니다(#237).
 */
const REFRESH_INTERVAL_MS = 5_000;

/**
 * 리포트가 공개되기를 기다리는 간격입니다. 위보다 훨씬 성긴 이유는 시간 척도가 달라서입니다 —
 * 주최자가 종료하고, 생성하고, 읽어보고, 공개하기까지는 몇 분에서 며칠입니다.
 *
 * 탭이 백그라운드로 가면 `refetchIntervalInBackground`의 기본값(`false`)이 타이머를 멈춥니다.
 * 그래서 리포트를 기다리며 열어둔 탭이 종일 서버를 두들기는 일은 생기지 않습니다.
 */
const REPORT_REFRESH_INTERVAL_MS = 15_000;

/**
 * 다시 물어봐도 같은 답이 오는 실패인지 봅니다. `QueryProvider`의 `retry`가 재시도를 거르는
 * 기준(4xx + `INVALID_RESPONSE`)과 같습니다. 재시도하지 않기로 한 실패는 폴링도 하지 않습니다.
 *
 * `useDashboardFeed`에 같은 함수가 있습니다. 아직 두 벌이라 옮기지 않았습니다 — 세 번째가
 * 생기면 그때 공용으로 빼는 편이 맞아 보입니다.
 */
const isPermanentFailure = (error: Error | null): boolean =>
  error instanceof ApiError && (error.code === 'INVALID_RESPONSE' || isClientError(error.code));

/**
 * 리포트가 공개됐는지만 봅니다. 본문은 받지 않습니다 — 이 화면이 정하는 건 "결과 리포트 보기"를
 * 열지 말지 하나뿐이고, 내용은 `/e/[code]/report`가 따로 받아갑니다.
 *
 * 404를 에러로 두지 않고 `false`로 삼킵니다. 서버는 없음·비공개·생성 중을 `REPORT_NOT_FOUND`
 * 하나로 합쳐서 주는데(`app/e/[code]/report/page.tsx`), 이 화면에서 그건 실패가 아니라 "아직
 * 안 나왔다"는 정상 상태입니다. 에러로 남기면 아래 `isPermanentFailure`가 4xx로 보고 폴링을
 * 멈춰서, 주최자가 나중에 공개해도 화면이 영영 모릅니다.
 */
const fetchReportExists = async (eventCode: string): Promise<boolean> => {
  try {
    await fetchPublicReport(eventCode);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'REPORT_NOT_FOUND') return false;
    throw error;
  }
};

interface UseEventEntryFeedParams {
  eventCode: string;
  /**
   * 서버 컴포넌트가 이미 받아둔 값입니다. `initialData`로 넣어야 SSR HTML에 실려 나간 첫 화면이
   * 그대로 유지되고, 그 뒤부터 폴링이 갱신을 맡습니다. 넘기지 않으면 게스트가 완성된 화면을
   * 받아놓고도 마운트 직후 빈 상태를 한 번 지나갑니다.
   */
  initialEvent: EventView;
  initialSessions: SessionView[];
  initialHasReport: boolean;
}

interface UseEventEntryFeedResult {
  event: EventView;
  sessions: SessionView[];
  /** 소감을 받을 수 있는 상태인지입니다. 폼을 그릴지 빈 상태를 그릴지 가릅니다. */
  canSubmit: boolean;
  isEnded: boolean;
  /** 공개된 리포트가 있는지입니다. `ENDED`가 아니면 항상 `false`입니다. */
  hasReport: boolean;
}

const useEventEntryFeed = ({
  eventCode,
  initialEvent,
  initialSessions,
  initialHasReport,
}: UseEventEntryFeedParams): UseEventEntryFeedResult => {
  const eventQuery = useQuery({
    queryKey: ['event', eventCode],
    queryFn: () => fetchEventByCode(eventCode),
    initialData: initialEvent,
    /*
     * `ENDED`는 종착역입니다. 전이가 `DRAFT → LIVE → ENDED` 단방향이라
     * (`mocks/handlers/event.ts`) 되돌아올 일이 없어서, 도착하면 자기 자신을 끕니다.
     */
    refetchInterval: ({ state }) =>
      state.data?.status === 'ENDED' || isPermanentFailure(state.error)
        ? false
        : REFRESH_INTERVAL_MS,
  });

  const event = eventQuery.data;
  const isEnded = event.status === 'ENDED';

  const sessionsQuery = useQuery({
    queryKey: ['sessions', eventCode],
    queryFn: () => fetchSessionsByEventCode(eventCode),
    initialData: initialSessions,
    /*
     * 정지 조건에 세션 상태를 넣지 않습니다. "하나라도 열렸으면 그만 물어봐도 된다"가 그럴듯해
     * 보이지만, 그러면 닫히는 쪽을 못 잡습니다 — 주최자가 A를 닫고 B를 여는 사이 게스트는 A만
     * 열린 화면에 소감을 다 쓰고 제출에서야 `SESSION_CLOSED`를 받습니다.
     *
     * `ENDED`에서 멈추는 건 다릅니다. 그 뒤에 세션이 열려도 `canSubmit`이 `LIVE`를 요구해서
     * 화면이 바뀌지 않습니다. 목이 세션 토글에 이벤트 상태를 검사하지 않아 실제로 열릴 수는
     * 있지만, 열려봐야 게스트는 `EVENT_NOT_LIVE`로 막힙니다.
     */
    refetchInterval: ({ state }) =>
      isEnded || isPermanentFailure(state.error) ? false : REFRESH_INTERVAL_MS,
  });

  const reportQuery = useQuery({
    queryKey: ['publicReportExists', eventCode],
    queryFn: () => fetchReportExists(eventCode),
    initialData: initialHasReport,
    /*
     * 전역 기본값(`QueryProvider`의 10초)보다 길어야 의미가 있습니다. SSR로 받아둔 값을 마운트
     * 직후 한 번 더 물어보지 않게 하려는 것이고, 폴링 간격과 맞춰야 요청이 두 리듬으로 겹치지
     * 않습니다. 이벤트·세션 쪽은 전역 10초가 이미 그 일을 해서 따로 두지 않았습니다.
     */
    staleTime: REPORT_REFRESH_INTERVAL_MS,
    // 리포트 생성 자체가 `ENDED`에서만 가능해서(`useEventReport`), 그 전에는 물어볼 이유가 없습니다.
    enabled: isEnded,
    /*
     * 공개된 뒤에도 멈추지 않습니다. `isPublic`은 주최자가 되돌릴 수 있는 값이라, 도달했다고
     * 멈추면 공개 → 비공개 → 공개를 통째로 놓치고 화면이 실제와 어긋난 채로 굳습니다. 한 번
     * 가면 끝인 `ENDED`나 `useEventReport`의 `GENERATED`와 다른 점이 여기입니다.
     *
     * 실패 정지만 남깁니다. 4xx는 다시 물어도 같은 답이지만 5xx·끊김은 다음번에 성공할 수 있어서,
     * 거기서까지 멈추면 순간 장애 한 번에 화면이 영영 굳습니다.
     */
    refetchInterval: ({ state }) =>
      isPermanentFailure(state.error) ? false : REPORT_REFRESH_INTERVAL_MS,
  });

  return {
    event,
    sessions: sessionsQuery.data,
    /*
     * 파생값까지 훅이 계산해서 내보냅니다. 화면이 다시 조합하게 두면 폴링으로 값이 움직일 때마다
     * 판정이 두 벌로 갈리고, 한쪽만 고치는 실수가 열립니다.
     *
     * `LIVE`를 요구하는 이유 — 참가자는 `DRAFT`와 "세션이 아직 안 열림"을 구분할 수 없습니다. 둘 다
     * 기다려야 하는 상태라 같은 화면을 보여줍니다. `DRAFT`는 세션이 미리 만들어져 있어도 막아야
     * 합니다. 폼이 뜨면 소감을 다 쓴 뒤에 `EVENT_NOT_LIVE`로 실패합니다.
     *
     * 세션 0개 검사 — 지금 API로는 나올 수 없습니다(`DRAFT → LIVE` 전환에 1개 이상 검사가 있고
     * 삭제 API가 없음). 다만 그 검사가 목에만 있어서, 실제 서버가 빠뜨리면 칩 없는 폼이 뜨고 제출
     * 버튼이 영원히 비활성이 됩니다. 조건 한 항목으로 막습니다.
     */
    canSubmit: event.status === 'LIVE' && sessionsQuery.data.length > 0,
    isEnded,
    hasReport: isEnded && reportQuery.data === true,
  };
};

export { useEventEntryFeed };
