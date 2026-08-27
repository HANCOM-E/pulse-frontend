import { HttpResponse, http } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  fetchCurrentGame,
  fetchEventByCode,
  fetchMyEvents,
  fetchOwnReport,
  fetchPublicReport,
  login,
  logout,
  setReportPublic,
} from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import { resetDb } from '@/mocks/data/store';
import { API_BASE_URL } from '@/mocks/handlers/shared';
import { server } from '@/mocks/server';

/**
 * 응답 계약 검증 테스트입니다.
 *
 * 목 핸들러가 아니라 `parseResponse`의 실패 처리를 봅니다. 계약과 다른 응답이 왔을 때
 * 값이 그대로 화면까지 흘러가지 않고 호출자가 실패를 인지하는지가 요점입니다.
 * 프로덕션에서 로그만 남기고 raw payload를 캐스팅해 반환하던 분기의 회귀 방지용입니다.
 */

const DRAFT_EVENT_CODE = 'zq1v8t';
const EVENT_CODE = 'ab3f9x';
const ENDED_EVENT_CODE = 'kd7m2p';
const SEED_CREDENTIALS = { email: 'host@example.com', password: 'pulse1234' };

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
  // 리포트 공개 여부를 뒤집는 케이스가 있어 케이스 간 격리가 필요합니다.
  resetDb();
});
afterAll(() => server.close());

describe('parseResponse', () => {
  it('계약과 다른 응답이면 INVALID_RESPONSE로 거부한다', async () => {
    server.use(
      http.get(`${API_BASE_URL}/events/:eventCode`, () =>
        // status가 빠진 응답. 필드 하나만 어긋나도 통과하면 안 됩니다.
        HttpResponse.json({
          code: EVENT_CODE,
          title: '제목',
          createdAt: '2026-08-01T09:00:00.000Z',
        }),
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

/**
 * 2026-08-07 명세부터 인증이 헤더가 아니라 HttpOnly 쿠키입니다. FE가 토큰을 손에 들고
 * 헤더에 실어 보내는 단계가 사라져서, 로그인 응답의 `Set-Cookie`가 이후 요청에 자동으로
 * 따라붙는지가 인증의 전부입니다. 그 왕복을 그대로 태워 봅니다.
 */
describe('인증 쿠키', () => {
  it('로그인 전에는 소유자 목록 조회가 UNAUTHORIZED로 거부된다', async () => {
    await expect(fetchMyEvents()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('로그인하면 목록이 오고, 로그아웃하면 다시 막힌다', async () => {
    // 응답 바디에 토큰이 없습니다. 여기서 얻는 건 유저 정보뿐입니다.
    await expect(login(SEED_CREDENTIALS)).resolves.toMatchObject({ email: SEED_CREDENTIALS.email });

    await expect(fetchMyEvents()).resolves.toHaveLength(3);

    await logout();
    await expect(fetchMyEvents()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  /**
   * `GET /events/{eventCode}/report`는 인증 여부로 응답 모양이 갈리는 유일한 경로이고,
   * 로그인 상태에서도 게스트 응답을 받아야 하는 자리가 있어 `skipAuth`(`credentials: 'omit'`)를 씁니다.
   *
   * MSW는 목 응답의 `Set-Cookie`를 자체 저장소에 담아 두는데 이 저장소가 `credentials`를 보지
   * 않습니다. 목이 그대로 받으면 브라우저가 쿠키를 빼고 보냈는데도 소유자로 판정합니다.
   * 비공개 리포트로 확인합니다 — 공개 리포트는 소유자 응답을 받아도 zod가 여분 필드를 벗겨내
   * 게스트 응답과 구분되지 않습니다.
   */
  it('로그인 상태에서도 skipAuth를 쓰면 비공개 리포트가 404로 막힌다', async () => {
    await login(SEED_CREDENTIALS);
    await setReportPublic(ENDED_EVENT_CODE, false);

    // 소유자는 공개 전 검토를 위해 계속 볼 수 있어야 합니다.
    await expect(fetchOwnReport(ENDED_EVENT_CODE)).resolves.toMatchObject({ isPublic: false });

    await expect(fetchPublicReport(ENDED_EVENT_CODE)).rejects.toMatchObject({
      code: 'REPORT_NOT_FOUND',
    });

    await logout();
  });
});

describe('fetchCurrentGame', () => {
  it('열린 게임이 있으면 계약대로 받는다', async () => {
    const game = await fetchCurrentGame(EVENT_CODE);

    expect(game?.status).toBe('OPEN');
  });

  /*
   * "열린 게임 없음"은 실패가 아니라 정상 상태입니다. 에러로 두면 useEventEntryFeed의
   * isPermanentFailure가 4xx로 보고 폴링을 멈춰서, 주최자가 나중에 열어도 화면이 모릅니다.
   */
  it('열린 게임이 없으면 null을 준다', async () => {
    await expect(fetchCurrentGame(DRAFT_EVENT_CODE)).resolves.toBeNull();
  });

  /*
   * 상태 코드가 아니라 에러 코드로 갈라야 합니다. 없는 이벤트도 404지만 이건 진짜 실패라
   * 삼키면 안 됩니다 — 배너만 조용히 안 뜨고 원인을 알 수 없게 됩니다.
   */
  it('없는 이벤트의 404는 삼키지 않는다', async () => {
    await expect(fetchCurrentGame('nope00')).rejects.toMatchObject({ code: 'EVENT_NOT_FOUND' });
  });
});
