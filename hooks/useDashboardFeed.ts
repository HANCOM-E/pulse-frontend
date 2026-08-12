'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchModerationQueue } from '@/lib/api/endpoints';
import type { Feedback } from '@/lib/schemas/api';

/**
 * 주최자 대시보드가 보는 소감 목록입니다. 지금은 폴링이고 나중에 SSE로 승급합니다.
 *
 * 참가자 화면의 `useFeedbackSnapshot`과 나란히 있지만 보는 엔드포인트가 다릅니다. 저쪽은
 * 서버가 집계해서 내려주는 공개 스냅샷이고, 이쪽은 `/admin/feedbacks`의 원본 목록입니다.
 * 대시보드가 원본을 받아야 하는 이유는 세 가지입니다.
 *
 * 1. 독성 플래그 개수 — 공개 스냅샷의 `FeedbackView`에는 `toxic`이 없습니다. 모더레이션
 *    신호를 공개 엔드포인트로 내보내지 않기로 한 계약이라 집계에도 안 실립니다.
 * 2. 시간대별 감정 추이 — 스냅샷은 "지금"만 알려줘서 시계열을 만들 수 없습니다. 원본의
 *    `createdAt`을 버킷으로 묶어야 나옵니다.
 * 3. 숨기기·삭제 — 액션 대상이 되려면 `id`와 `status`가 필요합니다.
 *
 * `includeHidden`을 켜서 받는 이유는 모더레이션 큐가 이미 숨긴 건도 보여줘야 하기
 * 때문입니다. 집계와 피드에서 빼는 일은 화면이 `status`로 거릅니다.
 *
 * CLAUDE.md의 "실시간(클라이언트): 폴링 → SSE 승급, 훅으로 격리" 원칙에 따라 갱신 방식을
 * 아는 코드는 이 파일에만 둡니다. `refetchInterval`을 밖으로 내보내지 않는 것도 같은 이유입니다.
 */

const REFRESH_INTERVAL_MS = 5_000;

/** 숨기기·삭제 뒤 목록을 다시 받을 때 쓰는 키 앞자리입니다. */
const DASHBOARD_FEED_KEY = 'dashboardFeed';

interface UseDashboardFeedParams {
  eventCode: string;
  /** `null`이면 이벤트 전체입니다. 세션 필터의 "전체"가 이 값입니다. */
  sessionId: number | null;
}

interface UseDashboardFeedResult {
  feedbacks: Feedback[] | undefined;
  isPending: boolean;
  isError: boolean;
  /**
   * 화면이 "N초마다 갱신돼요"를 그릴 때 쓰는 값입니다.
   * SSE로 바뀌면 `null`이 됩니다.
   */
  refreshIntervalMs: number | null;
}

const useDashboardFeed = ({
  eventCode,
  sessionId,
}: UseDashboardFeedParams): UseDashboardFeedResult => {
  const { data, isPending, isError } = useQuery({
    queryKey: [DASHBOARD_FEED_KEY, eventCode, sessionId],
    queryFn: () =>
      fetchModerationQueue({
        eventCode,
        sessionId: sessionId ?? undefined,
        includeHidden: true,
      }),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  return {
    feedbacks: data,
    isPending,
    isError,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  };
};

export { useDashboardFeed, DASHBOARD_FEED_KEY };
