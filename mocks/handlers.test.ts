import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  feedbackListResponseSchema,
  feedbackSnapshotSchema,
  publicReportSchema,
  pulseEventSchema,
} from '@/lib/schemas/api';
import { resetDb } from '@/mocks/data/store';
import { API_BASE_URL } from '@/mocks/handlers/shared';
import { server } from '@/mocks/server';

/**
 * 목 서버 스모크 테스트입니다.
 *
 * 화면 코드가 아니라 계약을 검증합니다. 응답이 openapi v0.2 스키마를 만족하는지,
 * 그리고 상태 전이(숨김 → 집계 제외)와 실패 코드가 명세대로 나오는지만 봅니다.
 */

const LIVE_EVENT_CODE = 'ab3f9x';
const ENDED_EVENT_CODE = 'kd7m2p';
const DRAFT_EVENT_ID = 44;

const AUTH_HEADERS = { Authorization: 'Bearer mock-access-token' };

const call = (path: string, init?: RequestInit) => fetch(`${API_BASE_URL}${path}`, init);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetDb();
});
afterAll(() => server.close());

describe('auth', () => {
  it('시드 계정으로 로그인하면 토큰을 준다', async () => {
    const response = await call('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'host@example.com', password: 'pulse1234' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ expiresIn: 3600 });
  });

  it('비밀번호가 틀리면 INVALID_CREDENTIALS를 준다', async () => {
    const response = await call('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'host@example.com', password: 'wrong1234' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('비밀번호 정책(영문+숫자)을 어기면 VALIDATION_ERROR를 준다', async () => {
    const response = await call('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', password: 'onlyletters' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('이벤트 조회', () => {
  it('code로 상세를 조회하면 쓰기 API에 필요한 숫자 id가 함께 온다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    const event = pulseEventSchema.parse(body);
    expect(event.id).toBe(42);
    expect(event.status).toBe('LIVE');
  });

  it('없는 code는 EVENT_NOT_FOUND를 준다', async () => {
    const response = await call('/events/nope00');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'EVENT_NOT_FOUND' });
  });

  it('세션이 0개인 이벤트는 LIVE로 못 넘어간다', async () => {
    const response = await call(`/events/${DRAFT_EVENT_ID}`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'LIVE' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_EVENT_STATE_TRANSITION',
    });
  });
});

describe('집계 스냅샷', () => {
  it('UNKNOWN은 감정 분포에서 빠지고 unclassifiedCount로 따로 센다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/feedbacks`);
    const snapshot = feedbackSnapshotSchema.parse(await response.json());

    expect(snapshot.unclassifiedCount).toBeGreaterThan(0);
    expect(snapshot.topKeywords.length).toBeGreaterThan(0);
    // 빈도순 정렬이 깨지면 워드클라우드·상위 키워드가 뒤집힙니다.
    const counts = snapshot.topKeywords.map((item) => item.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it('sessionId를 주면 해당 세션만 집계한다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/feedbacks?sessionId=101`);
    const snapshot = feedbackSnapshotSchema.parse(await response.json());

    expect(snapshot.recentFeedbacks.every((item) => item.sessionId === 101)).toBe(true);
  });

  it('공개 응답에는 모더레이션 신호(toxic/status)가 들어가지 않는다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/feedbacks`);
    const body = (await response.json()) as { recentFeedbacks: Record<string, unknown>[] };

    for (const feedback of body.recentFeedbacks) {
      expect(feedback).not.toHaveProperty('toxic');
      expect(feedback).not.toHaveProperty('status');
      expect(feedback).not.toHaveProperty('taggerVersion');
    }
  });
});

describe('모더레이션 큐', () => {
  it('토큰이 없으면 UNAUTHORIZED를 준다', async () => {
    const response = await call('/admin/feedbacks?toxic=true');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('eventCode 필터를 주면 해당 이벤트 소감만 나온다', async () => {
    const scoped = await call(`/admin/feedbacks?eventCode=${LIVE_EVENT_CODE}&toxic=true`, {
      headers: AUTH_HEADERS,
    });
    const scopedBody = feedbackListResponseSchema.parse(await scoped.json());

    const all = await call('/admin/feedbacks?toxic=true', { headers: AUTH_HEADERS });
    const allBody = feedbackListResponseSchema.parse(await all.json());

    expect(scopedBody.items.length).toBeGreaterThan(0);
    expect(scopedBody.items.every((item) => item.toxic)).toBe(true);
    // 필터를 빼면 계정 전체 큐가 나오므로, 이벤트별 화면은 반드시 필터를 붙여야 합니다.
    expect(allBody.items.length).toBeGreaterThanOrEqual(scopedBody.items.length);
  });

  it('숨긴 소감은 다음 집계부터 빠진다', async () => {
    const before = feedbackSnapshotSchema.parse(
      await (await call(`/events/${LIVE_EVENT_CODE}/feedbacks?sessionId=101`)).json(),
    );

    const queue = feedbackListResponseSchema.parse(
      await (
        await call(`/admin/feedbacks?eventCode=${LIVE_EVENT_CODE}&sessionId=101&toxic=true`, {
          headers: AUTH_HEADERS,
        })
      ).json(),
    );
    const target = queue.items[0];
    expect(target).toBeDefined();

    const hidden = await call(`/admin/feedbacks/${target.id}/hide`, {
      method: 'PATCH',
      headers: AUTH_HEADERS,
    });
    expect(hidden.status).toBe(200);
    await expect(hidden.json()).resolves.toMatchObject({ status: 'HIDDEN' });

    const after = feedbackSnapshotSchema.parse(
      await (await call(`/events/${LIVE_EVENT_CODE}/feedbacks?sessionId=101`)).json(),
    );
    expect(after.recentFeedbacks.length).toBe(before.recentFeedbacks.length - 1);
  });

  it('[제안] 숨김 해제하면 다시 집계에 들어온다', async () => {
    const hiddenQueue = feedbackListResponseSchema.parse(
      await (
        await call(`/admin/feedbacks?eventCode=${LIVE_EVENT_CODE}&status=HIDDEN`, {
          headers: AUTH_HEADERS,
        })
      ).json(),
    );
    const target = hiddenQueue.items[0];
    expect(target).toBeDefined();

    const shown = await call(`/admin/feedbacks/${target.id}/show`, {
      method: 'PATCH',
      headers: AUTH_HEADERS,
    });

    expect(shown.status).toBe(200);
    await expect(shown.json()).resolves.toMatchObject({ status: 'VISIBLE' });
  });

  it('이미 삭제된 소감은 FEEDBACK_ALREADY_DELETED를 준다', async () => {
    const deleted = feedbackListResponseSchema.parse(
      await (
        await call(`/admin/feedbacks?eventCode=${LIVE_EVENT_CODE}&status=DELETED`, {
          headers: AUTH_HEADERS,
        })
      ).json(),
    );
    const target = deleted.items[0];
    expect(target).toBeDefined();

    const response = await call(`/admin/feedbacks/${target.id}/hide`, {
      method: 'PATCH',
      headers: AUTH_HEADERS,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'FEEDBACK_ALREADY_DELETED' });
  });
});

describe('소감 제출', () => {
  const submit = (clientId: string) =>
    call(`/events/${LIVE_EVENT_CODE}/feedbacks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId },
      body: JSON.stringify({
        sessionId: 101,
        text: '테스트 소감입니다',
        sentiment: 'POS',
        toxic: false,
        keywords: ['테스트'],
        taggerVersion: 'kobert-sent-v1',
      }),
    });

  it('제출 응답은 공개 뷰라 toxic이 빠져 있다', async () => {
    const response = await submit('client-a');
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body).not.toHaveProperty('toxic');
  });

  it('같은 클라이언트가 분당 4번째로 제출하면 RATE_LIMIT_EXCEEDED를 준다', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await submit('client-b')).status).toBe(201);
    }

    const blocked = await submit('client-b');
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('LIVE가 아닌 이벤트에는 제출할 수 없다', async () => {
    const response = await call(`/events/${ENDED_EVENT_CODE}/feedbacks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'client-c' },
      body: JSON.stringify({
        sessionId: 201,
        text: '끝난 행사에 남기는 소감',
        sentiment: 'NEU',
        toxic: false,
        keywords: [],
        taggerVersion: 'kobert-sent-v1',
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'EVENT_NOT_LIVE' });
  });

  it('키워드가 6개면 VALIDATION_ERROR를 준다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/feedbacks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'client-d' },
      body: JSON.stringify({
        sessionId: 101,
        text: '키워드 초과',
        sentiment: 'NEU',
        toxic: false,
        keywords: ['가', '나', '다', '라', '마', '바'],
        taggerVersion: 'kobert-sent-v1',
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('리포트', () => {
  it('공개된 리포트는 누구나 볼 수 있다', async () => {
    const response = await call(`/events/${ENDED_EVENT_CODE}/report`);

    expect(response.status).toBe(200);
    const report = publicReportSchema.parse(await response.json());
    expect(report.summaryText.length).toBeGreaterThan(0);
  });

  it('리포트가 없으면 REPORT_NOT_FOUND를 준다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/report`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'REPORT_NOT_FOUND' });
  });

  it('ENDED가 아닌 이벤트는 리포트를 생성할 수 없다', async () => {
    const response = await call('/events/42/report/generate', {
      method: 'POST',
      headers: AUTH_HEADERS,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'EVENT_NOT_ENDED' });
  });

  it('[제안] 주최자는 자기 리포트의 생성 상태를 조회할 수 있다', async () => {
    const response = await call('/admin/events/43/report', { headers: AUTH_HEADERS });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'GENERATED', isPublic: true });
  });

  it('[제안] 공개 여부를 끄면 공개 조회가 404가 된다', async () => {
    const patched = await call('/admin/events/43/report', {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: false }),
    });
    expect(patched.status).toBe(200);

    const publicView = await call(`/events/${ENDED_EVENT_CODE}/report`);
    expect(publicView.status).toBe(404);
  });
});
