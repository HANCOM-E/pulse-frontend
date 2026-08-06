import { http, HttpResponse } from 'msw';
import { loginRequestSchema, signupRequestSchema } from '@/lib/schemas/api';
import { db, findAccountByEmail, nextAccountId } from '@/mocks/data/store';
import { API_BASE_URL, errorResponse, parseBody } from '@/mocks/handlers/shared';

/**
 * 인증 핸들러입니다. 목은 토큰을 서명하지 않고 고정 문자열을 돌려줍니다.
 * 계정은 저장소(`db.accounts`)에 있고, 시드 계정은 host@example.com / pulse1234 입니다.
 */

const MOCK_ACCESS_TOKEN = 'mock-access-token';
const EXPIRES_IN = 3600;

export const authHandlers = [
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = await parseBody(request, loginRequestSchema);
    if (!body.ok) return body.response;

    const account = findAccountByEmail(body.data.email);

    // 없는 사용자와 비밀번호 불일치는 BE가 의도적으로 같은 코드로 병합합니다.
    if (!account || account.password !== body.data.password) {
      return errorResponse('INVALID_CREDENTIALS');
    }

    return HttpResponse.json({ accessToken: MOCK_ACCESS_TOKEN, expiresIn: EXPIRES_IN });
  }),

  http.post(`${API_BASE_URL}/auth/signup`, async ({ request }) => {
    const body = await parseBody(request, signupRequestSchema);
    if (!body.ok) return body.response;

    if (findAccountByEmail(body.data.email)) return errorResponse('EMAIL_ALREADY_EXISTS');

    // 가입 계정도 이후 로그인 대상이 돼야 하므로 비밀번호까지 저장합니다(요구사항 "1. 회원가입").
    const account = {
      id: nextAccountId(),
      email: body.data.email,
      password: body.data.password,
    };
    db.accounts.push(account);

    // 가입과 동시에 토큰을 발급합니다(자동 로그인). 별도 로그인 호출이 필요 없습니다.
    return HttpResponse.json(
      {
        id: account.id,
        email: account.email,
        createdAt: new Date().toISOString(),
        accessToken: MOCK_ACCESS_TOKEN,
        expiresIn: EXPIRES_IN,
      },
      { status: 201 },
    );
  }),
];
