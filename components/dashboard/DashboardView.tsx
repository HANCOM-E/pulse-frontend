'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import {
  buildTrend,
  countKeywords,
  summarizeSentiments,
  toRelativeTime,
  TREND_BUCKET_MS,
} from '@/components/dashboard/metrics';
import { QrCodeDialog } from '@/components/dashboard/QrCodeDialog';
import { Donut } from '@/components/feedback/Donut';
import { FeedItem, type Sentiment as FeedItemSentiment } from '@/components/feedback/FeedItem';
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
import { useModerationActions } from '@/hooks/useModerationActions';
import { showToast } from '@/hooks/useToast';
import {
  fetchMyEvents,
  fetchOwnReport,
  fetchSessionsByEventCode,
  generateReport,
  updateEvent,
} from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import type { Feedback, Sentiment } from '@/lib/schemas/api';

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
 * 리포트가 만들어지는 동안만 쓰는 간격입니다. 소감 폴링(5초)보다 짧은 이유는, 이쪽은 버튼을
 * 누른 사람이 결과를 기다리며 보고 있는 화면이라서입니다. 끝나는 즉시 타이머를 멈춥니다.
 */
const REPORT_POLL_INTERVAL_MS = 1_500;

const FEED_SENTIMENT: Record<Sentiment, FeedItemSentiment> = {
  POS: 'positive',
  NEU: 'neutral',
  NEG: 'negative',
  UNKNOWN: 'none',
};

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
    // 생성 자체가 `ENDED`에서만 가능해서, 그 전에는 물어볼 이유가 없습니다.
    enabled: eventStatus === 'ENDED',
    refetchInterval: ({ state }) =>
      state.data?.status === 'GENERATING' ? REPORT_POLL_INTERVAL_MS : false,
  });

  const generateReportMutation = useMutation({
    mutationFn: () => generateReport(eventCode),
    /*
     * 202 응답이 이미 `GENERATING` 상태의 리포트입니다. 캐시에 바로 꽂아야 위 폴링이 그 자리에서
     * 시작합니다. `invalidateQueries`로도 되지만 방금 받은 답을 한 번 더 물어보게 됩니다.
     */
    onSuccess: (report) => {
      queryClient.setQueryData(reportQueryKey, report);
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
  const event = events.find((item) => item.code === eventCode) ?? null;

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
   */
  const visible = items.filter((feedback) => feedback.status === 'VISIBLE');

  const { positive, neutral, negative, unclassified, positiveRate } = summarizeSentiments(visible);

  const toxicItems = items.filter((feedback) => feedback.toxic);
  const toxicCount = visible.filter((feedback) => feedback.toxic).length;

  const trend = buildTrend(visible);
  const keywords = countKeywords(visible);

  const sessionTitle = (feedbackSessionId: number) =>
    sessions.find((session) => session.id === feedbackSessionId)?.title ?? '삭제된 세션';

  const toMeta = (feedback: Feedback) =>
    `${toRelativeTime(feedback.createdAt)} · ${sessionTitle(feedback.sessionId)}`;

  const report = reportQuery.data ?? null;

  /*
   * 요청을 보낸 순간부터 "생성 중"입니다. 202가 돌아오기를 기다리는 동안에도 버튼은 이미
   * 눌렸으므로, 서버 응답이 오기 전 빈 구간을 mutation의 대기 상태가 메웁니다.
   */
  const isReportGenerating = generateReportMutation.isPending || report?.status === 'GENERATING';
  const isReportGenerated = report?.status === 'GENERATED';

  /* 본문은 `GENERATED`에서만 채워집니다(스키마상 그 전에는 전부 null입니다). */
  const summaryText = report?.status === 'GENERATED' ? report.summaryText : null;

  /* 상태를 모르는 동안은 잠급니다. 이미 리포트가 있는 이벤트에서 눌리면 REPORT_ALREADY_EXISTS만 받습니다. */
  const isReportUnknown = event.status === 'ENDED' && reportQuery.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* 제목과 상태는 붙어 있어야 해서 바깥 `gap-4`에서 빼고 따로 묶습니다. */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold leading-7 text-text-primary">{event.title}</h1>
            <Badge tone={event.status === 'LIVE' ? 'positive' : 'neutral'}>{event.status}</Badge>
          </div>
          {/* 복사되는 값과 같은 것을 보여줍니다. 다르면 눈으로 옮겨 적는 사람이 틀립니다. */}
          <p className="text-xs font-normal leading-4 break-all text-text-tertiary">{publicUrl}</p>
        </div>

        {/*
         * QR과 이벤트 종료는 `LIVE`에서만 내놓습니다.
         *
         * 종료는 서버가 허용하는 전이가 `DRAFT → LIVE`와 `LIVE → ENDED` 둘뿐이라, 그 밖에서
         * 누르면 INVALID_EVENT_STATE_TRANSITION만 받습니다. QR은 참가자를 제출 화면으로
         * 보내는 물건이라 제출을 받는 동안에만 쓸모가 있습니다. 눌러보고 실패하게 두는 대신
         * 아예 내놓지 않습니다.
         *
         * 링크 복사만 상태와 무관하게 남습니다. 끝난 이벤트의 주소도 여전히 유효합니다.
         */}
        <div className="flex items-center gap-2">
          {event.status === 'LIVE' && (
            <Button variant="secondary" size="sm" onClick={() => setIsQrOpen(true)}>
              QR
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleCopyLink}>
            링크 복사
          </Button>
          {event.status === 'LIVE' && (
            <Button
              variant="secondary"
              size="sm"
              disabled={endEventMutation.isPending}
              onClick={() => setIsEndConfirmOpen(true)}
            >
              이벤트 종료
            </Button>
          )}
        </div>
      </div>

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
      </div>

      {isFeedError && <Banner type="negative">지금은 소감을 불러올 수 없어요</Banner>}
      {moderation.isError && <Banner type="negative">소감 처리에 실패했어요</Banner>}
      {endEventMutation.isError && <Banner type="negative">이벤트를 종료하지 못했어요</Banner>}
      {generateReportMutation.isError && (
        <Banner type="negative">요약 리포트를 만들지 못했어요</Banner>
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
              <Donut positive={positive} neutral={neutral} negative={negative} className="py-2" />
            </section>

            <section className={CARD}>
              <div className="flex items-center justify-between gap-2">
                <h2 className={CARD_TITLE}>시간대별 감정 추이</h2>
                {refreshIntervalMs !== null && (
                  <span className="text-xs font-normal leading-4 text-text-tertiary">
                    {refreshIntervalMs / 1000}초마다 갱신
                  </span>
                )}
              </div>

              {trend.length === 0 ? (
                <p className="flex h-40 items-center justify-center text-sm text-text-tertiary">
                  아직 그릴 소감이 없어요
                </p>
              ) : (
                /* 색만으로는 세 선이 구분되지 않아 스크린리더용 설명을 따로 답니다. */
                <div
                  className="h-40"
                  role="img"
                  aria-label={`${TREND_BUCKET_MS / 60_000}분 단위 감정별 소감 건수 추이. 긍정 ${positive}건, 중립 ${neutral}건, 부정 ${negative}건.`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border-subtle)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '0.5rem',
                          border: '1px solid var(--color-border-subtle)',
                          fontSize: '0.75rem',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="POS"
                        name="긍정"
                        stroke="var(--color-positive-default)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="NEU"
                        name="중립"
                        stroke="var(--color-neutral-default)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="NEG"
                        name="부정"
                        stroke="var(--color-negative-default)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
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
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex flex-col gap-3">
              <ModerationQueue
                items={toxicItems}
                waitingCount={toxicCount}
                formatMeta={toMeta}
                actions={moderation}
              />

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
           */}
          <section
            className={`${CARD} flex-row items-start justify-between gap-4 bg-background-muted`}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold leading-6 text-text-primary">
                AI 요약 리포트
              </h2>

              {summaryText !== null ? (
                <p className="text-sm font-normal leading-5 text-text-secondary">{summaryText}</p>
              ) : (
                <p className="text-xs font-normal leading-4 text-text-tertiary">
                  {isReportGenerating
                    ? '요약을 만들고 있어요. 끝나면 여기에 올라와요'
                    : '생성하시면 공개 리포트 링크가 열려요'}
                </p>
              )}
            </div>

            {/*
             * 오른쪽은 이 카드의 상태와 조치가 함께 서는 자리입니다. 상태 배지를 제목이 아니라
             * 여기 두는 이유는, 다 만들고 나면 버튼이 빠져서 이 자리가 비기 때문입니다.
             */}
            <div className="flex shrink-0 items-center gap-2">
              {isReportGenerating && <Badge tone="neutral">생성 중</Badge>}
              {isReportGenerated && <Badge tone="positive">생성 완료</Badge>}

              {/* 다 만든 리포트에는 다시 만들 길이 없습니다(재생성은 REPORT_ALREADY_EXISTS). */}
              {!isReportGenerated && (
                <Button
                  variant="primary"
                  disabled={event.status !== 'ENDED' || isReportUnknown || isReportGenerating}
                  onClick={() => generateReportMutation.mutate()}
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
