'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import {
  buildTrend,
  countKeywords,
  summarizeSentiments,
  toRelativeTime,
} from '@/components/dashboard/metrics';
import { QrCodeDialog } from '@/components/dashboard/QrCodeDialog';
import { SentimentTrendCard } from '@/components/dashboard/SentimentTrendCard';
import { SessionToggle } from '@/components/dashboard/SessionToggle';
import { Donut } from '@/components/feedback/Donut';
import { FEED_SENTIMENT, FeedItem } from '@/components/feedback/FeedItem';
import { Thermometer } from '@/components/feedback/Thermometer';
import { isVisibleEvent } from '@/components/events/eventStatusBadge';
import { ModerationQueue } from '@/components/moderation/ModerationQueue';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Stat } from '@/components/ui/Stat';
import { useCopyLink } from '@/hooks/useCopyLink';
import { useDashboardFeed } from '@/hooks/useDashboardFeed';
import { useEventReport } from '@/hooks/useEventReport';
import { useModerationActions } from '@/hooks/useModerationActions';
import { showToast } from '@/hooks/useToast';
import {
  fetchMyEvents,
  fetchSessionsByEventCode,
  updateEvent,
  updateSession,
} from '@/lib/api/endpoints';
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

const DashboardView = () => {
  const { eventCode } = useParams<{ eventCode: string }>();

  /** `null`이 "전체"입니다. 시안의 기본 선택값입니다. */
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false);

  /*
   * 이 화면에서 멈춘 세션입니다. 세션은 생성 시 `CLOSED`라(2026-08-07 명세) 상태만으로는 "아직
   * 열지 않았다"와 "열었다가 멈췄다"를 가를 수 없는데, 버튼이 권하는 다음 행동은 그 둘이 다릅니다.
   *
   * `SessionView`에는 열린 적이 있는지 알려주는 필드가 없어서 화면이 직접 기억합니다. 새로고침하면
   * 잊고 다른 기기에서 멈춘 것도 모릅니다 — 정확히 하려면 서버에 흔적이 필요합니다(#143).
   */
  const [pausedSessionIds, setPausedSessionIds] = useState<ReadonlySet<number>>(new Set());

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
    refreshIntervalMs,
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

  /*
   * 선택한 세션의 소감 수신을 켜고 끕니다. 세션은 생성 시 `CLOSED`라, 발표가 시작될 때 주최자가
   * 열어야 소감이 들어옵니다(2026-08-07 명세).
   *
   * 이벤트 종료와 달리 확인 다이얼로그를 두지 않습니다. `ACTIVE ↔ CLOSED`는 되돌릴 수 있어서
   * 잘못 눌러도 다시 누르면 그만입니다.
   */
  const toggleSessionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'ACTIVE' | 'CLOSED' }) =>
      updateSession(eventCode, id, { status }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', eventCode] });
      /* 다시 열면 지웁니다. 남겨두면 멈췄다 연 세션을 또 멈출 때가 아니라 처음 열 때부터 "다시"가 됩니다. */
      setPausedSessionIds((previous) => {
        const next = new Set(previous);
        if (session.status === 'ACTIVE') next.delete(session.id);
        else next.add(session.id);
        return next;
      });
      showToast(session.status === 'ACTIVE' ? '이제 소감을 받아요' : '소감 받기를 멈췄어요');
    },
  });

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

  const openSessionCount = sessions.filter((session) => session.status === 'ACTIVE').length;

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

  const items = feedbacks ?? [];

  /*
   * 숨긴 건은 집계와 피드에서 뺍니다. 목록을 `includeHidden=true`로 받는 건 모더레이션
   * 큐가 이미 숨긴 건도 보여줘야 해서지, 숫자에 넣으려는 게 아닙니다.
   * 독성 건수만 예외입니다(아래 참고).
   */
  const visible = items.filter((feedback) => feedback.status === 'VISIBLE');

  const { positive, neutral, negative, unclassified, positiveRate } = summarizeSentiments(visible);

  /*
   * 독성 건수만 `visible`이 아니라 전체를 셉니다. 독성 소감은 제출 시점에
   * 이미 HIDDEN으로 저장되므로 `visible`에는 한 건도 남지 않습니다.
   * 이건 감정 집계가 아니라 모더레이션 지표라서, 숨겼어도 몇 건 들어왔는지는
   * 주최자에게 보여야 합니다. `visible` 기준으로 되돌리지 마세요.
   */
  const toxicCount = items.filter((feedback) => feedback.toxic).length;

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

  const trend = buildTrend(visible);
  const keywords = countKeywords(visible);

  const sessionTitle = (feedbackSessionId: number) =>
    sessions.find((session) => session.id === feedbackSessionId)?.title ?? '삭제된 세션';

  const toMeta = (feedback: Feedback) =>
    `${toRelativeTime(feedback.createdAt)} · ${sessionTitle(feedback.sessionId)}`;

  /*
   * 리포트 카드의 상태 배지입니다. 모바일에선 제목 옆, 데스크톱에선 오른쪽 조치 자리에
   * 서는데 부모가 달라 CSS로는 옮길 수 없습니다. 두 자리에 같은 것을 두고 감싸는 span으로
   * 하나씩 감추므로, 본문은 여기서 한 번만 만듭니다.
   */
  const reportBadge = report.isGenerating ? (
    <Badge tone="neutral">생성 중</Badge>
  ) : report.isGenerated ? (
    <Badge tone="positive">생성 완료</Badge>
  ) : null;

  /* 칩에서 고른 세션입니다. "전체"(`null`)에는 켜고 끌 대상이 없어 아래 토글을 감춥니다. */
  const selectedSession =
    sessionId === null ? null : (sessions.find((session) => session.id === sessionId) ?? null);

  /* 같은 `CLOSED`라도 이 화면에서 멈춘 세션은 "다시", 아직 안 연 세션은 "처음"입니다. */
  const isSelectedSessionPaused =
    selectedSession !== null && pausedSessionIds.has(selectedSession.id);

  /*
   * 세션 토글은 데스크톱에선 헤더 안, 모바일에선 칩 줄 아래에 섭니다. 부모가 달라 CSS로는 옮길
   * 수 없어서 자리마다 하나씩 두고 `className`으로 감춥니다. 조건과 넘기는 값이 같으므로
   * 여기서 한 번만 만듭니다.
   *
   * `LIVE`에서만 내놓습니다. 제출은 이벤트가 `LIVE`이고 세션이 `ACTIVE`여야 통과하는데,
   * 시작 전이나 끝난 뒤에 세션만 열어두면 화면은 "소감 받는 중"이라고 하고 참가자는
   * `EVENT_NOT_LIVE`로 막히는 거짓말이 됩니다.
   */
  const renderSessionToggle = (className: string) =>
    event.status === 'LIVE' && selectedSession !== null ? (
      <SessionToggle
        session={selectedSession}
        isPaused={isSelectedSessionPaused}
        isPending={toggleSessionMutation.isPending}
        onToggle={(status) => toggleSessionMutation.mutate({ id: selectedSession.id, status })}
        className={className}
      />
    ) : null;

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

      <div className="flex flex-wrap items-center gap-2">
        <Chip selected={sessionId === null} onClick={() => handleSelectSession(null)}>
          전체
        </Chip>
        {sessions.map((session) => (
          <Chip
            key={session.id}
            selected={sessionId === session.id}
            onClick={() => handleSelectSession(session.id)}
          >
            {session.title}
          </Chip>
        ))}
        <span className="ml-auto text-xs font-normal leading-4 text-text-tertiary">
          총 {sessions.length}개 중 {openSessionCount}개 열림
        </span>
        {renderSessionToggle('flex w-full justify-between md:hidden')}
      </div>

      {isFeedError && <Banner type="negative">지금은 소감을 불러올 수 없어요</Banner>}
      {moderation.isError && <Banner type="negative">소감 처리에 실패했어요</Banner>}
      {endEventMutation.isError && <Banner type="negative">이벤트를 종료하지 못했어요</Banner>}
      {report.isGenerateError && <Banner type="negative">요약 리포트를 만들지 못했어요</Banner>}
      {report.isTogglePublicError && (
        <Banner type="negative">리포트 공개 설정을 바꾸지 못했어요</Banner>
      )}
      {toggleSessionMutation.isError && (
        <Banner type="negative">세션의 소감 수신 상태를 바꾸지 못했어요</Banner>
      )}
      {isCopyFailed && (
        <Banner type="negative">링크를 복사하지 못했어요. 위 주소를 직접 복사해주세요</Banner>
      )}

      {isFeedPending ? (
        <DashboardSkeleton />
      ) : (
        <>
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
              refreshIntervalMs={refreshIntervalMs}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className={CARD}>
              <h2 className={CARD_TITLE}>실시간 소감 피드</h2>

              {/* 모더레이션 큐와 같은 이유로 높이를 고정합니다(`ModerationQueue.tsx`). */}
              {visible.length === 0 ? (
                <EmptyState
                  className="h-80 justify-center"
                  title="아직 들어온 소감이 없어요"
                  description="참가자가 소감을 남기면 여기에 바로 올라와요"
                />
              ) : (
                <ul className="flex h-80 flex-col gap-2 overflow-y-auto">
                  {visible.map((feedback) => (
                    <li key={feedback.id}>
                      <FeedItem
                        state="normal"
                        sentiment={FEED_SENTIMENT[feedback.sentiment]}
                        meta={toMeta(feedback)}
                        content={feedback.text}
                        /*
                         * 자동 판정이 잡는 건 욕설뿐이라, 인신공격처럼 판정을 빠져나간 소감은
                         * 주최자가 여기서 직접 내려야 합니다(#170).
                         *
                         * 삭제는 달지 않습니다. `DELETED`는 되돌릴 수 없는 종단 상태라 실시간으로
                         * 흘러가는 목록에서 바로 누르게 둘 자리가 아닙니다. 숨기면 모더레이션
                         * 큐로 넘어가서, 거기서 다시 보고 삭제하거나 되돌립니다.
                         */
                        actions={
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={moderation.isItemPending(feedback.id)}
                            onClick={() => moderation.toggleHidden(feedback)}
                          >
                            숨기기
                          </Button>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex flex-col gap-3">
              <ModerationQueue items={queueItems} formatMeta={toMeta} actions={moderation} />

              <section className={CARD}>
                <h2 className={CARD_TITLE}>상위 키워드</h2>

                {keywords.length === 0 ? (
                  <p className="text-sm text-text-tertiary">아직 모인 키워드가 없어요</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {keywords.map(([keyword, count]) => (
                      <li key={keyword}>
                        <Badge tone="outline">
                          {keyword} {count}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          {/*
           * 카드 아래 한 줄이 상태에 따라 다른 일을 합니다. 생성 전에는 왜 눌러야 하는지 알리는
           * 안내문이고, 끝나면 요약 본문이 그 자리에 들어옵니다. 자리를 나누지 않는 이유는
           * 안내문이 요약이 없을 때만 필요한 문장이라서입니다.
           *
           * 생성이 끝났는데 본문이 비어 있는 경우를 따로 받습니다. 여기서 "생성하시면…"으로
           * 되돌리면 오른쪽 버튼은 이미 빠진 뒤라(`report.isGenerated`) 시키는 대로 할 수단이
           * 없습니다. `GENERATING` 문구로 묶지 않는 것도 같은 이유입니다 — 폴링이 `GENERATED`에서
           * 멈춰서(위 `refetchInterval`) 기다려도 아무것도 다시 오지 않습니다.
           */}
          <section
            className={`${CARD} flex-col items-start justify-between gap-4 bg-background-muted md:flex-row`}
          >
            <div className="flex w-full flex-col gap-1 md:w-auto">
              {/* 배지를 오른쪽 끝에 붙이려면 이 열이 폭을 다 써야 합니다(`w-full`). */}
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold leading-6 text-text-primary">
                  AI 요약 리포트
                </h2>
                {reportBadge && <span className="md:hidden">{reportBadge}</span>}
              </div>

              {report.summaryText !== null ? (
                <p className="text-sm font-normal leading-5 text-text-secondary">
                  {report.summaryText}
                </p>
              ) : (
                <p className="text-xs font-normal leading-4 text-text-tertiary">
                  {report.isGenerating
                    ? '요약을 만들고 있어요. 끝나면 여기에 올라와요'
                    : report.isGenerated
                      ? '요약 본문을 받지 못했어요. 잠시 후 다시 열어봐 주세요'
                      : '생성하시면 읽어보고 공개할 수 있어요'}
                </p>
              )}
            </div>

            {/*
             * 오른쪽은 이 카드의 상태와 조치가 함께 서는 자리입니다. 상태 배지를 제목이 아니라
             * 여기 두는 이유는, 다 만들고 나면 버튼이 빠져서 이 자리가 비기 때문입니다.
             *
             * 모바일에서는 카드가 세로로 서면서 이 자리가 제목에서 멀어지므로, 배지만 제목 옆으로
             * 올립니다(`reportBadge`). 그러면 생성 완료 상태의 모바일에서는 배지도 버튼도 없어
             * 이 자리가 통째로 비므로 아예 감춥니다 — 안 그러면 section의 `gap-4`만 남습니다.
             */}
            <div
              className={`flex w-full shrink-0 items-center gap-2 md:w-auto ${
                report.isGenerated ? 'hidden md:flex' : ''
              }`}
            >
              {reportBadge && <span className="hidden md:contents">{reportBadge}</span>}

              {/* 다 만든 리포트에는 다시 만들 길이 없습니다(재생성은 REPORT_ALREADY_EXISTS). */}
              {!report.isGenerated && (
                <Button
                  className="flex-1 md:flex-none"
                  variant="primary"
                  disabled={event.status !== 'ENDED' || report.isUnknown || report.isGenerating}
                  onClick={report.generate}
                >
                  요약 생성
                </Button>
              )}
            </div>
          </section>
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
