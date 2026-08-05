import { isMockingEnabled } from '@/mocks/config';

/**
 * 서버 쪽 MSW를 띄웁니다.
 *
 * 브라우저 워커는 서버 컴포넌트·SSR에서 나가는 fetch를 가로채지 못합니다.
 * 공개 페이지(`app/e/[code]/...`)는 SSR이라 서버에서 API를 부르므로,
 * 여기서 `msw/node`를 따로 띄워야 목 데이터가 붙습니다.
 *
 * `register`는 서버가 요청을 받기 전에 완료되므로 첫 요청부터 목이 적용됩니다.
 */
export const register = async (): Promise<void> => {
  if (!isMockingEnabled) return;

  // Edge 런타임에는 msw/node를 올릴 수 없어 Node 런타임에서만 실행합니다.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { server } = await import('@/mocks/server');
  server.listen({ onUnhandledRequest: 'bypass' });
  console.log('[msw] 서버 목 활성화됨 (msw/node)');
};
