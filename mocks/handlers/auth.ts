import { http, HttpResponse } from 'msw';
import type { AuthUser } from '@/lib/schemas/api';
import { loginRequestSchema, signupRequestSchema } from '@/lib/schemas/api';
import type { MockAccount } from '@/mocks/data/store';
import { db, findAccountByEmail, nextAccountId } from '@/mocks/data/store';
import {
  ACCESS_TOKEN_COOKIE,
  API_BASE_URL,
  XSRF_TOKEN_COOKIE,
  authenticatedAccount,
  errorResponse,
  issueAccessToken,
  parseBody,
} from '@/mocks/handlers/shared';

/**
 * 인증 핸들러입니다. 시드 계정은 host@example.com / pulse1234 입니다.
 *
 * 2026-08-07 명세부터 토큰이 응답 바디가 아니라 HttpOnly 쿠키로 내려갑니다.
 * 응답 바디에는 유저 정보(`AuthUser`)만 담기고, 새로고침 뒤 로그인 상태 복원은
 * FE가 `GET /auth/me`를 호출해서 확인합니다.
 */

const MOCK_XSRF_TOKEN = 'mock-xsrf-token';

/**
 * 실제 BE는 `Secure; SameSite=None`으로 내립니다(FE·BE 도메인이 다름).
 * 목은 `Secure`를 빼고 `SameSite=Lax`로 둡니다 — localhost는 http라서 `Secure` 쿠키가 저장되지 않고,
 * 목은 같은 오리진이라 `None`이 필요 없습니다.
 *
 * `Headers`에 `Set-Cookie`를 `.append()`로 두 번 넣으면 MSW가 마지막 값만 적용하고
 * 앞의 값을 버려서(https://github.com/mswjs/msw/issues/1290), 배열로 직접 넘깁니다.
 *
 * ---
 *
 * `httpOnly` 옵션은 `accessToken` 쿠키에만 영향을 줍니다(이슈 #128).
 *
 * 브라우저에서 MSW는 Service Worker(`mockServiceWorker.js`)가 페이지의 `fetch`를
 * 가로채서, 이 파일이 만든 응답을 `FetchEvent.respondWith()`로 대신 돌려주는 방식으로
 * 동작합니다. 브라우저는 이렇게 Service Worker가 대신 돌려준 응답에 대해서는,
 * `HttpOnly`가 붙은 `Set-Cookie`를 실제 쿠키 저장소에 반영하지 않습니다. 스크립트가
 * 제어하는 계층(Service Worker)이 "스크립트가 못 건드리는 쿠키(HttpOnly)"를 마음대로
 * 심을 수 있게 되면 `HttpOnly`의 존재 이유 자체가 무너지기 때문입니다.
 *
 * 이슈 #128에서 아래 순서로 이 원인을 좁혔습니다.
 * - Node 환경(`msw/node`, `mocks/server.ts`)에서는 이 함수가 두 쿠키를 모두 정확히
 *   만든다는 걸 테스트로 확인했습니다. 즉 이 파일의 로직 자체는 원래도 맞았습니다.
 * - 그런데 실제 브라우저에서 로그인해보면 `HttpOnly`가 없는 `XSRF-TOKEN`만 저장되고,
 *   `HttpOnly`가 붙은 `accessToken`은 쿠키를 완전히 지운 뒤 다시 로그인해도 저장되지
 *   않았습니다. 두 쿠키의 유일한 차이가 `HttpOnly`라 원인이 여기로 좁혀졌습니다.
 * - 이 현상은 MDN 문서(Service Worker가 `HttpOnly` 쿠키를 다루지 못한다는 설명,
 *   https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)와
 *   WHATWG 쿠키 스토어 제안의 논의(https://github.com/whatwg/cookiestore/issues/37)에서도
 *   같은 제약으로 설명되고 있어서, 이 프로젝트만의 버그가 아니라 브라우저 자체의 제약으로 판단했습니다.
 *
 * 그래서 이 함수들은 호출하는 쪽이 `httpOnly` 여부를 직접 정하게 합니다.
 * `mocks/server.ts`(SSR 목·`mocks/handlers.test.ts` 계약 테스트, Service Worker를
 * 거치지 않음)는 `httpOnly: true`로 실제 명세를 그대로 지킵니다. `mocks/browser.ts`(브라우저
 * 개발 서버, Service Worker를 거침)만 `httpOnly: false`로 위 제약을 우회합니다. 실제 BE
 * 응답은 이 파일을 거치지 않으므로(`mocks/config.ts`의 `isMockingEnabled`가 꺼지면 이
 * 핸들러 자체가 실행되지 않습니다), 실제 배포 환경의 보안에는 영향이 없습니다. FE 코드
 * 어디에도 `accessToken`을 `document.cookie`로 직접 읽는 곳이 없어서(애초에 `HttpOnly`라
 * 못 읽는 게 설계 의도), 브라우저 목에서만 `HttpOnly`를 빼도 놓치는 실제 버그는 없습니다.
 */
const sessionCookies = (
  accountId: number,
  { httpOnly }: { httpOnly: boolean },
): [string, string][] => [
  [
    'Set-Cookie',
    `${ACCESS_TOKEN_COOKIE}=${issueAccessToken(accountId)}; Path=/; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}`,
  ],
  // CSRF double-submit용이라 HttpOnly가 아닙니다. FE가 읽어서 X-XSRF-TOKEN 헤더로 되돌려 보냅니다.
  ['Set-Cookie', `${XSRF_TOKEN_COOKIE}=${MOCK_XSRF_TOKEN}; Path=/; SameSite=Lax`],
];

const expiredCookies = ({ httpOnly }: { httpOnly: boolean }): [string, string][] => [
  [
    'Set-Cookie',
    `${ACCESS_TOKEN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${httpOnly ? '; HttpOnly' : ''}`,
  ],
  ['Set-Cookie', `${XSRF_TOKEN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`],
];

const toAuthUser = (account: MockAccount): AuthUser => ({
  id: account.id,
  email: account.email,
  createdAt: account.createdAt,
});

/**
 * 인증 핸들러 목록을 만듭니다. `httpOnly`는 위 `sessionCookies`·`expiredCookies` 주석대로
 * `accessToken` 쿠키에만 적용되며, 호출하는 쪽(`mocks/server.ts`·`mocks/browser.ts`)이
 * 자신의 환경에 맞는 값을 넘겨야 합니다.
 */
export const createAuthHandlers = ({ httpOnly }: { httpOnly: boolean }) => [
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = await parseBody(request, loginRequestSchema);
    if (!body.ok) return body.response;

    const account = findAccountByEmail(body.data.email);

    // 없는 사용자와 비밀번호 불일치는 BE가 의도적으로 같은 코드로 병합합니다.
    if (!account || account.password !== body.data.password) {
      return errorResponse('INVALID_CREDENTIALS');
    }

    return HttpResponse.json(toAuthUser(account), {
      headers: sessionCookies(account.id, { httpOnly }),
    });
  }),

  http.post(`${API_BASE_URL}/auth/signup`, async ({ request }) => {
    const body = await parseBody(request, signupRequestSchema);
    if (!body.ok) return body.response;

    if (findAccountByEmail(body.data.email)) return errorResponse('EMAIL_ALREADY_EXISTS');

    // 가입 계정도 이후 로그인 대상이 돼야 하므로 비밀번호까지 저장합니다(요구사항 "1. 회원가입").
    const account: MockAccount = {
      id: nextAccountId(),
      email: body.data.email,
      password: body.data.password,
      createdAt: new Date().toISOString(),
    };
    db.accounts.push(account);

    // 가입과 동시에 쿠키를 내려 로그인 상태로 만듭니다. 별도 로그인 호출이 필요 없습니다.
    return HttpResponse.json(toAuthUser(account), {
      status: 201,
      headers: sessionCookies(account.id, { httpOnly }),
    });
  }),

  // 쿠키만 만료시킵니다. 로그인 상태가 아니어도 성공으로 봅니다(멱등).
  http.post(`${API_BASE_URL}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204, headers: expiredCookies({ httpOnly }) });
  }),

  /**
   * 새로고침 뒤 로그인 상태를 복원하는 유일한 경로입니다.
   * 토큰이 HttpOnly라 FE가 직접 읽고 판단할 수 없어서 서버에 물어봐야 합니다.
   */
  http.get(`${API_BASE_URL}/auth/me`, ({ request, cookies }) => {
    const account = authenticatedAccount(request, cookies);
    if (!account) return errorResponse('UNAUTHORIZED');

    return HttpResponse.json(toAuthUser(account));
  }),
];
