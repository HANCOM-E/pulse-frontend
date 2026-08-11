'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Thermometer } from '@/components/feedback/Thermometer';
import { LiveSkeleton } from '@/components/live/LiveSkeleton';
import { SessionPicker } from '@/components/live/SessionPicker';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useFeedbackSnapshot } from '@/hooks/useFeedbackSnapshot';
import { fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { listSubmitted } from '@/lib/storage/submitted';

/**
 * 세션 하나의 실시간 집계 화면입니다.
 *
 * 대상 세션은 `?sessionId=`에서 읽습니다. 값이 없거나 이 이벤트의 세션이 아니면
 * `SessionPicker`를 대신 띄웁니다. 제출 화면(`/e/[code]`)에 의존하지 않으려고 이렇게 했습니다.
 *
 * 소감을 남긴 세션만 볼 수 있습니다. 판단 근거는 `lib/storage/submitted`의 로컬 기록입니다.
 * 서버가 중복 제출을 막지 않아 프론트가 기록을 남겨 안내만 하는 구조라(#92), 이 차단도
 * 완전하지 않습니다. 시크릿 모드나 다른 기기면 기록이 없어서 이미 낸 사람도 다시 남겨야 합니다.
 */
const LiveResult = () => {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  /*
   * 제출 기록은 브라우저에만 있어서 서버 렌더에서는 항상 비어 있습니다. 렌더 중에 읽으면
   * 서버와 클라이언트 결과가 어긋나므로 마운트 후에 읽습니다.
   *
   * `null`은 "아직 안 읽음"이고 그동안은 스켈레톤을 보여줍니다. 이 구분이 없으면 첫 렌더가
   * "기록 없음"이 되어, 소감을 낸 사람에게도 차단 화면이 한 번 스쳐 지나갑니다.
   */
  const [submitted, setSubmitted] = useState<Set<number> | null>(null);

  useEffect(() => {
    /*
     * `react-hooks/set-state-in-effect`는 effect의 setState가 렌더를 연쇄시키는 걸 막는 룰인데,
     * 여기서는 마운트 직후 한 번으로 끝납니다. 이 화면은 폴링으로 5초마다 다시 그려지므로
     * 렌더 한 번이 더 도는 비용은 무시할 수 있습니다.
     *
     * 룰이 권하는 `useSyncExternalStore`로 바꾸면 구독하지 않는 스토어를 억지로 만들게 되어
     * 읽기 어려워집니다. 기록이 바뀌면 알림을 받아야 하는 상황이 오면 그때 옮기는 게 맞습니다.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubmitted(listSubmitted(code));
  }, [code]);

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

  /*
   * 기록에 없는 세션은 집계를 아예 부르지 않습니다. 화면만 가리고 요청은 그대로 내보내면
   * 쿼리를 손으로 고쳐서 남의 세션 수치를 받아볼 수 있습니다.
   */
  const allowedSession =
    selectedSession !== null && submitted?.has(selectedSession.id) === true
      ? selectedSession
      : null;

  const {
    snapshot,
    isPending: isSnapshotPending,
    isError: isSnapshotError,
    refreshIntervalMs,
  } = useFeedbackSnapshot({ eventCode: code, sessionId: allowedSession?.id ?? null });

  const handleSelectSession = (nextSessionId: number) => {
    // 세션 선택은 뒤로 가기 히스토리에 쌓을 만한 이동이 아니라 replace를 씁니다.
    router.replace(`/e/${code}/live?sessionId=${nextSessionId}`);
  };

  const handleWriteAnother = () => {
    router.push(`/e/${code}`);
  };

  if (isSessionsError) {
    return <Banner type="negative">세션 목록을 불러올 수 없어요</Banner>;
  }

  // `submitted`가 `null`인 동안은 기록을 아직 안 읽은 상태라 판정할 수 없습니다.
  if (isSessionsPending || submitted === null) {
    return <LiveSkeleton />;
  }

  // `allowedSession`으로 분기해야 아래에서 `allowedSession.title`이 좁혀집니다.
  if (allowedSession === null) {
    return (
      <div className="flex flex-col gap-4">
        {/* 요청한 세션이 있는데 못 여는 경우에만 이유를 밝힙니다. 파라미터 없이 들어온
            사람에게 "볼 수 없어요"라고만 하면 무엇을 못 본다는 건지 알 수 없습니다. */}
        {selectedSession !== null && (
          <Banner type="info">소감을 남긴 순서의 반응만 볼 수 있어요</Banner>
        )}

        <SessionPicker
          sessions={sessions}
          submitted={submitted}
          onSelect={handleSelectSession}
          onWrite={handleWriteAnother}
        />
      </div>
    );
  }

  // 백분율은 계산하지 않습니다. `Thermometer`가 개수를 받아 직접 나눕니다.
  const { POS, NEU, NEG } = snapshot?.sentimentBreakdown ?? { POS: 0, NEU: 0, NEG: 0 };
  const unclassifiedCount = snapshot?.unclassifiedCount ?? 0;
  const submissionCount = POS + NEU + NEG + unclassifiedCount;

  const keywords = snapshot?.topKeywords ?? [];

  return (
    <div className="flex flex-col gap-6">
      {isSnapshotError && <Banner type="negative">지금은 결과를 불러올 수 없어요</Banner>}

      {/* 선택된 칩이 곧 제목이라 제목 줄을 따로 두지 않습니다. 예전에는 "다른 순서 보기"로
          선택 화면에 다녀와야 세션을 바꿨는데, 여기서 바로 갈아탈 수 있어 그 단계가 없어졌습니다. */}
      <ul className="flex flex-wrap gap-2">
        {sessions.map((session) => (
          <li key={session.id}>
            <Chip
              className="cursor-pointer"
              selected={session.id === allowedSession.id}
              disabled={!submitted.has(session.id)}
              onClick={() => handleSelectSession(session.id)}
            >
              {session.title}
            </Chip>
          </li>
        ))}
      </ul>

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
