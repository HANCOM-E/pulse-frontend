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
 * 접근 제어(소감을 제출한 사람만 열람)도 `LiveResult` 안에 있습니다. 판단 근거인 제출 기록이
 * `localStorage`라 서버에서는 항상 비어 있어서, 이 파일에서 막으면 모두가 차단됩니다.
 */
const LivePage = () => {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-6">
      <Suspense fallback={<LiveSkeleton />}>
        <LiveResult />
      </Suspense>
    </main>
  );
};

export default LivePage;
