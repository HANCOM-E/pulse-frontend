'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { useState } from 'react';
import {
  fetchEventByCode,
  fetchFeedbackSnapshot,
  fetchModerationQueue,
  fetchSessionsByEventCode,
  hideFeedback,
  login,
  showFeedback,
} from '@/lib/api/endpoints';
import { setStoredAccessToken } from '@/lib/authToken';
import { isMockingEnabled } from '@/mocks/config';

/**
 * MSW 목 서버 확인용 개발 페이지입니다. `/dev/msw`
 *
 * 화면 디자인이 아니라 배선 확인이 목적입니다. 목이 살아 있는지, 스키마 검증이 통과하는지,
 * 모더레이션이 집계에 반영되는지를 눈으로 보려고 만들었습니다.
 * 각 축이 자기 화면을 붙이고 나면 지워도 됩니다.
 */

const EVENT_CODE = 'ab3f9x';

const DevMswPage = () => {
  const queryClient = useQueryClient();
  const [loginMessage, setLoginMessage] = useState('로그인 전 — /admin 호출은 401이 납니다.');

  const eventQuery = useQuery({
    queryKey: ['event', EVENT_CODE],
    queryFn: () => fetchEventByCode(EVENT_CODE),
  });

  const sessionsQuery = useQuery({
    queryKey: ['sessions', EVENT_CODE],
    queryFn: () => fetchSessionsByEventCode(EVENT_CODE),
  });

  const snapshotQuery = useQuery({
    queryKey: ['snapshot', EVENT_CODE],
    queryFn: () => fetchFeedbackSnapshot(EVENT_CODE),
    // 실시간 화면이 폴링으로 동작하는지 확인하려고 짧게 잡았습니다.
    refetchInterval: 5_000,
  });

  const queueQuery = useQuery({
    queryKey: ['moderation', EVENT_CODE],
    // includeHidden을 켜야 숨긴 건이 큐에 남아서 해제 버튼을 눌러볼 수 있습니다.
    queryFn: () => fetchModerationQueue({ eventCode: EVENT_CODE, toxic: true, includeHidden: true }),
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: () => login({ email: 'host@example.com', password: 'pulse1234' }),
    onSuccess: (data) => {
      setStoredAccessToken(data.accessToken);
      setLoginMessage('로그인 완료 — 모더레이션 큐를 불러올 수 있습니다.');
      void queryClient.invalidateQueries({ queryKey: ['moderation'] });
    },
    onError: (error: Error) => setLoginMessage(`로그인 실패 — ${error.message}`),
  });

  const moderationMutation = useMutation({
    mutationFn: ({ id, next }: { id: number; next: 'HIDDEN' | 'VISIBLE' }) =>
      next === 'HIDDEN' ? hideFeedback(id) : showFeedback(id),
    onSuccess: () => {
      // 숨김이 집계에서 빠지는 걸 확인하려면 스냅샷도 같이 무효화해야 합니다.
      void queryClient.invalidateQueries({ queryKey: ['moderation'] });
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] });
    },
  });

  if (!isMockingEnabled) {
    notFound();
  }

  const handleLoginClick = () => loginMutation.mutate();

  const breakdown = snapshotQuery.data?.sentimentBreakdown;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8 text-sm">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">MSW 목 서버 확인</h1>
        <p className="text-zinc-500">이벤트 코드 {EVENT_CODE}</p>
      </header>

      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleLoginClick}
          disabled={loginMutation.isPending}
          className="w-fit rounded border border-zinc-300 px-3 py-2 disabled:opacity-50"
        >
          시드 계정으로 로그인
        </button>
        <p className="text-zinc-500">{loginMessage}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">이벤트 상세</h2>
        {eventQuery.isPending && <p>불러오는 중…</p>}
        {eventQuery.error && <p className="text-red-600">{eventQuery.error.message}</p>}
        {eventQuery.data && (
          <p>
            {eventQuery.data.code} · {eventQuery.data.title} · {eventQuery.data.status}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">세션 목록</h2>
        {sessionsQuery.error && <p className="text-red-600">{sessionsQuery.error.message}</p>}
        <ul className="flex flex-col gap-1">
          {sessionsQuery.data?.map((session) => (
            <li key={session.id}>
              #{session.id} {session.title} (order {session.order})
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">집계 스냅샷 (5초 폴링)</h2>
        {breakdown && (
          <p>
            긍정 {breakdown.POS} · 중립 {breakdown.NEU} · 부정 {breakdown.NEG} · 미분류{' '}
            {snapshotQuery.data?.unclassifiedCount}
          </p>
        )}
        <p className="text-zinc-500">
          상위 키워드:{' '}
          {snapshotQuery.data?.topKeywords.map((item) => `${item.keyword}(${item.count})`).join(', ')}
        </p>
        <p className="text-zinc-500">공개 소감 {snapshotQuery.data?.recentFeedbacks.length}건</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">모더레이션 큐 (독성만)</h2>
        {queueQuery.error && <p className="text-red-600">{queueQuery.error.message}</p>}
        <ul className="flex flex-col gap-2">
          {queueQuery.data?.map((feedback) => (
            <li key={feedback.id} className="flex items-center justify-between gap-4">
              <span>
                [{feedback.status}] 세션 {feedback.sessionId} · {feedback.text}
              </span>
              <button
                type="button"
                onClick={() =>
                  moderationMutation.mutate({
                    id: feedback.id,
                    next: feedback.status === 'HIDDEN' ? 'VISIBLE' : 'HIDDEN',
                  })
                }
                className="shrink-0 rounded border border-zinc-300 px-2 py-1"
              >
                {feedback.status === 'HIDDEN' ? '숨김 해제' : '숨기기'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};

export default DevMswPage;
