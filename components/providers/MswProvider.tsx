'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { isMockingEnabled } from '@/mocks/config';

interface MswProviderProps {
  children: ReactNode;
}

/**
 * 브라우저 쪽 MSW 워커를 띄웁니다. 서버 쪽(SSR·서버 컴포넌트)은 `instrumentation.ts`가
 * 따로 `msw/node`를 띄우므로 이 컴포넌트가 관여하지 않습니다.
 *
 * 워커 등록이 끝나기 전에 요청이 나가면 목을 통과해버려서, 준비될 때까지 자식 렌더를 막습니다.
 * 게이트는 서버 렌더에도 걸립니다. 마운트 이후에만 걸면 하이드레이션 렌더에서 자식이 그려져
 * `useQuery`가 워커보다 먼저 fetch를 날립니다.
 *
 * 프로덕션에서는 `isMockingEnabled`가 false라 게이트가 처음부터 열려 있어 영향이 없습니다.
 */
const MswProvider = ({ children }: MswProviderProps) => {
  const [isWorkerReady, setIsWorkerReady] = useState(!isMockingEnabled);

  useEffect(() => {
    if (!isMockingEnabled) return;

    let isCancelled = false;

    // 동적 import라 프로덕션 번들에는 목 코드가 들어가지 않습니다.
    void import('@/mocks/browser')
      .then(({ worker }) =>
        worker.start({
          // 목에 없는 요청(정적 파일, Next 내부 요청 등)은 그냥 통과시킵니다.
          onUnhandledRequest: 'bypass',
        }),
      )
      .then(() => {
        if (!isCancelled) setIsWorkerReady(true);
      })
      .catch((error: unknown) => {
        console.error('[msw] 워커를 시작하지 못했습니다.', error);
        // 목이 죽어도 화면은 떠야 합니다. 요청은 실제 API 주소로 나갑니다.
        if (!isCancelled) setIsWorkerReady(true);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  if (!isWorkerReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-zinc-500">
        목 서버를 준비하고 있습니다…
      </div>
    );
  }

  return <>{children}</>;
};

export default MswProvider;
