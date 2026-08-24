'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchFeedbackSnapshot } from '@/lib/api/endpoints';
import { feedbackSnapshotSchema, type FeedbackSnapshot } from '@/lib/schemas/api';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/env';

/**
 * 집계 스냅샷 구독입니다. 갱신은 `GET /events/{eventCode}/feedbacks/stream`(SSE)이
 * 밀어줍니다(2026-08-21 명세).
 *
 * CLAUDE.md의 "실시간(클라이언트): 폴링 → SSE 승급, 훅으로 격리해서 나중에 전환" 원칙에 따라
 * 갱신 방식을 아는 코드는 이 파일에만 둡니다. 화면은 `EventSource`도, 갱신 간격도 모릅니다.
 *
 * TanStack Query를 걷어내지 않고 캐시만 스트림이 채우게 뒀습니다. 이 훅만 보면 `useState`로도
 * 충분하지만(이 키를 무효화하는 mutation이 없습니다), 같은 모양이 `useDashboardFeed`에서는
 * 실제로 필요합니다 — 거기선 모더레이션 mutation이 `DASHBOARD_FEED_KEY`를 무효화합니다.
 */

/** 서버가 스냅샷을 싣는 이벤트 이름입니다. 스트림 3종이 모두 이 이름을 씁니다(명세 고정값). */
const SNAPSHOT_EVENT = 'snapshot';

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
 * 스트림이 죽었을 때 되살리는 폴링 간격입니다. SSE 전환 전에 쓰던 값 그대로입니다.
 *
 * 스트림이 정상인 동안에는 꺼져 있습니다. `refetchInterval`은 staleness를 보지 않아서
 * `staleTime: Infinity`와 함께 둬도 스위치처럼 동작합니다.
 */
const FALLBACK_INTERVAL_MS = 3_000;

/**
 * 스트림으로 들어온 한 건을 계약 스키마로 검사합니다.
 *
 * `EventSource`는 `apiClient`를 거치지 않아서 `endpoints.ts`의 응답 검증이 통째로 우회됩니다.
 * 여기서 다시 걸러주지 않으면 "계약과 다른 응답을 화면까지 흘리지 않는다"는 규칙이 실시간
 * 경로에서만 사라집니다. `JSON.parse`가 던지는 경우도 같이 받습니다.
 */
const parseSnapshot = (raw: string): FeedbackSnapshot | null => {
  try {
    const result = feedbackSnapshotSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

interface UseFeedbackSnapshotParams {
  eventCode: string;
  /** `null`이면 구독하지 않습니다. 대상 세션이 아직 정해지지 않은 상태입니다. */
  sessionId: number | null;
}

interface UseFeedbackSnapshotResult {
  snapshot: FeedbackSnapshot | undefined;
  isPending: boolean;
  isError: boolean;
  /**
   * 스트림으로 데이터가 실제로 흐르고 있는지입니다. 화면은 이 값으로 "실시간" 안내를 그릴지
   * 정합니다.
   *
   * 폴링 시절의 `refreshIntervalMs`를 대신합니다. 밀어주는 방식에는 간격이라는 개념이 없어서
   * "N초마다"를 그릴 수 없고, 대신 붙었는지 끊겼는지가 사용자에게 의미 있는 정보가 됐습니다.
   *
   * "연결됐는지"가 아니라 "흐르는지"입니다. 둘은 다릅니다 — 압축 계층에 막힌 스트림은 연결까지는
   * 멀쩡히 되고 데이터만 안 옵니다(#261). 그래서 `open`이 아니라 첫 스냅샷에서 켭니다.
   */
  isLive: boolean;
}

export const useFeedbackSnapshot = ({
  eventCode,
  sessionId,
}: UseFeedbackSnapshotParams): UseFeedbackSnapshotResult => {
  const queryClient = useQueryClient();
  const [isLive, setIsLive] = useState(false);
  const [isStreamBroken, setIsStreamBroken] = useState(false);
  const { data, isPending, isError } = useQuery({
    queryKey: ['feedbackSnapshot', eventCode, sessionId],
    queryFn: () => fetchFeedbackSnapshot(eventCode, sessionId ?? undefined),
    enabled: sessionId !== null,
    /*
     * 갱신은 스트림이 맡으므로 주기적인 재요청 트리거를 끕니다. 이 쿼리에 남은 역할은 둘입니다 —
     * 스트림의 첫 스냅샷이 오기 전 화면을 채우는 것, 그리고 스트림이 죽었을 때의 폴백입니다.
     */
    staleTime: Infinity,
    /*
     * 스트림이 죽은 동안만 예전 폴링을 되살립니다. `refetchInterval`은 staleness를 보지 않아서
     * 위의 `staleTime: Infinity`와 함께 둬도 스위치처럼 동작합니다.
     *
     * 이게 없으면 스트림이 조용히 죽었을 때 화면이 한 번 받아둔 집계에 영영 굳습니다. 게다가
     * 멀쩡해 보여서 아무도 눈치채지 못합니다.
     */
    refetchInterval: isStreamBroken ? FALLBACK_INTERVAL_MS : false,
  });

  useEffect(() => {
    if (sessionId === null) return;
    /*
     * effect가 서버에서 실행되지 않아서 SSR이 터지지 않는 것이고,
     * `'use client'`만으로는 부족합니다 — 클라이언트
     * 컴포넌트도 서버에서 한 번 렌더됩니다. 이 생성을 effect 밖으로 끌어내면 그때 깨집니다.
     */
    const query = new URLSearchParams({ sessionId: String(sessionId) });
    const source = new EventSource(
      `${API_BASE_URL}/events/${eventCode}/feedbacks/stream?${query.toString()}`,
    );

    /*
     * 첫 스냅샷을 기다리는 타이머입니다. 연결할 때마다 새로 걸고 스냅샷이 오면 지웁니다.
     *
     * 스냅샷마다 다시 걸지 않는 게 중요합니다. 다시 걸면 소감이 한동안 안 들어오는 조용한
     * 구간을 고장으로 잘못 읽습니다. 서버가 밀어줄 게 없어서 조용한 것과 스트림이 죽어서
     * 조용한 것은 다르고, 구분점은 "연결 직후 1건"이라는 명세의 보장입니다.
     */
    let watchdog: ReturnType<typeof setTimeout>;
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        setIsLive(false);
        setIsStreamBroken(true);
      }, STREAM_TIMEOUT_MS);
    };

    // 연결이 아예 안 뜨는 경우까지 덮으려고 여기서 한 번, 재연결마다 `open`에서 다시 겁니다.
    armWatchdog();
    source.addEventListener('open', armWatchdog);

    /*
     * `isLive`를 `open`이 아니라 첫 스냅샷에서 켭니다. 연결됐다는 것과 데이터가 흐른다는 것이
     * 다르다는 게 이번 gzip 건의 교훈입니다(#261) — `open`으로 켜면 한 건도 못 받는 스트림을
     * 두고 화면이 "실시간으로 갱신되고 있어요"라고 거짓말을 합니다.
     */
    source.addEventListener(SNAPSHOT_EVENT, (message: MessageEvent<string>) => {
      const snapshot = parseSnapshot(message.data);
      if (snapshot === null) {
        setIsStreamBroken(true);
        return;
      }

      clearTimeout(watchdog);
      setIsLive(true);
      setIsStreamBroken(false);
      queryClient.setQueryData(['feedbackSnapshot', eventCode, sessionId], snapshot);
    });

    /*
     * `error`는 두 상황에서 옵니다. 끊겨서 브라우저가 다시 붙는 중(`CONNECTING`)이면 잠깐
     * 실시간이 아닐 뿐 곧 돌아오므로 실패로 치지 않습니다. `CLOSED`는 다릅니다 — 응답이 200이
     * 아니거나 `text/event-stream`이 아니면 브라우저가 재연결을 포기하고 여기로 옵니다.
     * 스스로 살아나지 않으니 이때만 실패로 올립니다.
     */
    source.onerror = () => {
      setIsLive(false);
      if (source.readyState === EventSource.CLOSED) setIsStreamBroken(true);
    };

    return () => {
      clearTimeout(watchdog);
      source.close();
      setIsLive(false);
    };
  }, [eventCode, sessionId, queryClient]);
  return {
    snapshot: data,
    isPending,
    isError: isError || isStreamBroken,
    isLive,
  };
};
