'use client';

import { useQuery } from '@tanstack/react-query';
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
import { Donut } from '@/components/feedback/Donut';
import { FeedItem, type Sentiment as FeedItemSentiment } from '@/components/feedback/FeedItem';
import { ModerationQueue } from '@/components/moderation/ModerationQueue';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Stat } from '@/components/ui/Stat';
import { useDashboardFeed } from '@/hooks/useDashboardFeed';
import { useModerationActions } from '@/hooks/useModerationActions';
import { fetchMyEvents, fetchSessionsByEventCode } from '@/lib/api/endpoints';
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

  return (
    <div className="flex flex-col gap-4">
      {/* 제목과 상태는 붙어 있어야 해서 바깥 `gap-4`에서 빼고 따로 묶습니다. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold leading-7 text-text-primary">{event.title}</h1>
          <Badge tone={event.status === 'LIVE' ? 'positive' : 'neutral'}>{event.status}</Badge>
        </div>
        {/* 전체 주소와 복사 버튼은 QR·링크 복사 이슈에서 붙습니다. */}
        <p className="text-xs font-normal leading-4 text-text-tertiary">/e/{event.code}</p>
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

              {visible.length === 0 ? (
                <EmptyState
                  title="아직 들어온 소감이 없어요"
                  description="참가자가 소감을 남기면 여기에 바로 올라와요"
                />
              ) : (
                <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
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

          <section className={`${CARD} flex-row items-center justify-between`}>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold leading-6 text-text-primary">
                AI 요약 리포트
              </h2>
              <p className="text-xs font-normal leading-4 text-text-tertiary">
                이벤트를 종료하면 생성할 수 있어요
              </p>
            </div>
            {/* 실제 생성 호출은 이벤트 종료 이슈에서 붙습니다. 여기서는 조건만 맞춥니다. */}
            <Button variant="secondary" disabled={event.status !== 'ENDED'}>
              요약 생성
            </Button>
          </section>
        </>
      )}
    </div>
  );
};

export { DashboardView };
