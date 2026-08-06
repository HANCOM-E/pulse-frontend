import { HttpResponse, http } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fetchEventByCode, fetchMyEvents } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import { API_BASE_URL } from '@/mocks/handlers/shared';
import { server } from '@/mocks/server';

/**
 * 응답 계약 검증 테스트입니다.
 *
 * 목 핸들러가 아니라 `parseResponse`의 실패 처리를 봅니다. 계약과 다른 응답이 왔을 때
 * 값이 그대로 화면까지 흘러가지 않고 호출자가 실패를 인지하는지가 요점입니다.
 * 프로덕션에서 로그만 남기고 raw payload를 캐스팅해 반환하던 분기의 회귀 방지용입니다.
 */

const EVENT_CODE = 'ab3f9x';
const AUTH_HEADERS = { Authorization: 'Bearer mock-access-token' };

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

describe('parseResponse', () => {
  it('계약과 다른 응답이면 INVALID_RESPONSE로 거부한다', async () => {
    server.use(
      http.get(`${API_BASE_URL}/events/:eventCode`, () =>
        // status가 빠진 응답. 필드 하나만 어긋나도 통과하면 안 됩니다.
        HttpResponse.json({ code: EVENT_CODE, title: '제목', createdAt: '2026-08-01T09:00:00.000Z' }),
      ),
    );

    await expect(fetchEventByCode(EVENT_CODE)).rejects.toThrow(ApiError);
    await expect(fetchEventByCode(EVENT_CODE)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('프로덕션에서도 raw payload를 반환하지 않는다', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    server.use(
      http.get(`${API_BASE_URL}/events`, () =>
        // 봉투(`items`)가 없는 응답. 반환되면 호출부의 `.items`가 undefined가 됩니다.
        HttpResponse.json({ events: [] }),
      ),
    );

    await expect(fetchMyEvents()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('계약을 만족하는 응답은 그대로 통과한다', async () => {
    await expect(fetchEventByCode(EVENT_CODE)).resolves.toMatchObject({
      code: EVENT_CODE,
      status: 'LIVE',
    });
  });
});

describe('인증 헤더', () => {
  it('토큰이 없으면 소유자 목록 조회가 UNAUTHORIZED로 거부된다', async () => {
    await expect(fetchMyEvents()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('토큰이 있으면 목록이 온다', async () => {
    const { setStoredAccessToken, clearStoredAccessToken } = await import('@/lib/authToken');
    setStoredAccessToken(AUTH_HEADERS.Authorization.replace('Bearer ', ''));

    await expect(fetchMyEvents()).resolves.toHaveLength(3);

    clearStoredAccessToken();
  });
});
