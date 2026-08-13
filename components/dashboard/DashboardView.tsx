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
import { Donut } from '@/components/feedback/Donut';
import { FeedItem, type Sentiment as FeedItemSentiment } from '@/components/feedback/FeedItem';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Stat } from '@/components/ui/Stat';
import { DASHBOARD_FEED_KEY, useDashboardFeed } from '@/hooks/useDashboardFeed';
import { showToast } from '@/hooks/useToast';
import {
  deleteFeedback,
  fetchMyEvents,
  fetchSessionsByEventCode,
  hideFeedback,
  showFeedback,
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

/** 추이 차트의 가로 한 칸입니다. */
const TREND_BUCKET_MS = 5 * 60_000;

/** 상위 키워드 노출 개수입니다. 공개 스냅샷 계약(`TOP_KEYWORD_LIMIT`)과 같은 값입니다. */
const KEYWORD_LIMIT = 10;

/** 모더레이션 큐 위젯이 미리 보여주는 건수입니다. 나머지는 "전체보기"로 넘깁니다. */
const MODERATION_PREVIEW_LIMIT = 3;

const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';
const CARD_TITLE = 'text-xs font-normal leading-4 text-text-tertiary';

const FEED_SENTIMENT: Record<Sentiment, FeedItemSentiment> = {
  POS: 'positive',
  NEU: 'neutral',
  NEG: 'negative',
  UNKNOWN: 'none',
};

const toRelativeTime = (iso: string) => {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000);

  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  return `${Math.floor(hours / 24)}일 전`;
};

const toClock = (ms: number) =>
  new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** 추이 차트의 한 점입니다. 감정 키는 API의 `Sentiment`를 그대로 씁니다(`UNKNOWN` 제외). */
interface TrendPoint {
  label: string;
  POS: number;
  NEU: number;
  NEG: number;
}

/**
 * 소감을 5분 칸으로 묶어 감정별 건수를 셉니다.
 *
 * 누적이 아니라 칸별 건수입니다. 누적은 언제 반응이 몰렸는지가 기울기로만 남아서,
 * 진행 중인 이벤트에서 "지금 분위기가 꺾였다"를 읽어내기 어렵습니다.
 *
 * 첫 소감 시각을 칸 경계로 내림해서 시작합니다. 그래야 폴링으로 뒤에 붙는 소감이
 * 앞 칸들의 경계를 밀지 않아 차트가 흔들리지 않습니다. `UNKNOWN`은 태깅 실패라
 * 감정선에 올리지 않습니다.
 */
const buildTrend = (feedbacks: Feedback[]) => {
  if (feedbacks.length === 0) return [];

  const times = feedbacks.map((feedback) => Date.parse(feedback.createdAt));
  const start = Math.floor(Math.min(...times) / TREND_BUCKET_MS) * TREND_BUCKET_MS;
  const end = Math.max(...times);

  const buckets: TrendPoint[] = [];
  for (let at = start; at <= end; at += TREND_BUCKET_MS) {
    buckets.push({ label: toClock(at), POS: 0, NEU: 0, NEG: 0 });
  }

  feedbacks.forEach((feedback) => {
    if (feedback.sentiment === 'UNKNOWN') return;

    const bucket = buckets[Math.floor((Date.parse(feedback.createdAt) - start) / TREND_BUCKET_MS)];
    if (bucket) bucket[feedback.sentiment] += 1;
  });

  return buckets;
};

/** 빈도순 상위 키워드입니다. 같은 횟수면 가나다순으로 고정해서 폴링마다 순서가 바뀌지 않게 합니다. */
const countKeywords = (feedbacks: Feedback[]) => {
  const counts = new Map<string, number>();

  feedbacks.forEach((feedback) => {
    feedback.keywords.forEach((keyword) => {
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    });
  });

  return [...counts]
    .sort(([leftWord, leftCount], [rightWord, rightCount]) =>
      rightCount === leftCount ? leftWord.localeCompare(rightWord) : rightCount - leftCount,
    )
    .slice(0, KEYWORD_LIMIT);
};

const DashboardView = () => {
  const { eventCode } = useParams<{ eventCode: string }>();
  const queryClient = useQueryClient();

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

  const handleSelectSession = (nextSessionId: number | null) => {
    setSessionId(nextSessionId);
  };

  const handleToggleHidden = (feedback: Feedback) => {
    if (feedback.status === 'HIDDEN') {
      showMutation.mutate(feedback.id);
      return;
    }

    hideMutation.mutate(feedback.id);
  };

  const handleDelete = (feedbackId: number) => {
    deleteMutation.mutate(feedbackId);
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

  const positive = visible.filter((feedback) => feedback.sentiment === 'POS').length;
  const neutral = visible.filter((feedback) => feedback.sentiment === 'NEU').length;
  const negative = visible.filter((feedback) => feedback.sentiment === 'NEG').length;
  const unclassified = visible.filter((feedback) => feedback.sentiment === 'UNKNOWN').length;

  /*
   * 분모에서 미분류를 뺍니다. `UNKNOWN`은 태깅이 실패했다는 뜻이라 "중립"과 다릅니다.
   * 분모에 넣으면 분석이 많이 실패할수록 긍정 비율이 저절로 내려갑니다.
   */
  const classified = positive + neutral + negative;
  const positiveRate = classified === 0 ? 0 : Math.round((positive / classified) * 100);

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
      {(hideMutation.isError || showMutation.isError || deleteMutation.isError) && (
        <Banner type="negative">소감 처리에 실패했어요</Banner>
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
              <section className={CARD}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className={CARD_TITLE}>모더레이션 큐</h2>
                  <div className="flex items-center gap-2">
                    <Badge tone="toxic">{toxicCount}건 대기</Badge>
                    {/* 전체보기 모달은 별도 이슈입니다. 지금은 자리만 잡습니다. */}
                    <span className="text-xs font-normal leading-4 text-text-tertiary">
                      전체보기
                    </span>
                  </div>
                </div>

                {toxicItems.length === 0 ? (
                  <EmptyState title="검토할 소감이 없어요" />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {toxicItems.slice(0, MODERATION_PREVIEW_LIMIT).map((feedback) => (
                      <li key={feedback.id}>
                        <FeedItem
                          state={feedback.status === 'HIDDEN' ? 'hidden' : 'flagged'}
                          sentiment="toxic"
                          meta={toMeta(feedback)}
                          content={feedback.text}
                          actions={
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                /*
                                 * 누른 항목만 잠급니다. `isPending`만 보면 미리보기 세 건이
                                 * mutation 하나를 공유해서 누르지 않은 항목까지 같이 잠깁니다.
                                 * `variables`는 `mutate`에 넘긴 id라 요청이 도는 동안 남습니다.
                                 */
                                disabled={
                                  (hideMutation.isPending &&
                                    hideMutation.variables === feedback.id) ||
                                  (showMutation.isPending && showMutation.variables === feedback.id)
                                }
                                onClick={() => handleToggleHidden(feedback)}
                              >
                                {feedback.status === 'HIDDEN' ? '숨김 해제' : '숨기기'}
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={
                                  deleteMutation.isPending &&
                                  deleteMutation.variables === feedback.id
                                }
                                onClick={() => handleDelete(feedback.id)}
                              >
                                삭제
                              </Button>
                            </>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

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
