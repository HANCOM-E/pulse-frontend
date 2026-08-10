import { http, HttpResponse } from 'msw';
import type { AuthUser } from '@/lib/schemas/api';
import { loginRequestSchema, signupRequestSchema } from '@/lib/schemas/api';
import type { MockAccount } from '@/mocks/data/store';
import { db, findAccountByEmail, findAccountById, nextAccountId } from '@/mocks/data/store';
import {
  ACCESS_TOKEN_COOKIE,
  API_BASE_URL,
  XSRF_TOKEN_COOKIE,
  errorResponse,
  parseBody,
} from '@/mocks/handlers/shared';

/**
 * 인증 핸들러입니다. 시드 계정은 host@example.com / pulse1234 입니다.
 *
 * 2026-08-07 명세부터 토큰이 응답 바디가 아니라 HttpOnly 쿠키로 내려갑니다.
 * 응답 바디에는 유저 정보(`AuthUser`)만 담기고, 새로고침 뒤 로그인 상태 복원은
 * FE가 `GET /auth/me`를 호출해서 확인합니다.
 */

/**
 * 목 토큰은 서명하지 않고 계정 id만 실어 둡니다.
 * `GET /auth/me`가 "누가 로그인했는지"를 답하려면 쿠키에서 계정을 되찾을 수 있어야 합니다.
 */
const ACCESS_TOKEN_PREFIX = 'mock-access-token-';
const MOCK_XSRF_TOKEN = 'mock-xsrf-token';

const issueAccessToken = (accountId: number): string => `${ACCESS_TOKEN_PREFIX}${accountId}`;

export const accountIdFromAccessToken = (token: string | undefined): number | null => {
  if (token === undefined || !token.startsWith(ACCESS_TOKEN_PREFIX)) return null;
  const parsed = Number(token.slice(ACCESS_TOKEN_PREFIX.length));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * 실제 BE는 `Secure; SameSite=None`으로 내립니다(FE·BE 도메인이 다름).
 * 목은 `Secure`를 빼고 `SameSite=Lax`로 둡니다 — localhost는 http라서 `Secure` 쿠키가 저장되지 않고,
 * 목은 같은 오리진이라 `None`이 필요 없습니다.
 */
const sessionCookies = (accountId: number): Headers => {
  const headers = new Headers();
  headers.append(
    'Set-Cookie',
    `${ACCESS_TOKEN_COOKIE}=${issueAccessToken(accountId)}; Path=/; HttpOnly; SameSite=Lax`,
  );
  // CSRF double-submit용이라 HttpOnly가 아닙니다. FE가 읽어서 X-XSRF-TOKEN 헤더로 되돌려 보냅니다.
  headers.append('Set-Cookie', `${XSRF_TOKEN_COOKIE}=${MOCK_XSRF_TOKEN}; Path=/; SameSite=Lax`);
  return headers;
};

const expiredCookies = (): Headers => {
  const headers = new Headers();
  headers.append(
    'Set-Cookie',
    `${ACCESS_TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  headers.append('Set-Cookie', `${XSRF_TOKEN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`);
  return headers;
};

const toAuthUser = (account: MockAccount): AuthUser => ({
  id: account.id,
  email: account.email,
  createdAt: account.createdAt,
});

export const authHandlers = [
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = await parseBody(request, loginRequestSchema);
    if (!body.ok) return body.response;

    const account = findAccountByEmail(body.data.email);

    // 없는 사용자와 비밀번호 불일치는 BE가 의도적으로 같은 코드로 병합합니다.
    if (!account || account.password !== body.data.password) {
      return errorResponse('INVALID_CREDENTIALS');
    }

    return HttpResponse.json(toAuthUser(account), { headers: sessionCookies(account.id) });
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
      headers: sessionCookies(account.id),
    });
  }),

  // 쿠키만 만료시킵니다. 로그인 상태가 아니어도 성공으로 봅니다(멱등).
  http.post(`${API_BASE_URL}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204, headers: expiredCookies() });
  }),

  /**
   * 새로고침 뒤 로그인 상태를 복원하는 유일한 경로입니다.
   * 토큰이 HttpOnly라 FE가 직접 읽고 판단할 수 없어서 서버에 물어봐야 합니다.
   */
  http.get(`${API_BASE_URL}/auth/me`, ({ cookies }) => {
    const accountId = accountIdFromAccessToken(cookies[ACCESS_TOKEN_COOKIE]);
    const account = accountId === null ? undefined : findAccountById(accountId);
    if (!account) return errorResponse('UNAUTHORIZED');

    return HttpResponse.json(toAuthUser(account));
  }),
];
