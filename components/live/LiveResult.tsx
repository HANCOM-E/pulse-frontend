'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { Thermometer } from '@/components/feedback/Thermometer';
import { LiveSkeleton } from '@/components/live/LiveSkeleton';
import { SessionPicker } from '@/components/live/SessionPicker';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { useFeedbackSnapshot } from '@/hooks/useFeedbackSnapshot';
import { fetchSessionsByEventCode } from '@/lib/api/endpoints';

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
    snapshot,
    isPending: isSnapshotPending,
    isError: isSnapshotError,
    refreshIntervalMs,
  } = useFeedbackSnapshot({ eventCode: code, sessionId });

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

  // 백분율은 계산하지 않습니다. `Thermometer`가 개수를 받아 직접 나눕니다.
  const { POS, NEU, NEG } = snapshot?.sentimentBreakdown ?? { POS: 0, NEU: 0, NEG: 0 };
  const unclassifiedCount = snapshot?.unclassifiedCount ?? 0;
  const submissionCount = POS + NEU + NEG + unclassifiedCount;

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

            <Thermometer positive={POS} neutral={NEU} negative={NEG} />
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

          {refreshIntervalMs !== null && (
            <p className="text-center text-xs text-text-tertiary">
              {refreshIntervalMs / 1000}초마다 자동으로 갱신돼요
            </p>
          )}
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
