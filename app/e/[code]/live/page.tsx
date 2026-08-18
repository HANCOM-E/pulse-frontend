import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { LiveResult } from '@/components/live/LiveResult';
import { LiveSkeleton } from '@/components/live/LiveSkeleton';

/**
 * 참가자용 실시간 결과 화면입니다.
 *
 * 이 파일은 서버 컴포넌트로 두고 화면 전체를 클라이언트 아일랜드(`LiveResult`)로 뺐습니다.
 * 제목까지 안쪽에 있는 이유는 차단 안내 배너를 제목 위에 두기 위해서입니다. 배너 조건이
 * `localStorage`에서 나와 클라이언트에서만 알 수 있는데, 제목이 이 파일에 남아 있으면
 * 자식인 배너가 부모의 앞 형제보다 위로 올라갈 방법이 없습니다.
 *
 * 그래서 초기 HTML에는 스켈레톤만 실립니다. `useSearchParams`가 프리렌더를 가장 가까운
 * Suspense 경계까지 클라이언트 렌더로 떨어뜨리기 때문입니다.
 *
 * 열람 자격 판정은 세 갈래인데 이 파일이 맡는 건 첫 번째뿐입니다.
 *
 * 1. `?sessionId=`가 없음 — 아래에서 제출 화면으로 돌려보냅니다.
 * 2. 값은 있는데 이 이벤트의 세션이 아님 — 세션 목록을 받아봐야 알 수 있어 `LiveResult`가 봅니다.
 * 3. 세션은 맞는데 소감을 안 남김 — 근거인 제출 기록이 `localStorage`라 서버에서는 항상
 *    "안 남김"이 됩니다. 여기서 막으면 소감을 낸 사람까지 전부 차단되므로 `LiveResult`가 봅니다.
 *
 * `PageProps`는 Next가 라우트 문자열로 만들어주는 전역 타입이라 import하지 않습니다
 * (`next dev`·`next build`·`next typegen` 시점에 생성됩니다).
 */
const LivePage = async ({ params, searchParams }: PageProps<'/e/[code]/live'>) => {
  const { code } = await params;
  const { sessionId } = await searchParams;

  /*
   * 렌더 전에 끊어야 스켈레톤이 한 번 스쳐 지나가지 않습니다. 클라이언트에서 돌려보내면
   * 번들을 받아 마운트한 뒤에야 이동이 시작됩니다.
   *
   * 배열(`?sessionId=1&sessionId=2`)과 빈 값(`?sessionId=`)도 같이 걸러냅니다. 그대로 넘기면
   * `LiveResult`의 `Number()`가 각각 `NaN`·0이 되어 어차피 어떤 세션과도 매칭되지 않습니다.
   */
  if (typeof sessionId !== 'string' || sessionId === '') {
    redirect(`/e/${code}`);
  }

  /*
   * 폭은 형제 페이지(`/e/[code]`·`report`·not-found)와 같은 열에 맞춥니다. 레이아웃의
   * 로고도 `max-w-md`라, 여기만 넓히면 넓은 화면에서 로고와 본문의 왼쪽 끝이 어긋납니다.
   */
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-4">
      <Suspense fallback={<LiveSkeleton withHeading />}>
        <LiveResult />
      </Suspense>
    </main>
  );
};

export default LivePage;
