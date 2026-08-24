'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { KeywordCard } from '@/components/dashboard/KeywordCard';
import { LiveFeedCard } from '@/components/dashboard/LiveFeedCard';
import {
  MODERATION_ALERT_MIN_COUNT,
  buildTrend,
  countKeywords,
  isNegativeAlerting,
  isPositiveSurging,
  summarizeSentiments,
  toRelativeTime,
} from '@/components/dashboard/metrics';
import { QrCodeDialog } from '@/components/dashboard/QrCodeDialog';
import { ReportSection } from '@/components/dashboard/ReportSection';
import { SentimentTrendCard } from '@/components/dashboard/SentimentTrendCard';
import { SessionFilterBar } from '@/components/dashboard/SessionFilterBar';
import { SessionToggle } from '@/components/dashboard/SessionToggle';
import { Donut } from '@/components/feedback/Donut';
import { Thermometer } from '@/components/feedback/Thermometer';
import { isVisibleEvent } from '@/components/events/eventStatusBadge';
import { ModerationQueue } from '@/components/moderation/ModerationQueue';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Stat } from '@/components/ui/Stat';
import { useCopyLink } from '@/hooks/useCopyLink';
import { useDashboardFeed } from '@/hooks/useDashboardFeed';
import { useEventReport } from '@/hooks/useEventReport';
import { useModerationActions } from '@/hooks/useModerationActions';
import { useSessionControls } from '@/hooks/useSessionControls';
import { showToast } from '@/hooks/useToast';
import { fetchMyEvents, fetchSessionsByEventCode, updateEvent } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import type { Feedback } from '@/lib/schemas/api';

/**
 * 주최자 실시간 모니터링 대시보드입니다.
 *
 * 페이지가 아니라 여기가 화면 전체인 이유는 CLAUDE.md가 대시보드를 CSR로 정해뒀기
 * 때문입니다. 어차피 첫 렌더에 그릴 게 없어서 페이지는 껍데기만 남깁니다.
 *
 * 숫자는 전부 `/admin/feedbacks` 원본에서 이 파일이 셉니다. 서버가 집계해주는 공개
 * 스냅샷을 쓰지 않는 이유는 `hooks/useDashboardFeed.ts`에 적어뒀습니다.
 */

const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';
const CARD_TITLE = 'text-xs font-normal leading-4 text-text-tertiary';

/**
 * 급증 배너를 다시 판정하는 주기입니다.
 *
 * 세 알림 중 급증만 시간이 답을 바꿉니다. 소감이 들어오지 않아도 최근 2분 창이 지나면 거짓이
 * 되어야 하는데, 새 소감이 없으면 폴링이 같은 배열을 돌려주고 화면은 다시 그려지지 않습니다.
 * 그러면 반응이 뚝 끊긴 상황 — 배너가 가장 내려가야 할 때 — 에 오히려 그대로 남습니다.
 * 창(2분)보다 훨씬 짧게 잡아서, 늦어도 이 간격 안에 내려가게 합니다.
 */
const POSITIVE_SURGE_RECHECK_MS = 10_000;

const DashboardView = () => {
  const { eventCode } = useParams<{ eventCode: string }>();

  /** `null`이 "전체"입니다. 시안의 기본 선택값입니다. */
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false);

  const { copy: copyLink, isFailed: isCopyFailed } = useCopyLink();

  /*
   * 공개 조회(`GET /events/{eventCode}`)가 아니라 내 이벤트 목록을 받아 코드로 찾습니다.
   *
   * 공개 조회는 인증을 보지 않아서, 로그인하지 않은 사람이 주소를 직접 쳐도 제목과 세션 칩이
   * 그대로 그려집니다. 소감만 401이 나서 "숫자가 전부 0인 멀쩡한 화면"처럼 보입니다.
   * 남의 이벤트 코드를 넣었을 때도 마찬가지입니다. `/admin/feedbacks`는 내 소감만 거른 뒤
   * eventCode로 다시 걸러서, 교집합이 비면 403이 아니라 빈 배열을 200으로 돌려줍니다.
   *
   * `GET /events`는 인증과 소유권을 서버가 한 번에 봅니다. 못 보는 이벤트면 목록에 아예
   * 없으므로 두 경우 다 화면이 뜨기 전에 걸립니다.
   *
   * 세션 목록에는 이런 대안이 없습니다. API 명세상 세션은 쓰기만 소유자 전용이고 읽기는
   * 공개 한 벌뿐입니다(게스트의 제출 대상 선택과 공용). 그래서 그대로 둡니다.
   */
  const {
    data: events,
    isPending: isEventPending,
    isError: isEventError,
    error: eventError,
  } = useQuery({
    queryKey: ['myEvents'],
    queryFn: fetchMyEvents,
  });

  const {
    data: sessions,
    isPending: isSessionsPending,
    isError: isSessionsError,
  } = useQuery({
    queryKey: ['sessions', eventCode],
    queryFn: () => fetchSessionsByEventCode(eventCode),
  });

  const {
    feedbacks,
    isPending: isFeedPending,
    isError: isFeedError,
    isLive,
  } = useDashboardFeed({ eventCode, sessionId });

  const moderation = useModerationActions();

  const queryClient = useQueryClient();

  /*
   * 이벤트 종료입니다. `useModerationActions`처럼 훅으로 빼지 않고 여기 둡니다. 그쪽은 대시보드와
   * "전체보기" 모달 두 화면이 같은 조치를 써서 문구가 갈라질 수 있었는데, 종료 버튼은 이 화면
   * 하나뿐입니다.
   *
   * 되돌릴 수 없는 전이(`LIVE → ENDED`)라 버튼을 바로 쏘지 않고 `ConfirmDialog`를 한 번 거칩니다.
   */
  const endEventMutation = useMutation({
    mutationFn: () => updateEvent(eventCode, { status: 'ENDED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myEvents'] });
      setIsEndConfirmOpen(false);
      // 다이얼로그를 닫은 뒤에 띄웁니다. 열려 있으면 토스트가 그 뒤에 가립니다(ui/README.md).
      showToast('이벤트를 종료했어요');
    },
    /*
     * 실패해도 닫습니다. 열어두면 아래 실패 배너가 최상위 레이어와 딤 뒤로 밀리는 데다,
     * showModal()이 바깥을 inert로 만들어서 role="alert"조차 읽히지 않습니다.
     */
    onError: () => {
      setIsEndConfirmOpen(false);
    },
  });

  /*
   * 리포트입니다. 이벤트 상태를 아래 `event`가 아니라 목록에서 다시 꺼내는 이유는, `event`가
   * early return 뒤에서 계산돼 훅 자리에서는 아직 없기 때문입니다.
   */
  const eventStatus = events?.find((item) => item.code === eventCode)?.status;

  /* 조회·생성·공개 전환이 같은 캐시 칸을 두고 움직여서 한 훅으로 묶여 있습니다. */
  const report = useEventReport(eventCode, eventStatus);

  /* 뒤집기와 「이 화면에서 멈춘 세션인가」 판정이 한 덩어리라 훅으로 묶여 있습니다. */
  const sessionControls = useSessionControls(eventCode);

  /*
   * 소감에서 뽑는 값들입니다. 정작 그리는 자리는 한참 아래지만 계산은 여기서 합니다.
   * 바로 아래 알림 훅이 이 값을 봐야 하는데, 훅은 early return 뒤로 내려갈 수 없습니다.
   */
  const items = feedbacks ?? [];

  /*
   * 숨긴 건은 집계와 피드에서 뺍니다. 목록을 `includeHidden=true`로 받는 건 모더레이션
   * 큐가 이미 숨긴 건도 보여줘야 해서지, 숫자에 넣으려는 게 아닙니다.
   * 독성 건수만 예외입니다(아래 참고).
   */
  const visible = items.filter((feedback) => feedback.status === 'VISIBLE');

  const { positive, neutral, negative, unclassified, classified, positiveRate, negativeRate } =
    summarizeSentiments(visible);

  /*
   * 독성 건수만 `visible`이 아니라 전체를 셉니다. 독성 소감은 제출 시점에
   * 이미 HIDDEN으로 저장되므로 `visible`에는 한 건도 남지 않습니다.
   * 이건 감정 집계가 아니라 모더레이션 지표라서, 숨겼어도 몇 건 들어왔는지는
   * 주최자에게 보여야 합니다. `visible` 기준으로 되돌리지 마세요.
   */
  const toxicCount = items.filter((feedback) => feedback.toxic).length;

  /*
   * 여기부터 주최자 실시간 알림입니다(#253). 무엇이 알림감인지는 `metrics.ts`가 정하고,
   * 화면은 그 판정을 그리기만 합니다.
   *
   * 셋 다 조건이 참인 동안 떠 있는 배너입니다. 처음에는 급증과 독성을 지나가는 사건으로 보고
   * 토스트로 띄웠는데, 4초 만에 사라져서 화면을 보고 있는 사람도 놓쳤습니다. 배너로 옮기니
   * 알림을 언제 한 번만 띄울지 정할 일이 없어져서, 발화 시각과 이미 알린 단계를 들고 있던
   * 상태도 함께 사라졌습니다.
   *
   * 셋 중 부정 비율만 여기에 상태로 남습니다. 켜지는 선과 꺼지는 선이 달라서 지금 떠 있는지를
   * 알아야 다음 판정을 할 수 있기 때문입니다. 나머지 둘은 지금 목록만 보면 답이 나옵니다.
   */
  const [isNegativeHeavy, setIsNegativeHeavy] = useState(false);

  /**
   * 긍정 급증입니다. 지금 목록만 보면 답이 나오는데도 상태로 두는 이유는 위
   * `POSITIVE_SURGE_RECHECK_MS` 주석에 적어뒀습니다. 시각이 답을 바꾸는 유일한 판정이라
   * 렌더에서 바로 부르면 소감이 끊긴 순간부터 영영 갱신되지 않습니다.
   */
  const [isPositiveSurge, setIsPositiveSurge] = useState(false);

  /** 지금 잡아둔 판정이 어느 세션 것인지입니다. 필터가 바뀌면 여기서 알아챕니다. */
  const alertScopeRef = useRef(sessionId);

  /*
   * 부정 비율 판정입니다. 켜지는 선과 꺼지는 선이 달라서 직전 상태를 판정에 넘깁니다.
   * updater로 넘기면 그 값을 deps에 넣지 않아도 됩니다. 넣으면 자기가 자기를 다시 부릅니다.
   *
   * 세션 전환을 여기서 같이 봅니다. 전환을 따로 훅으로 빼면 세션이 하나뿐인 이벤트에서
   * "전체"와 그 세션을 오갈 때 구멍이 납니다. 두 목록이 같은 내용이라 아래 deps가 그대로여서
   * 이 훅이 돌지 않는데, 리셋만 먼저 적용돼 배너가 사라진 채 돌아오지 않습니다. `sessionId`를
   * deps에 넣고 전환 여부를 직접 보면 그 경우에도 반드시 다시 판정합니다.
   */
  useEffect(() => {
    const isScopeChanged = alertScopeRef.current !== sessionId;
    if (isScopeChanged) alertScopeRef.current = sessionId;

    if (eventStatus !== 'LIVE') {
      /*
       * `react-hooks/set-state-in-effect`를 끕니다. 룰이 막으려는 건 렌더가 꼬리를 무는
       * 상황인데, 여기서는 이벤트가 `LIVE`를 벗어나는 한 번뿐이고 그 뒤로는 조건이 계속
       * 거짓이라 다시 돌지 않습니다. 렌더로 옮길 수도 없습니다 — 아래 판정이 직전 상태를
       * 봐야 해서 렌더에서 읽으면 자기가 만든 값을 다시 읽게 됩니다.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsNegativeHeavy(false);
      return;
    }

    setIsNegativeHeavy((wasAlerting) =>
      isNegativeAlerting({
        negativeRate,
        classified,
        /* 다른 세션에서 켜둔 것을 물려받으면 안 됩니다. 새 모집단에서 처음부터 판정합니다. */
        wasAlerting: isScopeChanged ? false : wasAlerting,
      }),
    );
  }, [negativeRate, classified, eventStatus, sessionId]);

  /*
   * 급증 판정입니다. 목록이 바뀔 때 한 번 보고, 그 뒤로는 타이머가 같은 판정을 반복합니다.
   *
   * `visible`을 deps에 넣지 않고 여기서 다시 거릅니다. 저쪽은 렌더마다 새로 만들어지는
   * 배열이라 넣으면 데이터가 그대로여도 이 훅이 매번 다시 돌고 타이머도 매번 새로 섭니다.
   *
   * 타이머는 목록이 바뀌면 정리되고 다시 섭니다. 소감이 계속 들어오는 동안에는 폴링이
   * 판정을 갱신해주므로 타이머가 발동할 일이 없고, 끊긴 뒤에야 제 몫을 합니다.
   */
  useEffect(() => {
    if (eventStatus !== 'LIVE') {
      // 위 부정 배너와 같은 이유입니다. `LIVE`를 벗어나는 한 번으로 끝납니다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPositiveSurge(false);
      return;
    }

    const judge = () => {
      const visibleNow = items.filter((feedback) => feedback.status === 'VISIBLE');
      setIsPositiveSurge(isPositiveSurging(visibleNow, Date.now()));
    };

    judge();

    const timer = setInterval(judge, POSITIVE_SURGE_RECHECK_MS);
    return () => clearInterval(timer);
  }, [items, eventStatus]);

  const handleSelectSession = (nextSessionId: number | null) => {
    setSessionId(nextSessionId);
  };

  /*
   * 미인증만 사유를 나눕니다. 주최자 전용 화면이라 "잠시 실패했다"와 "애초에 볼 자격이 없다"는
   * 다음 행동이 달라서, 하나로 뭉치면 로그인하면 되는 사람이 새로고침만 반복하게 됩니다.
   *
   * 로그인 화면으로 보내는 일까지는 하지 않습니다. host 화면 전체에 걸리는 라우트 가드가
   * 아직 없고, 어디에 둘지는 이 화면 혼자 정할 문제가 아닙니다.
   */
  const isUnauthorized = eventError instanceof ApiError && eventError.code === 'UNAUTHORIZED';

  if (isEventError) {
    return (
      <Banner type="negative">
        {isUnauthorized ? '로그인이 필요한 화면이에요' : '이벤트 정보를 불러올 수 없어요'}
      </Banner>
    );
  }

  if (isEventPending) {
    return <DashboardSkeleton />;
  }

  /*
   * 목록에 없는 코드는 없는 이벤트이거나 남의 이벤트입니다. 주최자에게는 둘 다 "볼 수 없다"로
   * 같아서 문구를 나누지 않습니다. 나누면 코드를 하나씩 넣어보며 남의 이벤트가 실재하는지
   * 알아낼 수 있습니다.
   */
  const found = events.find((item) => item.code === eventCode) ?? null;

  /*
   * `DELETED`도 "볼 수 없다"로 접습니다. 목록 응답에서 이미 빠지는 상태라 실제로는 오지
   * 않지만, 여기서 좁혀야 아래 상태 배지 표(`EVENT_STATUS_BADGE`)가 DELETED 없는 키로
   * 안전하게 인덱싱됩니다.
   */
  const event = found !== null && isVisibleEvent(found) ? found : null;

  if (event === null) {
    return <Banner type="negative">이 이벤트를 볼 수 없어요</Banner>;
  }

  /*
   * 세션 판정을 이벤트 뒤로 미룹니다. 세션 목록은 공개 엔드포인트라 없는 코드에 404를 내는데,
   * 먼저 보면 "볼 수 없는 이벤트"가 전부 "불러올 수 없어요"로 뭉개집니다. 여기까지 왔다면
   * 이벤트는 실재하고 내 것이므로, 이 실패는 진짜 서버 문제입니다.
   */
  if (isSessionsError) {
    return <Banner type="negative">이벤트 정보를 불러올 수 없어요</Banner>;
  }

  if (isSessionsPending) {
    return <DashboardSkeleton />;
  }

  /*
   * 참가자가 QR을 찍거나 링크를 눌러 들어오는 주소입니다. 배포 도메인을 환경 변수로 들고 있지
   * 않아서 지금 출처를 알 방법은 브라우저가 열고 있는 주소뿐입니다.
   *
   * 여기서 `window`를 읽어도 되는 이유는, 서버 렌더에서는 이 줄까지 오지 않기 때문입니다.
   * 쿼리를 미리 채워두는 곳이 없어서 서버에서는 `isEventPending`이 항상 참이고, 위 스켈레톤에서
   * 끊깁니다. 컴포넌트 맨 위로 올리면 그 보호가 사라지므로 옮기지 마세요.
   */
  const publicUrl = `${window.location.origin}/e/${event.code}`;

  /* 성공을 확인했을 때만 알립니다. 실패는 아래 배너가 받습니다. */
  const handleCopyLink = async () => {
    if (await copyLink(publicUrl)) showToast('링크가 복사되었어요');
  };

  /*
   * 모더레이션 큐가 받는 목록입니다. 자동 판정된 독성 소감에 더해, 주최자가 실시간 피드에서
   * 직접 숨긴 소감도 넣습니다(#170).
   *
   * 숨김 조건을 빼면 안 됩니다. 자동 판정은 욕설만 잡아서 인신공격 같은 건 사람이 골라야
   * 하는데, 숨긴 소감은 `visible`에서 빠지므로 큐에도 안 들어오면 화면 어디에도 남지
   * 않습니다. 되돌릴 수도 삭제할 수도 없는 소감이 생깁니다.
   *
   * `DELETED`는 여기까지 오지 않습니다. `/admin/feedbacks`가 `includeHidden`과 무관하게
   * 항상 빼고 내려줍니다.
   */
  const queueItems = items.filter((feedback) => feedback.toxic || feedback.status === 'HIDDEN');

  /*
   * 큐 알림입니다. 위 `queueItems`를 그대로 세기 때문에 배너 숫자와 큐 배지 숫자가 어긋나지
   * 않고, 주최자가 큐를 비우면 배너도 함께 내려갑니다. 나머지 둘과 달리 시각도 이력도 보지
   * 않아서 여기서 바로 판정합니다.
   *
   * `LIVE`에서만 내놓는 것은 세 알림이 같습니다. 끝난 이벤트에는 지금 대응할 일이 없고,
   * 시작 전에는 소감이 들어오지 않습니다.
   */
  const isQueueHeavy = event.status === 'LIVE' && queueItems.length >= MODERATION_ALERT_MIN_COUNT;

  const trend = buildTrend(visible);
  const keywords = countKeywords(visible);

  const sessionTitle = (feedbackSessionId: number) =>
    sessions.find((session) => session.id === feedbackSessionId)?.title ?? '삭제된 세션';

  const toMeta = (feedback: Feedback) =>
    `${toRelativeTime(feedback.createdAt)} · ${sessionTitle(feedback.sessionId)}`;

  /* 칩에서 고른 세션입니다. "전체"(`null`)에는 켜고 끌 대상이 없어 아래 토글을 감춥니다. */
  const selectedSession =
    sessionId === null ? null : (sessions.find((session) => session.id === sessionId) ?? null);

  /*
   * 세션 토글은 데스크톱에선 헤더 안, 모바일에선 칩 줄 아래에 섭니다. 부모가 달라 CSS로는 옮길
   * 수 없어서 자리마다 하나씩 두고 `className`으로 감춥니다. 조건과 넘기는 값이 같으므로
   * 여기서 한 번만 만듭니다.
   *
   * `LIVE`에서만 내놓습니다. 제출은 이벤트가 `LIVE`이고 세션이 `ACTIVE`여야 통과하는데,
   * 시작 전이나 끝난 뒤에 세션만 열어두면 화면은 "소감 받는 중"이라고 하고 참가자는
   * `EVENT_NOT_LIVE`로 막히는 거짓말이 됩니다.
   */
  const renderSessionToggle = (className: string) => {
    if (event.status !== 'LIVE') return null;

    /*
     * "전체"에는 켜고 끌 대상이 없지만 자리는 남겨둡니다. 비워두면 칩을 오갈 때마다 토글
     * 한 줄이 통째로 생겼다 사라지면서, 데스크톱은 헤더가 접혀 아래 카드가 전부 밀리고
     * 모바일은 칩 줄 높이가 바뀝니다.
     *
     * `h-9`는 토글의 높이입니다 — 안에서 가장 큰 게 `size="sm"` 버튼이라 그 높이가 그대로
     * 줄 높이가 됩니다. 배지(`h-6`)는 가운데 정렬돼서 높이를 정하지 않습니다.
     *
     * `LIVE`가 아닐 때는 위에서 이미 빠져나갔습니다. 그 상태에서는 토글이 영영 나오지
     * 않으므로 자리를 잡아봐야 빈 공간만 남습니다.
     */
    if (selectedSession === null) return <div className={`h-9 ${className}`} aria-hidden />;

    return (
      <SessionToggle
        session={selectedSession}
        isPaused={sessionControls.isPaused(selectedSession.id)}
        isPending={sessionControls.isPending}
        onToggle={(status) => sessionControls.toggle(selectedSession.id, status)}
        className={className}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <DashboardHeader
        event={event}
        publicUrl={publicUrl}
        report={report}
        sessionToggle={renderSessionToggle('hidden md:flex')}
        onOpenQr={() => setIsQrOpen(true)}
        onCopyLink={handleCopyLink}
        onEndEvent={() => setIsEndConfirmOpen(true)}
        isEndEventPending={endEventMutation.isPending}
      />

      <SessionFilterBar
        sessions={sessions}
        selectedSessionId={sessionId}
        onSelectSession={handleSelectSession}
        sessionToggle={renderSessionToggle('flex w-full justify-between md:hidden')}
      />

      {isFeedError && <Banner type="negative">지금은 소감을 불러올 수 없어요</Banner>}
      {moderation.isError && <Banner type="negative">소감 처리에 실패했어요</Banner>}
      {endEventMutation.isError && <Banner type="negative">이벤트를 종료하지 못했어요</Banner>}
      {report.isGenerateError && <Banner type="negative">요약 리포트를 만들지 못했어요</Banner>}
      {report.isTogglePublicError && (
        <Banner type="negative">리포트 공개 설정을 바꾸지 못했어요</Banner>
      )}
      {sessionControls.isError && (
        <Banner type="negative">세션의 소감 수신 상태를 바꾸지 못했어요</Banner>
      )}
      {isCopyFailed && (
        <Banner type="negative">링크를 복사하지 못했어요. 위 주소를 직접 복사해주세요</Banner>
      )}

      {isFeedPending ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/*
           * 실패 배너들과 떨어뜨려 통계 바로 위에 둡니다. 이건 고장이 아니라 지금 화면이
           * 보여주는 숫자에 대한 경고라, 그 숫자 옆에 있어야 읽힙니다.
           *
           * 손이 가야 하는 순서로 세웁니다. 분위기가 꺾인 것과 큐가 밀린 것은 지금 대응할
           * 일이고, 긍정 급증은 알아두면 좋은 소식이라 `info`로 맨 아래 섭니다.
           */}
          {isNegativeHeavy && (
            <Banner type="warning">부정 반응이 {negativeRate}%까지 올라갔어요</Banner>
          )}
          {isQueueHeavy && (
            <Banner type="warning">처리할 소감이 {queueItems.length}건 쌓였어요</Banner>
          )}
          {isPositiveSurge && <Banner type="info">긍정 반응이 늘고 있어요</Banner>}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="총 소감" value={`${visible.length}`} />
            <Stat label="긍정 비율" value={`${positiveRate}%`} tone="positive" />
            <Stat label="독성 플래그" value={`${toxicCount}`} tone="toxic" />
            <Stat label="미분류" value={`${unclassified}`} tone="muted" />
          </div>

          <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
            <section className={CARD}>
              <h2 className={CARD_TITLE}>감정 분포</h2>
              <Donut
                positive={positive}
                neutral={neutral}
                negative={negative}
                className="py-2 hidden md:flex"
              />
              <Thermometer
                positive={positive}
                neutral={neutral}
                negative={negative}
                className="py-2 md:hidden"
              />
            </section>

            <SentimentTrendCard
              trend={trend}
              positive={positive}
              neutral={neutral}
              negative={negative}
              isLive={isLive}
            />
          </div>

          {/*
           * 목록 카드 둘만 나란히 둡니다. 상위 키워드를 오른쪽 열에 같이 넣으면 그 열 높이가
           * `h-80` + 키워드 카드가 되는데, 키워드 카드는 배지가 늘거나 카운트가 한 자리
           * 넓어질 때마다 줄 수가 바뀝니다. 그러면 왼쪽 피드의 스크롤 높이가 읽는 도중에
           * 흔들립니다. 아래 한 줄로 빼면 자기 줄에서 늘어나도 아무것도 밀지 않습니다(#216).
           *
           * 모바일에서는 둘을 뒤집어 모더레이션 큐를 위에 둡니다. 1열로 쌓이면 먼저 눈에
           * 닿는 자리가 위인데, 손이 가야 하는 건 큐 쪽입니다. `md`부터는 `display`가
           * grid로 바뀌면서 `flex-direction`이 무시돼 DOM 순서대로 피드가 왼쪽에 섭니다.
           */}
          <div className="flex flex-col-reverse gap-3 md:grid md:grid-cols-2">
            <LiveFeedCard items={visible} formatMeta={toMeta} actions={moderation} />

            <ModerationQueue items={queueItems} formatMeta={toMeta} actions={moderation} />
          </div>

          <KeywordCard keywords={keywords} />

          <ReportSection report={report} />
        </>
      )}

      <QrCodeDialog open={isQrOpen} url={publicUrl} onClose={() => setIsQrOpen(false)} />

      <ConfirmDialog
        open={isEndConfirmOpen}
        title="이벤트를 종료할까요?"
        description="종료하면 참가자가 더 이상 소감을 남길 수 없고, 되돌릴 수 없어요"
        onClose={() => setIsEndConfirmOpen(false)}
        actions={
          <>
            {/* 취소가 먼저입니다. `showModal()`이 첫 포커스 가능 요소를 잡습니다. */}
            <Button variant="secondary" onClick={() => setIsEndConfirmOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={endEventMutation.isPending}
              onClick={() => endEventMutation.mutate()}
            >
              종료
            </Button>
          </>
        }
      />
    </div>
  );
};

export { DashboardView };
