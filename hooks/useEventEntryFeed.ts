'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { 
  fetchCurrentGame,
  fetchEventByCode,
  fetchPublicReport,
  fetchSessionsByEventCode
} from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import {
  isClientError,
  listResponseSchema,
  sessionViewSchema,
  type EventView,
  type GameView,
  type SessionView,
} from '@/lib/schemas/api';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/env';

/**
 * 게스트 진입 화면(`/e/[code]`)이 보는 이벤트·세션·리포트·게임입니다.
 *
 * 넷을 한 훅에 두는 이유는 서로 배타적으로 켜졌다 꺼지는 하나의 상태 머신이기 때문입니다.
 * 이벤트가 `ENDED`를 잡는 순간 세션 구독을 끊고 리포트 폴링을 켜는 그 조율이 이 훅의 알맹이라,
 * 나눠두면 조율이 화면으로 흘러나갑니다(`useEventReport`가 조회·생성·공개를 묶은 것과 같은 이유).
 *
 * 갱신 수단이 둘로 갈립니다. 세션만 SSE(`.../sessions/stream`)로 받고, 이벤트 상태와 리포트는
 * 폴링입니다. 명세에 스트림이 셋뿐이라 이벤트 상태에는 아예 없고, 리포트는 "실시간 push(SSE)는
 * 도입하지 않고 폴링으로 확정"이라고 명시적으로 배제됐습니다(2026-08-21).
 * 
 * 게임도 폴링입니다. 명세의 스트림 3종에 게임이 없어서 이벤트 상태와 같은 처지입니다.
 *
 * CLAUDE.md의 "실시간(클라이언트): 폴링 → SSE 승급, 훅으로 격리" 원칙에 따라 갱신 방식을 아는
 * 코드는 이 파일에만 둡니다. 화면은 `EventSource`도 폴링 간격도 모릅니다.
 */

/** 서버가 스냅샷을 싣는 이벤트 이름입니다. 스트림 3종이 모두 이 이름을 씁니다(명세 고정값). */
const SNAPSHOT_EVENT = 'snapshot';

/**
 * 이벤트 상태(`DRAFT` → `LIVE` → `ENDED`)를 따라가는 간격이자, 세션 스트림이 죽었을 때
 * 되살리는 폴링 간격입니다. SSE 전환 전 둘 다 이 값이었어서 그대로 씁니다.
 *
 * 이벤트 상태에는 스트림이 없어서 그쪽은 늘 폴링입니다. "행사가 시작됐다"는 초 단위 정확도가
 * 필요한 값이 아니고 게스트 요청은 참가자 수만큼 곱해지므로, 촘촘하게 갈 이유가 없습니다.
 * 이 간격이 곧 게스트가 시작·종료를 알아차리기까지의 최대 지연입니다.
 */
const REFRESH_INTERVAL_MS = 5_000;

/**
 * 연결한 뒤 첫 스냅샷을 이만큼 기다려보고, 안 오면 스트림이 죽은 것으로 봅니다.
 *
 * `onerror`로는 못 잡는 실패가 있어서 필요합니다. 압축 계층이 SSE를 막으면 응답이 200에
 * `text/event-stream`이라 브라우저는 정상 연결로 보고 `open`까지 띄우는데, 본문만 안 옵니다
 * (2026-08-21 실측, #261). 그때 관측할 수 있는 건 "아무 일도 안 일어난다"뿐이라 시간을 재는
 * 수밖에 없습니다.
 *
 * 명세가 연결 즉시 스냅샷 1건을 보장하고 목에서는 43ms에 왔습니다. 5초면 느린 회선에서도
 * 오탐이 나지 않을 여유입니다.
 */
const STREAM_TIMEOUT_MS = 5_000;

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
 * 스트림으로 들어온 한 건을 계약 스키마로 검사하고 봉투를 벗깁니다.
 *
 * `EventSource`는 `apiClient`를 거치지 않아서 `endpoints.ts`의 응답 검증이 통째로 우회됩니다.
 * 여기서 다시 걸러주지 않으면 "계약과 다른 응답을 화면까지 흘리지 않는다"는 규칙이 실시간
 * 경로에서만 사라집니다. `JSON.parse`가 던지는 경우도 같이 받습니다.
 *
 * 모듈 스코프에 두는 이유는 아래 effect가 이 함수를 쓰기 때문입니다. 훅 안에 두면 렌더마다 새
 * 함수가 되고, 그걸 deps에 넣는 순간 렌더마다 구독을 끊었다 다시 엽니다.
 *
 * `feedbacks/stream`과 달리 `{ items }` 봉투로 옵니다(`SessionListResponse`).
 */
const parseSessions = (raw: string): SessionView[] | null => {
  try {
    const result = listResponseSchema(sessionViewSchema).safeParse(JSON.parse(raw));
    return result.success ? result.data.items : null;
  } catch {
    return null;
  }
};

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
   * 그대로 유지되고, 그 뒤부터 스트림·폴링이 갱신을 맡습니다. 넘기지 않으면 게스트가 완성된
   * 화면을 받아놓고도 마운트 직후 빈 상태를 한 번 지나갑니다.
   */
  initialEvent: EventView;
  initialSessions: SessionView[];
  initialHasReport: boolean;
  /** 열린 게임이 없으면 `null`입니다. 404가 정상 상태라 에러가 아닙니다. */
  initialCurrentGame: GameView | null;
}

interface UseEventEntryFeedResult {
  event: EventView;
  sessions: SessionView[];
  /** 소감을 받을 수 있는 상태인지입니다. 폼을 그릴지 빈 상태를 그릴지 가릅니다. */
  canSubmit: boolean;
  isEnded: boolean;
  /** 공개된 리포트가 있는지입니다. `ENDED`가 아니면 항상 `false`입니다. */
  hasReport: boolean;
  /** 지금 열린 게임입니다. 없거나 행사가 끝났으면 `null`입니다. */
  currentGame: GameView | null;
}

const useEventEntryFeed = ({
  eventCode,
  initialEvent,
  initialSessions,
  initialHasReport,
  initialCurrentGame,
}: UseEventEntryFeedParams): UseEventEntryFeedResult => {
  const queryClient = useQueryClient();
  /** 세션 스트림이 죽었는지입니다. 참이면 아래 쿼리가 폴링으로 되돌아갑니다. */
  const [isStreamBroken, setIsStreamBroken] = useState(false);

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
     * 갱신은 아래 스트림이 맡으므로 재요청 트리거를 끕니다.
     *
     * 폴링 시절에는 여기에 "정지 조건에 세션 상태를 넣지 않는다"는 설명이 있었습니다. 하나라도
     * 열렸다고 그만 물어보면 닫히는 쪽을 놓쳐서, 주최자가 A를 닫고 B를 여는 사이 게스트가 A만
     * 열린 화면에 소감을 다 쓰고 제출에서야 `SESSION_CLOSED`를 받는 문제였습니다. 밀어주는
     * 방식에서는 "그만 물어봐도 되나"를 따질 일이 없어서 그 고민 자체가 사라졌습니다.
     *
     * `initialData`가 있는 상태의 `staleTime: Infinity`라 평소에는 `queryFn`이 아예 실행되지
     * 않습니다. SSR이 첫 값을 채우고 그 뒤는 스트림이 덮어씁니다.
     */
    staleTime: Infinity,
    /*
     * 스트림이 죽은 동안만 예전 폴링을 되살립니다. `refetchInterval`은 staleness를 보지 않아서
     * 위의 `staleTime: Infinity`와 함께 둬도 스위치처럼 동작합니다.
     *
     * 이게 없으면 스트림이 조용히 죽었을 때 세션 목록이 SSR 시점 값에 영영 굳습니다. 칩도 폼도
     * 멀쩡히 떠 있어서 아무도 눈치채지 못한 채 #237이 그대로 재현됩니다.
     */
    refetchInterval: isStreamBroken ? REFRESH_INTERVAL_MS : false,
  });

  /*
   * 세션 목록 구독입니다(#261). `ENDED` 뒤에는 열지 않습니다 — 폴링을 멈추던 조건과 같은
   * 판단이고, 그 뒤에 세션이 열려도 `canSubmit`이 `LIVE`를 요구해서 화면이 바뀌지 않습니다.
   *
   * `EventSource`는 Next도 React도 아닌 브라우저 API라 서버에는 없습니다. effect가 서버에서
   * 실행되지 않아서 SSR이 터지지 않는 것이고, 이 생성을 effect 밖으로 끌어내면 그때 깨집니다.
   *
   * 연결 상태를 화면에 보여주지는 않습니다(그릴 자리가 없습니다). 대신 죽은 걸 감지해서 위
   * 쿼리의 폴링을 되살리는 데만 씁니다.
   */
  useEffect(() => {
    if (isEnded) return;
    const source = new EventSource(`${API_BASE_URL}/events/${eventCode}/sessions/stream`);

    /*
     * 첫 스냅샷을 기다리는 타이머입니다. 연결할 때마다 새로 걸고 스냅샷이 오면 지웁니다.
     *
     * 스냅샷마다 다시 걸지 않는 게 중요합니다. 다시 걸면 세션이 한동안 안 바뀌는 조용한 구간을
     * 고장으로 잘못 읽습니다. 서버가 밀어줄 게 없어서 조용한 것과 스트림이 죽어서 조용한 것은
     * 다르고, 구분점은 "연결 직후 1건"이라는 명세의 보장입니다.
     */
    let watchdog: ReturnType<typeof setTimeout>;
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => setIsStreamBroken(true), STREAM_TIMEOUT_MS);
    };

    // 연결이 아예 안 뜨는 경우까지 덮으려고 여기서 한 번, 재연결마다 `open`에서 다시 겁니다.
    armWatchdog();
    source.addEventListener('open', armWatchdog);

    source.addEventListener(SNAPSHOT_EVENT, (message: MessageEvent<string>) => {
      const sessions = parseSessions(message.data);
      if (sessions === null) return;

      clearTimeout(watchdog);
      setIsStreamBroken(false);
      queryClient.setQueryData(['sessions', eventCode], sessions);
    });

    /*
     * 끊겨서 다시 붙는 중(`CONNECTING`)이면 곧 돌아오므로 실패로 치지 않습니다. `CLOSED`는
     * 브라우저가 재연결을 포기한 상태라 스스로 살아나지 않습니다. 이때만 폴백을 켭니다.
     */
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) setIsStreamBroken(true);
    };

    return () => {
      clearTimeout(watchdog);
      source.close();
    };
  }, [eventCode, isEnded, queryClient]);

  /*
   * 소감 화면 배너가 쓰는 "지금 열린 게임"입니다(#243).
   *
   * 세션과 달리 스트림이 없습니다. 명세의 실시간 3종에 게임이 안 들어가 있어서, 이벤트
   * 상태와 같이 폴링으로 남습니다. 간격을 맞춘 것도 그래서입니다 — 둘 다 "주최자가
   * 스위치를 눌렀나"를 묻는 질문이고 반응 속도 요구가 같습니다.
   *
   * `isEnded`에서 멈추는 이유도 이벤트 상태와 같습니다. 행사가 끝나면 게임이 새로 열릴
   * 일이 없습니다.
   *
   * 열린 게임이 없을 때는 `fetchCurrentGame`이 404를 `null`로 삼켜서 옵니다. 그대로
   * 던지면 `isPermanentFailure`가 4xx로 보고 폴링을 멈춰서, 주최자가 나중에 열어도
   * 화면이 모릅니다.
   */
  const gameQuery = useQuery({
    queryKey: ['currentGame', eventCode],
    queryFn: () => fetchCurrentGame(eventCode),
    initialData: initialCurrentGame,
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
     * 않습니다. 이벤트 쪽은 전역 10초가 이미 그 일을 하고, 세션은 스트림이 맡아서 아예
     * `staleTime: Infinity`입니다.
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
     * 파생값까지 훅이 계산해서 내보냅니다. 화면이 다시 조합하게 두면 값이 움직일 때마다 판정이
     * 두 벌로 갈리고, 한쪽만 고치는 실수가 열립니다.
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
    /*
     * `isEnded`면 폴링만 멈추는 게 아니라 값도 지웁니다. 멈추기만 하면 주최자가 결과를 안
     * 올린 채 종료했을 때 배너가 「레이스 진행 중」에 굳습니다.
     */
    currentGame: isEnded ? null : gameQuery.data,
  };
};

export { useEventEntryFeed };
