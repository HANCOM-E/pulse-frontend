'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { fetchEventByCode, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { API_BASE_URL } from '@/lib/env';
import {
  listResponseSchema,
  sessionViewSchema,
  type EventView,
  type SessionView,
} from '@/lib/schemas/api';

/**
 * 강연자 화면이 보는 이벤트와 세션입니다. 소감 집계는 `useFeedbackSnapshot`이 따로 맡습니다.
 *
 * 둘을 한 훅에 두는 이유는 갱신 수단이 서로 다르고 그 차이를 화면에 흘리고 싶지 않아서입니다.
 * 세션은 SSE(`.../sessions/stream`)로 밀어주고, 이벤트 상태는 스트림이 없어서 폴링입니다
 * (명세의 스트림 3종에 이벤트가 없습니다 — `useEventEntryFeed`가 같은 이유로 같은 선택을 했습니다).
 *
 * CLAUDE.md의 "실시간(클라이언트): 폴링 → SSE 승급, 훅으로 격리" 원칙에 따라 갱신 방식을 아는
 * 코드는 이 파일에만 둡니다. 화면은 `EventSource`도 폴링 간격도 모릅니다.
 *
 * 세션 스트림 배선(스냅샷 이벤트 이름·워치독·폴백 전환)은 `useEventEntryFeed`와 거의 같습니다.
 * 공통 훅으로 빼지 않은 이유는 호출부가 둘뿐이고 나머지가 서로 다르기 때문입니다 — 저쪽은 SSR
 * `initialData`를 받고 리포트 폴링까지 조율하는데, 여기는 그게 없는 대신 id로 세션을 찾습니다.
 * 공통화하면 `enabled`·`initialData`·쿼리 키를 전부 인자로 받게 되어 도리어 읽기 어려워집니다.
 * 세 번째 소비자가 생기면 그때 빼는 게 맞습니다.
 *
 * 다만 스트림 계약(이벤트 이름·타임아웃)이 바뀌면 두 파일을 함께 고쳐야 합니다.
 *
 * 이게 없을 때 실제로 나던 문제: 주최자가 강연 중에 세션을 `CLOSED`로 내려도 강연자 화면의
 * 배지는 `소감 받는 중`으로 남았습니다. 이벤트를 종료해도 마찬가지로 `LIVE`인 줄 알고 급변
 * 배너를 계속 띄웠습니다. 둘 다 한 번 받고 끝이었기 때문입니다.
 */

/** 서버가 스냅샷을 싣는 이벤트 이름입니다. 스트림 3종이 모두 이 이름을 씁니다(명세 고정값). */
const SNAPSHOT_EVENT = 'snapshot';

/**
 * 이벤트 상태를 따라가는 간격이자, 세션 스트림이 죽었을 때 되살리는 폴링 간격입니다.
 * `useEventEntryFeed`가 같은 두 용도에 쓰는 값과 맞췄습니다.
 */
const REFRESH_INTERVAL_MS = 5_000;

/**
 * 연결한 뒤 첫 스냅샷을 이만큼 기다려보고, 안 오면 스트림이 죽은 것으로 봅니다.
 *
 * `onerror`로는 못 잡는 실패가 있어서 필요합니다. 압축 계층이 SSE를 막으면 응답이 200에
 * `text/event-stream`이라 브라우저는 정상 연결로 보고 `open`까지 띄우는데 본문만 안 옵니다(#261).
 */
const STREAM_TIMEOUT_MS = 5_000;

/**
 * 스트림으로 들어온 목록을 계약 스키마로 검사합니다.
 *
 * `EventSource`는 `apiClient`를 거치지 않아서 `endpoints.ts`의 응답 검증이 통째로 우회됩니다.
 * 여기서 다시 걸러주지 않으면 "계약과 다른 응답을 화면까지 흘리지 않는다"는 규칙이 실시간
 * 경로에서만 사라집니다.
 */
const parseSessions = (raw: string): SessionView[] | null => {
  try {
    const result = listResponseSchema(sessionViewSchema).safeParse(JSON.parse(raw));
    return result.success ? result.data.items : null;
  } catch {
    return null;
  }
};

interface UseSpeakerSessionMetaParams {
  eventCode: string;
  sessionId: number;
}

interface SpeakerSessionMeta {
  event: EventView | undefined;
  /**
   * 목록에서 찾은 세션입니다. 목록은 받았는데 이 id가 없으면 `null`입니다 — 삭제됐거나 주소가
   * 잘못된 경우라, 아직 못 받은 상태(`isPending`)와 구분해야 화면이 문구를 가를 수 있습니다.
   */
  session: SessionView | null;
  isPending: boolean;
  isError: boolean;
}

const useSpeakerSessionMeta = ({
  eventCode,
  sessionId,
}: UseSpeakerSessionMetaParams): SpeakerSessionMeta => {
  const queryClient = useQueryClient();
  const [isStreamBroken, setIsStreamBroken] = useState(false);

  const eventQuery = useQuery({
    queryKey: ['event', eventCode],
    queryFn: () => fetchEventByCode(eventCode),
    /*
     * `ENDED`는 종착역입니다. 전이가 `DRAFT → LIVE → ENDED` 단방향이라(`mocks/handlers/event.ts`)
     * 되돌아올 일이 없어서, 도착하면 자기 자신을 끕니다.
     */
    refetchInterval: ({ state }) =>
      state.data?.status === 'ENDED' ? false : REFRESH_INTERVAL_MS,
  });

  const sessionsQuery = useQuery({
    queryKey: ['sessions', eventCode],
    queryFn: () => fetchSessionsByEventCode(eventCode),
    /* 갱신은 아래 스트림이 맡으므로 주기적인 재요청 트리거를 끕니다. */
    staleTime: Infinity,
    /*
     * 스트림이 죽은 동안만 폴링을 켭니다. `refetchInterval`은 staleness를 보지 않아서
     * `staleTime: Infinity`와 함께 둬도 스위치처럼 동작합니다.
     *
     * 이게 없으면 스트림이 조용히 죽었을 때 세션 상태가 첫 응답에 영영 굳습니다. 배지가 멀쩡히
     * 떠 있어서 아무도 눈치채지 못합니다.
     */
    refetchInterval: isStreamBroken ? REFRESH_INTERVAL_MS : false,
  });

  const isEnded = eventQuery.data?.status === 'ENDED';

  useEffect(() => {
    /*
     * 이벤트가 끝난 뒤에는 열지 않습니다. 그 시점부터 세션 상태가 바뀌어도 참가자는 제출할 수
     * 없어서(`EVENT_NOT_LIVE`) 강연자 화면이 달라질 게 없습니다.
     *
     * `EventSource`는 Next도 React도 아닌 브라우저 API라 서버에는 없습니다. effect가 서버에서
     * 실행되지 않아서 SSR이 터지지 않는 것이고, 이 생성을 effect 밖으로 끌어내면 그때 깨집니다.
     */
    if (isEnded) return;

    const source = new EventSource(`${API_BASE_URL}/events/${eventCode}/sessions/stream`);

    /*
     * 첫 스냅샷을 기다리는 타이머입니다. 연결할 때마다 새로 걸고 스냅샷이 오면 지웁니다.
     *
     * 스냅샷마다 다시 걸지 않는 게 중요합니다. 다시 걸면 세션이 한동안 안 바뀌는 조용한 구간을
     * 고장으로 잘못 읽습니다. 구분점은 "연결 직후 1건"이라는 명세의 보장입니다.
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

  return {
    event: eventQuery.data,
    session: sessionsQuery.data?.find((item) => item.id === sessionId) ?? null,
    isPending: eventQuery.isPending || sessionsQuery.isPending,
    isError: eventQuery.isError || sessionsQuery.isError,
  };
};

export { useSpeakerSessionMeta };
