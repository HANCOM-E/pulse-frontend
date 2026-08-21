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
   * 스트림이 붙어 있는지입니다. 화면은 이 값으로 "실시간" 안내를 그릴지 정합니다.
   *
   * 폴링 시절의 `refreshIntervalMs`를 대신합니다. 밀어주는 방식에는 간격이라는 개념이 없어서
   * "N초마다"를 그릴 수 없고, 대신 붙었는지 끊겼는지가 사용자에게 의미 있는 정보가 됐습니다.
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
     * 갱신은 스트림이 맡으므로 재요청 트리거를 끕니다. 이 쿼리에 남은 역할은 둘입니다 —
     * 스트림의 첫 스냅샷이 오기 전 화면을 채우는 것, 그리고 스트림이 못 뜬 경우의 폴백입니다.
     *
     * 폴백을 남겨둔 값이 실제로 있습니다. 압축 계층이 SSE를 막으면(#261) 스트림은 열리기만
     * 하고 이벤트가 한 건도 안 오는데, 그때도 화면은 한 번 받아둔 집계를 보여줍니다. 대신
     * 실시간이 죽은 걸 화면이 모르게 되므로 `isLive`로 그 사실을 따로 알립니다.
     */
    staleTime: Infinity,
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
    source.addEventListener('open', () => {
      setIsLive(true);
      setIsStreamBroken(false);
    });

    source.addEventListener(SNAPSHOT_EVENT, (event: MessageEvent<string>) => {
      const snapshot = parseSnapshot(event.data);
      if (snapshot === null) {
        setIsStreamBroken(true);
        return;
      }
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
