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
  keepMockedFetchAlive();
  console.log('[msw] 서버 목 활성화됨 (msw/node)');
};

/**
 * dev 서버 HMR이 목을 걷어내는 것을 막습니다.
 *
 * Next dev는 서버 파일이 하나라도 바뀌면 `resetFetch()`로 `globalThis.fetch`를
 * 되돌립니다(`node_modules/next/dist/server/dev/hot-reloader-turbopack.js:463`).
 * 되돌리는 값은 `router-server.js:126`이 찍어둔 스냅샷인데, 그 시점은 이 파일이
 * 돌기 전이라 MSW 패치가 통째로 날아갑니다. 그때부터 SSR fetch만 목을 통과해
 * 실제 주소로 나가고, ECONNREFUSED가 `fetch failed`로 보입니다. dev 서버를 다시
 * 띄우기 전까지 복구되지 않으면서 원인이 네트워크처럼 보여 찾기 어렵습니다.
 *
 * 그래서 `fetch`를 접근자로 바꿔서, 패치 이전 fetch가 다시 꽂히는 순간에만
 * MSW 버전으로 되돌립니다. Next가 캐시·중복 제거용으로 씌우는 래퍼(`__nextPatched`)는
 * 그대로 받아 목 위에 얹히게 둡니다.
 *
 * 부작용: 이 시점 이후로 `server.close()`는 fetch를 원상 복구하지 못합니다.
 * 테스트는 이 파일을 거치지 않는 별도 프로세스에서 도는 터라 문제되지 않습니다.
 */
const keepMockedFetchAlive = (): void => {
  const mockedFetch = globalThis.fetch;
  let current = mockedFetch;

  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    get: () => current,
    set: (next: typeof fetch) => {
      const isNextWrapper = typeof next === 'function' && '__nextPatched' in next;
      current = isNextWrapper ? next : mockedFetch;
    },
  });
};
