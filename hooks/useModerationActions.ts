'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { DASHBOARD_FEED_KEY } from '@/hooks/useDashboardFeed';
import { showToast } from '@/hooks/useToast';
import { deleteFeedback, hideFeedback, showFeedback } from '@/lib/api/endpoints';
import type { Feedback } from '@/lib/schemas/api';

/**
 * 주최자가 소감 하나에 취할 수 있는 조치입니다. 숨기기·숨김 해제·삭제 세 가지입니다.
 *
 * 훅으로 묶은 이유는 두 화면이 같은 조치를 쓰기 때문입니다. 지금은 대시보드의 모더레이션
 * 큐 위젯이고, "전체보기" 모달(`components/moderation/ModerationQueueModal.tsx`)이
 * 같은 API 세 개를 씁니다. 성공 후 목록을 다시 받는 일과 토스트 문구가 두 곳에 흩어지면
 * 한쪽만 바뀝니다.
 */

interface ModerationActions {
  /** `HIDDEN`이면 숨김 해제, 아니면 숨김입니다. */
  toggleHidden: (feedback: Feedback) => void;
  remove: (feedbackId: number) => void;
  /** 이 소감의 숨김 전환이 서버 응답을 기다리는 중인지 봅니다. */
  isTogglePending: (feedbackId: number) => boolean;
  isRemovePending: (feedbackId: number) => boolean;
  /** 세 조치 중 하나라도 실패했는지 봅니다. 화면이 배너를 그릴 때 씁니다. */
  isError: boolean;
}

const useModerationActions = (): ModerationActions => {
  const queryClient = useQueryClient();

  const invalidateFeed = () => {
    queryClient.invalidateQueries({ queryKey: [DASHBOARD_FEED_KEY] });
  };

  const hideMutation = useMutation({
    mutationFn: hideFeedback,
    onSuccess: () => {
      invalidateFeed();
      showToast('소감을 숨겼어요');
    },
  });

  /*
   * 숨김은 되돌릴 수 있는 상태입니다(요구사항 소감 상태 전이 4번). 종단 상태는 `DELETED`뿐이라,
   * 숨긴 건은 큐에 남겨두고 같은 버튼으로 되돌립니다. 큐가 `includeHidden=true`로 받는 것도
   * 이 되돌리기 때문입니다.
   */
  const showMutation = useMutation({
    mutationFn: showFeedback,
    onSuccess: () => {
      invalidateFeed();
      showToast('숨김을 해제했어요');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFeedback,
    onSuccess: () => {
      invalidateFeed();
      showToast('소감을 삭제했어요');
    },
  });

  /*
   * 잠금 판정이 id를 받는 이유입니다. `isPending`만 보면 목록의 모든 항목이 mutation 하나를
   * 공유해서, 한 건을 처리하는 동안 누르지 않은 항목의 버튼까지 잠깁니다. `variables`에는
   * `mutate`에 넘긴 id가 요청이 도는 동안 남아 있어서, 대상이 누구인지 여기서 가릅니다.
   *
   * 이 비교를 화면마다 다시 쓰게 두면 한 곳만 빠뜨렸을 때 같은 버그가 되살아납니다.
   */
  return {
    toggleHidden: (feedback) => {
      if (feedback.status === 'HIDDEN') {
        showMutation.mutate(feedback.id);
        return;
      }

      hideMutation.mutate(feedback.id);
    },
    remove: (feedbackId) => {
      deleteMutation.mutate(feedbackId);
    },
    isTogglePending: (feedbackId) =>
      (hideMutation.isPending && hideMutation.variables === feedbackId) ||
      (showMutation.isPending && showMutation.variables === feedbackId),
    isRemovePending: (feedbackId) =>
      deleteMutation.isPending && deleteMutation.variables === feedbackId,
    isError: hideMutation.isError || showMutation.isError || deleteMutation.isError,
  };
};

export { useModerationActions, type ModerationActions };
