'use client';

import { useQuery } from '@tanstack/react-query';
import { redirect, useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Thermometer } from '@/components/feedback/Thermometer';
import { LiveSkeleton } from '@/components/live/LiveSkeleton';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { useFeedbackSnapshot } from '@/hooks/useFeedbackSnapshot';
import { fetchEventByCode, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { listSubmitted } from '@/lib/storage/submitted';

/**
 * 세션 하나의 실시간 집계 화면입니다.
 *
 * 대상 세션은 `?sessionId=`에서 읽습니다. 제출 화면(`/e/[code]`)이 소감을 받은 뒤 이 값을
 * 붙여서 보냅니다. 값이 아예 없는 경우는 페이지(`app/e/[code]/live/page.tsx`)가 서버에서
 * 걸러 제출 화면으로 돌려보내므로, 여기까지 왔다면 값은 있고 내용만 미심쩍은 상태입니다.
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

  const {
    data: event,
    isPending: isEventPending,
    isError: isEventError,
  } = useQuery({
    queryKey: ['event', code],
    queryFn: () => fetchEventByCode(code),
  });

  /*
   * 목록에 없는 id는 버립니다. 삭제된 세션을 가리키는 옛 링크나 손으로 고친 쿼리로
   * "0개 소감 · 긍정 0%"라는 멀쩡해 보이는 빈 집계가 나오는 걸 막습니다.
   * 숫자가 아닌 값은 `Number()`가 `NaN`으로 만들어서 어떤 세션과도 매칭되지 않습니다.
   */
  const requestedId = Number(searchParams.get('sessionId'));
  const allowedSession =
    sessions?.find(
      (session) => session.id === requestedId && submitted?.has(session.id) === true,
    ) ?? null;
  /*
   * 방금 소감을 내고 넘어온 경우에만 등록 안내를 띄웁니다. 제출 화면이 붙여주는 플래그입니다.
   *
   * 제출 기록(`submitted`)으로 판정하지 않는 이유는 그 값이 "언젠가 냈다"만 알려주기
   * 때문입니다. 며칠 뒤 같은 링크를 다시 열었을 때도 안내가 뜨면 방금 낸 것처럼 읽힙니다.
   *
   * 플래그는 도착하자마자 주소에서 지웁니다. 남겨두면 새로고침할 때마다 다시 뜨는데,
   * 지운 뒤에도 안내는 화면에 머물러야 해서 값을 state로 옮깁니다(#111).
   *
   * 담는 값은 "띄웠다"가 아니라 "누구에게 띄웠는지"입니다. 소비 사실만 남기면, 이 화면을
   * 유지한 채 `?sessionId=`만 바뀌었을 때 effect가 플래그 없이 빠져나가면서 이전 세션의
   * 안내가 그대로 남습니다. 지금은 그렇게 옮겨 다니는 길이 없지만(나가는 문은 `/e/{code}`
   * 하나뿐입니다), 이 화면에 세션 전환이 붙는 순간 조용히 어긋납니다.
   */
  const [bannerTarget, setBannerTarget] = useState<string | null>(null);

  const currentTarget = `${code}:${requestedId}`;
  const justSubmitted = bannerTarget === currentTarget;

  useEffect(() => {
    if (searchParams.get('submitted') !== '1') return;

    const remaining = new URLSearchParams(searchParams.toString());
    remaining.delete('submitted');

    // 이 화면이 플래그를 소비했다는 표시라 effect 말고 둘 곳이 없습니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBannerTarget(currentTarget);
    /*
     * `router.replace`가 아니라 `window.history.replaceState`입니다. 둘 다 Next 라우터와
     * 동기화되지만(`next/dist/docs/01-app/02-guides/single-page-applications.md`),
     * `router.replace`는 라우터를 거치면서 리렌더를 한 번 더 일으킵니다. 이 화면은 5초마다
     * 폴링으로 다시 그려지는 중이라 주소창만 고치면 충분합니다.
     *
     * 지운 결과가 `searchParams`에 반영되면서 이 effect가 한 번 더 도는데, 그때는 위에서
     * 바로 빠져나갑니다.
     */
    window.history.replaceState(null, '', `/e/${code}/live?${remaining.toString()}`);
  }, [code, currentTarget, searchParams]);

  /*
   * 기록에 없는 세션은 집계를 아예 부르지 않습니다. 화면만 가리고 요청은 그대로 내보내면
   * 쿼리를 손으로 고쳐서 남의 세션 수치를 받아볼 수 있습니다.
   */

  const {
    snapshot,
    isPending: isSnapshotPending,
    isError: isSnapshotError,
    isLive,
  } = useFeedbackSnapshot({ eventCode: code, sessionId: allowedSession?.id ?? null });

  const handleWriteAnother = () => {
    router.push(`/e/${code}`);
  };

  // 둘 중 하나가 실패하면 남은 하나로 그릴 수 있는 화면이 없어서 사유를 나누지 않습니다.
  if (isSessionsError || isEventError) {
    return <Banner type="negative">이벤트 정보를 불러올 수 없어요</Banner>;
  }

  // `submitted`가 `null`인 동안은 기록을 아직 안 읽은 상태라 판정할 수 없습니다.
  if (isSessionsPending || isEventPending || submitted === null) {
    return <LiveSkeleton />;
  }

  // `allowedSession`으로 분기해야 아래에서 `allowedSession.title`이 좁혀집니다.
  if (allowedSession === null) redirect(`/e/${code}`);

  // 백분율은 계산하지 않습니다. `Thermometer`가 개수를 받아 직접 나눕니다.
  const { POS, NEU, NEG } = snapshot?.sentimentBreakdown ?? { POS: 0, NEU: 0, NEG: 0 };
  const unclassifiedCount = snapshot?.unclassifiedCount ?? 0;
  const submissionCount = POS + NEU + NEG + unclassifiedCount;

  const keywords = snapshot?.topKeywords ?? [];

  /*
   * 안 남긴 세션이 하나라도 있으면 하단 버튼은 소감을 받으러 가는 길이고, 전부 남겼으면
   * 남은 용무는 다른 순서의 결과를 보는 것뿐이라 문구를 바꿉니다.
   */
  const unsubmittedSession = sessions.find((session) => !submitted.has(session.id)) ?? null;

  /*
   * 세션이 하나뿐인 이벤트면 넘어갈 순서가 없어 버튼을 구분선까지 통째로 뺍니다.
   * 이 화면은 소감을 남겨야 열리므로 세션이 하나면 항상 "전부 남김"이고, 그래서
   * 개수만 보면 됩니다.
   */
  const hasSomewhereToGo = unsubmittedSession !== null || sessions.length > 1;

  return (
    <div className="flex flex-col gap-6">
      {isSnapshotError && <Banner type="negative">지금은 결과를 불러올 수 없어요</Banner>}

      {/* 이벤트명과 등록 안내는 제목에 붙어야 해서 바깥 `gap-6`에서 빼고 따로 묶습니다. */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-normal leading-4 text-text-tertiary">{event.title}</p>
        <h1 className="text-xl font-semibold leading-7 text-text-primary">
          {allowedSession.title}
        </h1>
        {justSubmitted && <Banner type="info">소감이 등록되었어요</Banner>}
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
            <h3 className="text-xs text-text-tertiary">주요 키워드</h3>
            {keywords.length === 0 ? (
              <p className="flex min-h-32 items-center justify-center rounded-xl border border-border-subtle p-4 text-sm text-text-tertiary">
                아직 모인 키워드가 없어요
              </p>
            ) : (
              <ul className="flex min-h-32 flex-wrap items-center justify-center gap-x-6 gap-y-4 rounded-xl border border-border-subtle p-4">
                {keywords.map(({ keyword, count }) => (
                  <li key={keyword}>
                    {keyword}
                    <span className="sr-only"> {count}회</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isLive && (
            <p className="text-center text-xs text-text-secondary">실시간으로 갱신되고 있어요</p>
          )}
        </>
      )}

      {/* 목적지는 둘 다 제출 화면입니다. 거기서 이미 남긴 세션 칩을 누르면 그 세션의 실시간
          결과로 보내기로 해서, 결과를 보러 갈 때도 같은 화면을 거치면 됩니다. */}
      {hasSomewhereToGo && (
        <>
          <hr className="border-border-subtle" />

          <Button
            variant="secondary"
            size="lg"
            className="w-full cursor-pointer"
            onClick={handleWriteAnother}
          >
            {unsubmittedSession !== null ? '다른 세션에도 남기기' : '다른 세션 결과 보기'}
          </Button>
        </>
      )}
    </div>
  );
};

export { LiveResult };
