import { http, HttpResponse } from 'msw';
import { loginRequestSchema, signupRequestSchema } from '@/lib/schemas/api';
import { HOST_USER } from '@/mocks/data/store';
import { API_BASE_URL, errorResponse, parseBody } from '@/mocks/handlers/shared';

/**
 * 인증 핸들러입니다. 목은 토큰을 서명하지 않고 고정 문자열을 돌려줍니다.
 * 시드 계정: host@example.com / pulse1234
 */

const MOCK_ACCESS_TOKEN = 'mock-access-token';
const EXPIRES_IN = 3600;

/** 목 프로세스가 살아 있는 동안만 유지되는 가입 이메일 목록입니다. */
const registeredEmails = new Set<string>([HOST_USER.email]);

export const authHandlers = [
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = await parseBody(request, loginRequestSchema);
    if (!body.ok) return body.response;

    const isKnownAccount =
      body.data.email === HOST_USER.email && body.data.password === HOST_USER.password;

    // 없는 사용자와 비밀번호 불일치는 BE가 의도적으로 같은 코드로 병합합니다.
    if (!isKnownAccount) return errorResponse('INVALID_CREDENTIALS');

    return HttpResponse.json({ accessToken: MOCK_ACCESS_TOKEN, expiresIn: EXPIRES_IN });
  }),

  http.post(`${API_BASE_URL}/auth/signup`, async ({ request }) => {
    const body = await parseBody(request, signupRequestSchema);
    if (!body.ok) return body.response;

    if (registeredEmails.has(body.data.email)) return errorResponse('EMAIL_ALREADY_EXISTS');
    registeredEmails.add(body.data.email);

    // 가입과 동시에 토큰을 발급합니다(자동 로그인). 별도 로그인 호출이 필요 없습니다.
    return HttpResponse.json(
      {
        id: registeredEmails.size,
        email: body.data.email,
        createdAt: new Date().toISOString(),
        accessToken: MOCK_ACCESS_TOKEN,
        expiresIn: EXPIRES_IN,
      },
      { status: 201 },
    );
  }),
];
