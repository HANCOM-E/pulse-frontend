'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchFeedbackSnapshot } from '@/lib/api/endpoints';
import type { FeedbackSnapshot } from '@/lib/schemas/api';

/**
 * 집계 스냅샷 구독입니다. 지금은 폴링이고 나중에 SSE로 승급합니다.
 *
 * CLAUDE.md의 "실시간(클라이언트): 폴링 → SSE 승급, 훅으로 격리해서 나중에 전환" 원칙에 따라,
 * 갱신 방식을 아는 코드를 이 파일 하나로 묶었습니다. 백엔드가 SSE 엔드포인트를 열면 이 파일의
 * 내부만 바꾸면 되고 화면은 손대지 않습니다.
 *
 * 그래서 `refetchInterval` 같은 TanStack Query 옵션도 밖으로 내보내지 않습니다. 화면이 폴링을
 * 전제한 코드를 갖게 되면 격리한 의미가 없어집니다.
 */

const REFRESH_INTERVAL_MS = 3_000;

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
   * 화면이 "N초마다 갱신돼요"를 그릴 때 쓰는 값입니다.
   *
   * SSE로 바뀌면 `null`이 됩니다. 호출부는 값이 있으면 주기를 안내하고 없으면 그 문구를 빼면 되므로,
   * 갱신 방식이 무엇인지는 몰라도 됩니다.
   */
  refreshIntervalMs: number | null;
}

export const useFeedbackSnapshot = ({
  eventCode,
  sessionId,
}: UseFeedbackSnapshotParams): UseFeedbackSnapshotResult => {
  const { data, isPending, isError } = useQuery({
    queryKey: ['feedbackSnapshot', eventCode, sessionId],
    queryFn: () => fetchFeedbackSnapshot(eventCode, sessionId ?? undefined),
    enabled: sessionId !== null,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  return {
    snapshot: data,
    isPending,
    isError,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  };
};
