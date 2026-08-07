'use client';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { fetchFeedbackSnapshot, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { LiveSkeleton } from './LiveSkeleton';
import { SessionPicker } from './SessionPicker';

const REFRESH_INTERVAL_MS = 5_000;

/**
 * 세션 하나의 실시간 집계 화면입니다.
 *
 * 대상 세션은 `?sessionId=`에서 읽습니다. 값이 없거나 이 이벤트의 세션이 아니면
 * `SessionPicker`를 대신 띄웁니다. 제출 화면(`/e/[code]`)에 의존하지 않으려고 이렇게 했습니다.
 *
 * 접근 제어(제출한 사람만 열람)는 아직 없습니다. 제출 화면이 심어줄
 * `pulse_submitted_{sessionId}` 키 포맷이 확정되지 않아서 이 PR 범위에서 뺐습니다.
 */
const LiveResult = () => {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    data: sessions,
    isPending: isSessionsPending,
    isError: isSessionsError,
  } = useQuery({
    queryKey: ['sessions', code],
    queryFn: () => fetchSessionsByEventCode(code),
  });

  /*
   * 목록에 없는 id는 버립니다. 삭제된 세션을 가리키는 옛 링크나 손으로 고친 쿼리로
   * "0개 소감 · 긍정 0%"라는 멀쩡해 보이는 빈 집계가 나오는 걸 막습니다.
   * `Number(null)`·`Number('')`은 0인데 세션 id가 0인 경우는 없어서 그대로 걸러집니다.
   */
  const requestedId = Number(searchParams.get('sessionId'));
  const selectedSession = sessions?.find((session) => session.id === requestedId) ?? null;
  const sessionId = selectedSession?.id ?? null;

  const {
    data: snapshot,
    isPending: isSnapshotPending,
    isError: isSnapshotError,
  } = useQuery({
    queryKey: ['feedbackSnapshot', code, sessionId],
    queryFn: () => fetchFeedbackSnapshot(code, sessionId ?? undefined),
    enabled: sessionId !== null,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const handleSelectSession = (nextSessionId: number) => {
    // 세션 선택은 뒤로 가기 히스토리에 쌓을 만한 이동이 아니라 replace를 씁니다.
    router.replace(`/e/${code}/live?sessionId=${nextSessionId}`);
  };

  const handleChangeSession = () => {
    router.replace(`/e/${code}/live`);
  };

  const handleWriteAnother = () => {
    router.push(`/e/${code}`);
  };

  if (isSessionsError) {
    return <Banner type="negative">세션 목록을 불러올 수 없어요</Banner>;
  }

  if (isSessionsPending) {
    return <LiveSkeleton />;
  }

  // `sessionId`가 아니라 `selectedSession`으로 분기해야 아래에서 `selectedSession.title`이 좁혀집니다.
  if (selectedSession === null) {
    return <SessionPicker sessions={sessions} onSelect={handleSelectSession} />;
  }

  const { POS, NEU, NEG } = snapshot?.sentimentBreakdown ?? { POS: 0, NEU: 0, NEG: 0 };
  const classified = POS + NEU + NEG;
  const unclassifiedCount = snapshot?.unclassifiedCount ?? 0;
  const submissionCount = classified + unclassifiedCount;

  const toPercent = (count: number) =>
    classified === 0 ? 0 : Math.round((count / classified) * 100);
  const positivePercent = toPercent(POS);
  const neutralPercent = toPercent(NEU);
  /*
   * 세 값을 각각 반올림하면 합이 99나 101이 돼서 막대 끝에 빈틈이 생기거나 마지막 조각이
   * flex-shrink로 찌그러집니다. 마지막 조각은 계산하지 않고 남은 만큼 채웁니다.
   */
  const negativePercent =
    classified === 0 ? 0 : Math.max(0, 100 - positivePercent - neutralPercent);

  const keywords = snapshot?.topKeywords ?? [];

  return (
    <div className="flex flex-col gap-6">
      {isSnapshotError && <Banner type="negative">지금은 결과를 불러올 수 없어요</Banner>}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-text-primary">{selectedSession.title}</h2>
        <Button
          className="cursor-pointer"
          variant="secondary"
          size="sm"
          onClick={handleChangeSession}
        >
          다른 순서 보기
        </Button>
      </div>

      {isSnapshotPending ? (
        <LiveSkeleton />
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h3 className="text-xs text-text-tertiary">
              지금 청중 반응 · 소감 {submissionCount}개
              {unclassifiedCount > 0 && ` (미분류 ${unclassifiedCount}개)`}
            </h3>

            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-subtle"
              role="img"
              aria-label={`긍정 ${positivePercent}%, 중립 ${neutralPercent}%, 부정 ${negativePercent}%`}
            >
              <div className="bg-positive-default" style={{ width: `${positivePercent}%` }} />
              <div className="bg-neutral-default" style={{ width: `${neutralPercent}%` }} />
              <div className="bg-negative-default" style={{ width: `${negativePercent}%` }} />
            </div>

            <div className="flex justify-between text-xs" aria-hidden>
              <div className="text-positive-darker">긍정 {positivePercent}%</div>
              <div className="text-neutral-darker">중립 {neutralPercent}%</div>
              <div className="text-negative-darker">부정 {negativePercent}%</div>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs text-text-tertiary">많이 나온 말</h3>
            {keywords.length === 0 ? (
              <p className="flex min-h-32 items-center justify-center rounded-lg border border-border-default px-5 py-8 text-sm text-text-tertiary">
                아직 모인 키워드가 없어요
              </p>
            ) : (
              <ul className="flex min-h-32 flex-wrap items-center justify-center gap-x-6 gap-y-4 rounded-lg border border-border-default px-5 py-8">
                {keywords.map(({ keyword, count }) => (
                  <li key={keyword}>
                    {keyword}
                    <span className="sr-only"> {count}회</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-center text-xs text-text-tertiary">
            {REFRESH_INTERVAL_MS / 1000}초마다 자동으로 갱신돼요
          </p>
        </>
      )}

      <hr className="border-border-default" />

      <Button
        variant="secondary"
        size="lg"
        className="w-full cursor-pointer"
        onClick={handleWriteAnother}
      >
        다른 세션에도 남기기
      </Button>
    </div>
  );
};

export { LiveResult };
