import type { NextConfig } from 'next';

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

  /**
   * 브라우저가 백엔드로 직접 요청을 보내는 대신 이 Next.js 서버를 거치게 하는 리버스 프록시입니다.
   *
   * 백엔드(Render)와 프론트(Vercel)가 서로 다른 도메인이라, 브라우저가 백엔드에 직접 요청을 보내면
   * accessToken·XSRF-TOKEN 쿠키가 백엔드 도메인에 묶여서 프론트 서버(`proxy.ts` 등)나
   * `document.cookie`(CSRF 토큰을 헤더에 실을 때 씀)로 읽을 수 없습니다(이슈 #139·#140).
   * 이 프록시를 거치면 브라우저는 항상 프론트 자신에게만 요청을 보내고, 백엔드가 내려주는 쿠키도
   * 프론트 자신의 도메인 것으로 저장됩니다.
   *
   * 백엔드 주소를 여기 하드코딩하지 않고 `BACKEND_API_URL` 환경변수로 뺐습니다. 배포 백엔드 주소가
   * 바뀌어도 이 파일을 고치지 않고 Vercel 환경변수만 갱신하면 됩니다. `NEXT_PUBLIC_`이 안 붙은
   * 서버 전용 변수라 브라우저 번들에는 노출되지 않습니다.
   */
  async rewrites() {
    // Vercel 위에서 도는 빌드(프로덕션·프리뷰 둘 다)는 VERCEL=1이 자동으로 설정됩니다. 로컬에는
    // 없는 값이라, 이 검사는 Vercel 빌드에서만 걸리고 로컬 npm run build는 그대로 통과합니다.
    // BACKEND_API_URL을 안 넣고 배포하면 에러 없이 localhost로 조용히 고정되어, 배포된 서버가
    // 자기 자신에게 연결을 시도하다 실패합니다. 로그인·API 요청이 전부 깨지는데 원인을 바로 알기
    // 어려워서, 배포 시점에 즉시 실패하게 만듭니다.
    if (process.env.VERCEL === '1' && !process.env.BACKEND_API_URL) {
      throw new Error(
        'BACKEND_API_URL 환경변수가 없습니다. Vercel 프로젝트 환경변수에 실제 배포 백엔드 주소를 설정해야 합니다.',
      );
    }

    const backendUrl = process.env.BACKEND_API_URL ?? 'http://localhost:8080/api/v1';

    return [
      {
        source: '/api/proxy/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
