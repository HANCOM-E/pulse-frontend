'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/hooks/useToast';
import { fetchOwnReport, generateReport, setReportPublic } from '@/lib/api/endpoints';
import type { EventStatus } from '@/lib/schemas/api';

/**
 * 이벤트 하나의 AI 요약 리포트입니다. 조회(폴링 포함)·생성·공개 전환을 함께 묶습니다.
 *
 * 셋을 한 훅에 두는 이유는 같은 캐시 한 칸을 두고 움직이기 때문입니다. 생성은 202로 받은
 * 리포트를 그 칸에 꽂아 폴링을 시작시키고, 공개 전환은 같은 칸을 갈아끼웁니다. 나눠두면
 * 캐시 키가 두 곳에 복사됩니다.
 *
 * 밖으로는 mutation 객체가 아니라 화면이 쓰는 값만 내보냅니다(`useModerationActions`와 같은
 * 방식). 리포트 상태를 읽는 자리가 대시보드 헤더와 리포트 섹션 둘인데, 각자 `isPending`과
 * `data.status`를 조합하면 "생성 중"의 정의가 두 벌이 됩니다.
 */

/**
 * 리포트가 만들어지는 동안만 쓰는 간격입니다. 소감 폴링(5초)보다 짧은 이유는, 이쪽은 버튼을
 * 누른 사람이 결과를 기다리며 보고 있는 화면이라서입니다. 끝나는 즉시 타이머를 멈춥니다.
 */
const REPORT_POLL_INTERVAL_MS = 1_500;

interface EventReportControls {
  /** `GENERATED`이고 본문이 실제로 있을 때만 채워집니다. */
  summaryText: string | null;
  /**
   * 요청을 보낸 순간부터 켜집니다. 202가 돌아오기를 기다리는 동안에도 버튼은 이미 눌렸으므로,
   * 서버 응답이 오기 전 빈 구간을 mutation의 대기 상태가 메웁니다.
   */
  isGenerating: boolean;
  isGenerated: boolean;
  /**
   * 상태를 아직 모르는 동안입니다. 생성 버튼을 잠그는 데 씁니다 — 이미 리포트가 있는
   * 이벤트에서 눌리면 REPORT_ALREADY_EXISTS만 받습니다.
   */
  isUnknown: boolean;
  isPublic: boolean;
  generate: () => void;
  /**
   * 생성 버튼을 잠글지입니다. `ENDED`가 아니거나, 상태를 모르거나, 이미 만드는 중이면 잠깁니다.
   *
   * 판정을 훅이 하는 이유는 버튼이 헤더와 리포트 카드 두 곳에 있기 때문입니다. 화면마다 세 조건을
   * 다시 조합하면 한쪽만 빠뜨렸을 때 INVALID_EVENT_STATE_TRANSITION이나 REPORT_ALREADY_EXISTS를
   * 받는 버튼이 열립니다.
   */
  isGenerateDisabled: boolean;
  /** 공개 ↔ 비공개를 뒤집습니다. 지금 값은 이 훅이 알고 있어서 인자를 받지 않습니다. */
  togglePublic: () => void;
  isTogglePublicPending: boolean;
  /** 실패 배너를 나눠 그리므로 둘을 합치지 않습니다. 안내 문구가 서로 다릅니다. */
  isGenerateError: boolean;
  isTogglePublicError: boolean;
}
const useEventReport = (eventCode: string, eventStatus?: EventStatus): EventReportControls => {
  const queryClient = useQueryClient();

  /*
   * 인증 여부를 화면에서 받지 않고 여기서 직접 봅니다(`useDashboardFeed`와 같은 이유).
   * `['auth','me']` 캐시를 공유하므로 요청은 늘지 않습니다.
   */
  const { isAuthenticated } = useAuth();

  const reportQueryKey = ['report', eventCode];

  /*
   * 리포트 행이 없는 상태(개념상 NONE)는 404 REPORT_NOT_FOUND로 옵니다. 에러로 오지만 "아직
   * 생성하지 않았다"는 정상 상태라, 화면은 이걸 실패가 아니라 생성 전으로 읽습니다.
   * `QueryProvider`의 `retry`가 4xx를 이미 거르므로 없는 리포트를 두들기지도 않습니다.
   *
   * 생성이 비동기라 폴링이 필요합니다. `GENERATING` 동안에만 돌리고 나머지 상태에서는 멈춥니다.
   * 완료된 리포트를 계속 다시 받아봐야 같은 답이고, 여기서 멈추지 않으면 이 화면을 열어둔 내내
   * 1.5초마다 요청이 나갑니다.
   */
  const reportQuery = useQuery({
    queryKey: reportQueryKey,
    queryFn: () => fetchOwnReport(eventCode),
    /*
     * 생성 자체가 `ENDED`에서만 가능해서, 그 전에는 물어볼 이유가 없습니다.
     *
     * 로그인이 풀린 상태에서도 내보내지 않습니다. 이쪽은 `GENERATING` 동안에만 폴링해서 노출
     * 창이 좁지만, 그 몇 초에 걸리면 `useDashboardFeed`와 똑같이 401 한 번이 #247의 인터셉터를
     * 타고 `/auth/refresh`까지 부릅니다. 조건을 한쪽에만 걸어두면 왜 다른지 다음 사람이
     * 되짚어야 해서 같이 맞춥니다.
     */
    enabled: eventStatus === 'ENDED' && isAuthenticated,
    refetchInterval: ({ state }) =>
      state.data?.status === 'GENERATING' ? REPORT_POLL_INTERVAL_MS : false,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateReport(eventCode),
    /*
     * 202 응답이 이미 `GENERATING` 상태의 리포트입니다. 캐시에 바로 꽂아야 위 폴링이 그 자리에서
     * 시작합니다. `invalidateQueries`로도 되지만 방금 받은 답을 한 번 더 물어보게 됩니다.
     */
    onSuccess: (report) => {
      queryClient.setQueryData(reportQueryKey, report);
    },
  });

  /*
   * 공개 여부만 뒤집습니다. 생성 직후 리포트는 비공개라(`isPublic: false`), 공개 페이지가 열리려면
   * 주최자가 한 번 더 눌러야 합니다. 요약을 먼저 읽어보고 내보낼지 정하라는 순서입니다.
   */
  const setPublicMutation = useMutation({
    mutationFn: (isPublic: boolean) => setReportPublic(eventCode, isPublic),
    onSuccess: (report) => {
      queryClient.setQueryData(reportQueryKey, report);
      showToast(report.isPublic ? '리포트를 공개했어요' : '리포트를 비공개로 바꿨어요');
    },
  });

  const report = reportQuery.data ?? null;
  const isPublic = report?.isPublic ?? false;
  const isGenerating = generateMutation.isPending || report?.status === 'GENERATING';
  const isUnknown = eventStatus === 'ENDED' && reportQuery.isPending;

  return {
    /*
     * 본문은 `GENERATED`에서만 채워집니다. 다만 `reportSchema`가 `status`와 `summaryText`를 묶지
     * 않아서 `GENERATED`인데 본문이 비어 오는 응답도 검증을 통과합니다. 그 경우는 화면이
     * 안내문으로 갈라 받습니다.
     */
    summaryText: report?.status === 'GENERATED' ? report.summaryText : null,
    isGenerating,
    isGenerated: report?.status === 'GENERATED',
    isUnknown,
    isPublic,
    generate: () => generateMutation.mutate(),
    isGenerateDisabled: eventStatus !== 'ENDED' || isUnknown || isGenerating,
    togglePublic: () => setPublicMutation.mutate(!isPublic),
    isTogglePublicPending: setPublicMutation.isPending,
    isGenerateError: generateMutation.isError,
    isTogglePublicError: setPublicMutation.isError,
  };
};

export { useEventReport, type EventReportControls };
