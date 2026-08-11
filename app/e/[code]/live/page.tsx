import { Suspense } from 'react';

import { LiveResult } from '@/components/live/LiveResult';
import { LiveSkeleton } from '@/components/live/LiveSkeleton';

/**
 * 참가자용 실시간 결과 화면입니다.
 *
 * 이 파일은 서버 컴포넌트로 두고 집계 부분만 클라이언트 아일랜드(`LiveResult`)로 뺐습니다.
 * `LiveResult`가 쓰는 `useSearchParams`는 프리렌더 시 가장 가까운 Suspense 경계까지를
 * 클라이언트 렌더로 떨어뜨리므로, 껍데기(제목)라도 초기 HTML에 실리게 하려는 것입니다.
 *
 * 접근 제어(소감을 제출한 사람만 열람)도 `LiveResult` 안에 있습니다. 판단 근거인 제출 기록이
 * `localStorage`라 서버에서는 항상 비어 있어서, 이 파일에서 막으면 모두가 차단됩니다.
 */
const LivePage = () => {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-text-primary">실시간 반응</h1>
        <p className="text-xs text-text-tertiary">소감을 남긴 순서만 열어볼 수 있어요</p>
      </div>
      <Suspense fallback={<LiveSkeleton />}>
        <LiveResult />
      </Suspense>
    </main>
  );
};

export default LivePage;
