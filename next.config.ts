import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `msw`를 서버 번들에서 빼야 `msw/node`가 서버 컴포넌트의 fetch를 가로챕니다.
   *
   * Next는 서버 컴포넌트·라우트 핸들러가 import한 패키지를 자동으로 번들합니다
   * (`node_modules/next/dist/docs/01-app/02-guides/package-bundling.md`).
   * MSW는 런타임에 `globalThis.fetch`와 `http`/`https`를 갈아끼우는 방식이라
   * 번들된 사본이 패치하면 렌더러가 쓰는 fetch에는 반영되지 않습니다.
   * 그러면 `instrumentation.ts`가 목을 띄웠다고 로그를 찍는데도 SSR 요청만
   * 목을 통과해 실제 주소로 나가고, `ECONNREFUSED`가 `fetch failed`로 보입니다.
   * 원인이 목 설정이 아니라 네트워크처럼 보여서 찾기 어렵습니다.
   *
   * 프로덕션 빌드에서는 목 자체가 꺼지므로(`mocks/config.ts`) 이 설정은 개발 편의용입니다.
   */
  serverExternalPackages: ['msw'],
};

export default nextConfig;
