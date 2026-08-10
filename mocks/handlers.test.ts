import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  eventViewSchema,
  feedbackListResponseSchema,
  feedbackSnapshotSchema,
  listResponseSchema,
  publicReportSchema,
  reportSchema,
  sessionSchema,
  sessionViewSchema,
  signupResponseSchema,
} from '@/lib/schemas/api';
import { db, resetDb } from '@/mocks/data/store';
import { API_BASE_URL } from '@/mocks/handlers/shared';
import { server } from '@/mocks/server';

/**
 * 목 서버 스모크 테스트입니다.
 *
 * 화면 코드가 아니라 계약을 검증합니다. 응답이 API 명세서(2026-08-06 갱신본) 스키마를
 * 만족하는지, 그리고 상태 전이(숨김 → 집계 제외)와 실패 코드가 명세대로 나오는지만 봅니다.
 */

const LIVE_EVENT_CODE = 'ab3f9x';
const ENDED_EVENT_CODE = 'kd7m2p';
const DRAFT_EVENT_CODE = 'zq1v8t';
const LIVE_SESSION_IDS = [101, 102, 103, 104];

/** 시드에서 상태가 고정된 소감들(mocks/data/seed.ts, id = 900 + 배열 순번) */
const HIDDEN_FEEDBACK_ID = 915;
const DELETED_FEEDBACK_ID = 922;

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

  it('가입한 계정으로 다시 로그인할 수 있다', async () => {
    const credentials = { email: 'new@example.com', password: 'pulse5678' };

    const signup = await call('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    expect(signup.status).toBe(201);
    const created = signupResponseSchema.parse(await signup.json());
    expect(created.id).not.toBe(1); // 시드 계정(host)과 다른 id

    const login = await call('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    expect(login.status).toBe(200);
    await expect(login.json()).resolves.toMatchObject({ expiresIn: 3600 });
  });

  it('이미 가입된 이메일이면 EMAIL_ALREADY_EXISTS를 준다', async () => {
    const response = await call('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'host@example.com', password: 'pulse1234' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
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
  it('공개 상세에는 내부 식별자(id·ownerId)가 들어가지 않는다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    const event = eventViewSchema.parse(body);
    expect(event.status).toBe('LIVE');
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('ownerId');
  });

  it('없는 code는 EVENT_NOT_FOUND를 준다', async () => {
    const response = await call('/events/nope00');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'EVENT_NOT_FOUND' });
  });

  it('세션이 0개인 이벤트는 LIVE로 못 넘어간다', async () => {
    const response = await call(`/events/${DRAFT_EVENT_CODE}`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'LIVE' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_EVENT_STATE_TRANSITION',
    });
  });

  it('이미 삭제한 이벤트를 또 지우면 EVENT_ALREADY_DELETED를 준다', async () => {
    const first = await call(`/events/${DRAFT_EVENT_CODE}`, {
      method: 'DELETE',
      headers: AUTH_HEADERS,
    });
    expect(first.status).toBe(204);

    // 삭제된 이벤트도 code로 찾아야 409가 나옵니다. 404가 나오면 조회 헬퍼를 잘못 쓴 것입니다.
    const second = await call(`/events/${DRAFT_EVENT_CODE}`, {
      method: 'DELETE',
      headers: AUTH_HEADERS,
    });

    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({ code: 'EVENT_ALREADY_DELETED' });
  });
});

describe('세션 목록', () => {
  it('공개 목록은 SessionView이고 DELETED 세션만 빠진다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/sessions`);
    const body = (await response.json()) as { items: Record<string, unknown>[] };

    expect(response.status).toBe(200);
    const sessions = listResponseSchema(sessionViewSchema).parse(body);
    // 시드의 이벤트 42는 ACTIVE 2개 + CLOSED 1개 + DELETED 1개입니다.
    expect(sessions.items.map((item) => item.id)).toEqual([101, 102, 103]);
    // 마감된 순서도 목록에는 남습니다. 빠지면 화면이 제출 전에 마감 여부를 알 수 없습니다.
    expect(sessions.items.find((item) => item.id === 103)?.status).toBe('CLOSED');

    for (const session of body.items) {
      expect(session).not.toHaveProperty('eventId');
    }
  });

  it('없는 code는 EVENT_NOT_FOUND를 준다', async () => {
    const response = await call('/events/nope00/sessions');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'EVENT_NOT_FOUND' });
  });
});

describe('세션 생성·삭제', () => {
  it('새로 만든 세션은 CLOSED다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/sessions`, {
      method: 'POST',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '4부: 네트워킹', order: 4 }),
    });

    expect(response.status).toBe(201);
    // 생성하자마자 소감을 받으면 안 됩니다. 발표 시작 시점에 소유자가 직접 엽니다.
    await expect(response.json()).resolves.toMatchObject({ status: 'CLOSED' });
  });

  it('이미 삭제한 세션을 또 지우면 SESSION_ALREADY_DELETED를 준다', async () => {
    const first = await call(`/events/${LIVE_EVENT_CODE}/sessions/101`, {
      method: 'DELETE',
      headers: AUTH_HEADERS,
    });
    expect(first.status).toBe(204);

    const second = await call(`/events/${LIVE_EVENT_CODE}/sessions/101`, {
      method: 'DELETE',
      headers: AUTH_HEADERS,
    });

    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({ code: 'SESSION_ALREADY_DELETED' });
  });
});

describe('세션 수정', () => {
  it('title만 주면 title만 바뀌고 order는 그대로다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/sessions/101`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '1부: 오프닝 키노트' }),
    });

    expect(response.status).toBe(200);
    const session = sessionSchema.parse(await response.json());
    expect(session).toMatchObject({ id: 101, title: '1부: 오프닝 키노트', order: 1 });
  });

  it('order만 주면 order만 바뀌고 title은 그대로다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/sessions/101`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: 2 }),
    });

    expect(response.status).toBe(200);
    const session = sessionSchema.parse(await response.json());
    expect(session).toMatchObject({ id: 101, title: '1부: 키노트', order: 2 });
  });

  it('title·order 둘 다 주면 둘 다 바뀌고, 저장소에도 반영된다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/sessions/101`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '1부: 오프닝 키노트', order: 2 }),
    });

    expect(response.status).toBe(200);
    const session = sessionSchema.parse(await response.json());
    expect(session).toMatchObject({ id: 101, title: '1부: 오프닝 키노트', order: 2 });

    // PATCH 응답만이 아니라 저장소 자체가 바뀌었는지 별도 GET으로 확인합니다.
    const list = await call(`/events/${LIVE_EVENT_CODE}/sessions`);
    const { items } = listResponseSchema(sessionViewSchema).parse(await list.json());
    expect(items.find((item) => item.id === 101)).toMatchObject({
      title: '1부: 오프닝 키노트',
      order: 2,
    });
  });

  it('status=ACTIVE로 열면 마감됐던 세션에 소감을 낼 수 있다', async () => {
    const opened = await call(`/events/${LIVE_EVENT_CODE}/sessions/103`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });

    expect(opened.status).toBe(200);
    expect(sessionSchema.parse(await opened.json()).status).toBe('ACTIVE');

    // 마감 해제가 저장소에 반영되지 않으면 제출이 계속 409로 막힙니다.
    const submitted = await call(`/events/${LIVE_EVENT_CODE}/feedbacks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'client-reopen' },
      body: JSON.stringify({
        sessionId: 103,
        text: '다시 열린 세션에 남기는 소감',
        sentiment: 'POS',
        toxic: false,
        keywords: [],
        taggerVersion: 'kobert-sent-v1',
      }),
    });
    expect(submitted.status).toBe(201);
  });

  it('삭제된 세션은 SESSION_NOT_FOUND라 status로 되살릴 수 없다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/sessions/104`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });

  it('소유자가 아니면 NOT_OWNER를 준다', async () => {
    // 시드에는 HOST_USER 소유 이벤트만 있어서, 소유자 불일치를 재현하려면 다른 ownerId의
    // 이벤트를 직접 심어야 합니다. 세션 존재 여부와 무관하게 소유자 확인이 먼저 걸립니다.
    db.events.push({
      id: 999,
      code: 'other1',
      title: '다른 사람 이벤트',
      description: null,
      ownerId: 999,
      status: 'LIVE',
      createdAt: '2026-08-01T09:00:00.000Z',
    });

    const response = await call('/events/other1/sessions/1', {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '수정 시도' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'NOT_OWNER' });
  });

  it('없는 세션이면 SESSION_NOT_FOUND를 준다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/sessions/9999`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '없는 세션' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });

  it('다른 이벤트 소속 세션이면 SESSION_NOT_FOUND를 준다', async () => {
    // 세션 201은 존재하지만 이벤트 43(ENDED) 소속입니다. eventId 불일치도 존재 자체와
    // 똑같이 404로 나와야 합니다 — 다른 이벤트 세션 id를 넣어보면 존재 여부를 추측할 수 있게 됩니다.
    const response = await call(`/events/${LIVE_EVENT_CODE}/sessions/201`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '남의 세션' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'SESSION_NOT_FOUND' });
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

  it('includeHidden 기본값에서는 HIDDEN·DELETED가 큐에 안 나온다', async () => {
    const queue = feedbackListResponseSchema.parse(
      await (
        await call(`/admin/feedbacks?eventCode=${LIVE_EVENT_CODE}`, { headers: AUTH_HEADERS })
      ).json(),
    );

    expect(queue.items.length).toBeGreaterThan(0);
    expect(queue.items.every((item) => item.status === 'VISIBLE')).toBe(true);
  });

  it('includeHidden=true면 HIDDEN이 들어오고 DELETED는 여전히 빠진다', async () => {
    const queue = feedbackListResponseSchema.parse(
      await (
        await call(`/admin/feedbacks?eventCode=${LIVE_EVENT_CODE}&includeHidden=true`, {
          headers: AUTH_HEADERS,
        })
      ).json(),
    );

    expect(queue.items.some((item) => item.id === HIDDEN_FEEDBACK_ID)).toBe(true);
    expect(queue.items.some((item) => item.status === 'DELETED')).toBe(false);
  });

  it('includeHidden이 boolean이 아니면 VALIDATION_ERROR를 준다', async () => {
    const response = await call(`/admin/feedbacks?includeHidden=yes`, { headers: AUTH_HEADERS });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('숨김 해제하면 다시 집계에 들어온다', async () => {
    const before = feedbackSnapshotSchema.parse(
      await (await call(`/events/${LIVE_EVENT_CODE}/feedbacks?sessionId=102`)).json(),
    );

    const shown = await call(`/admin/feedbacks/${HIDDEN_FEEDBACK_ID}/show`, {
      method: 'PATCH',
      headers: AUTH_HEADERS,
    });
    expect(shown.status).toBe(200);
    await expect(shown.json()).resolves.toMatchObject({ status: 'VISIBLE' });

    const after = feedbackSnapshotSchema.parse(
      await (await call(`/events/${LIVE_EVENT_CODE}/feedbacks?sessionId=102`)).json(),
    );
    expect(after.recentFeedbacks.length).toBe(before.recentFeedbacks.length + 1);
  });

  it('숨김 해제도 토큰이 없으면 UNAUTHORIZED를 준다', async () => {
    const response = await call(`/admin/feedbacks/${HIDDEN_FEEDBACK_ID}/show`, { method: 'PATCH' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('이미 삭제된 소감은 hide·show 모두 FEEDBACK_ALREADY_DELETED를 준다', async () => {
    for (const action of ['hide', 'show']) {
      const response = await call(`/admin/feedbacks/${DELETED_FEEDBACK_ID}/${action}`, {
        method: 'PATCH',
        headers: AUTH_HEADERS,
      });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({ code: 'FEEDBACK_ALREADY_DELETED' });
    }
  });

  it('삭제된 이벤트의 소감은 큐에서 빠진다', async () => {
    const before = feedbackListResponseSchema.parse(
      await (await call('/admin/feedbacks', { headers: AUTH_HEADERS })).json(),
    );
    expect(before.items.some((item) => LIVE_SESSION_IDS.includes(item.sessionId))).toBe(true);

    const deleted = await call(`/events/${LIVE_EVENT_CODE}`, {
      method: 'DELETE',
      headers: AUTH_HEADERS,
    });
    expect(deleted.status).toBe(204);

    const after = feedbackListResponseSchema.parse(
      await (await call('/admin/feedbacks', { headers: AUTH_HEADERS })).json(),
    );

    // 삭제한 이벤트의 소감만 빠지고, 다른 이벤트 소감은 그대로 남아야 합니다.
    expect(after.items.some((item) => LIVE_SESSION_IDS.includes(item.sessionId))).toBe(false);
    expect(after.items.length).toBeGreaterThan(0);
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

  it('이벤트가 LIVE여도 세션이 마감이면 SESSION_CLOSED를 준다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/feedbacks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'client-closed' },
      body: JSON.stringify({
        sessionId: 103,
        text: '마감된 순서에 남기는 소감',
        sentiment: 'NEU',
        toxic: false,
        keywords: [],
        taggerVersion: 'kobert-sent-v1',
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'SESSION_CLOSED' });
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
  it('게스트가 공개된 리포트를 조회하면 PublicReport만 온다', async () => {
    const response = await call(`/events/${ENDED_EVENT_CODE}/report`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    const report = publicReportSchema.parse(body);
    expect(report.summaryText.length).toBeGreaterThan(0);
    // 같은 경로라도 비인증 응답에는 관리 필드가 없어야 합니다.
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('isPublic');
  });

  it('같은 경로를 주최자가 부르면 Report 전체가 온다', async () => {
    const response = await call(`/events/${ENDED_EVENT_CODE}/report`, { headers: AUTH_HEADERS });

    expect(response.status).toBe(200);
    const report = reportSchema.parse(await response.json());
    expect(report).toMatchObject({ status: 'GENERATED', isPublic: true });
  });

  it('리포트가 없으면 REPORT_NOT_FOUND를 준다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/report`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'REPORT_NOT_FOUND' });
  });

  it('ENDED가 아닌 이벤트는 리포트를 생성할 수 없다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/report/generate`, {
      method: 'POST',
      headers: AUTH_HEADERS,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'EVENT_NOT_ENDED' });
  });

  it('공개 여부를 끄면 게스트 조회는 404지만 주최자는 계속 볼 수 있다', async () => {
    const patched = await call(`/events/${ENDED_EVENT_CODE}/report`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: false }),
    });
    expect(patched.status).toBe(200);
    await expect(patched.json()).resolves.toMatchObject({ isPublic: false });

    expect((await call(`/events/${ENDED_EVENT_CODE}/report`)).status).toBe(404);

    // "비공개 = 게스트한테만 안 보임". 소유자는 공개 전 검토를 위해 항상 볼 수 있어야 합니다.
    const owner = await call(`/events/${ENDED_EVENT_CODE}/report`, { headers: AUTH_HEADERS });
    expect(owner.status).toBe(200);
    await expect(owner.json()).resolves.toMatchObject({ isPublic: false });
  });

  it('리포트가 없는 이벤트에 공개 토글을 걸면 REPORT_NOT_FOUND를 준다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/report`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: true }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'REPORT_NOT_FOUND' });
  });

  it('공개 토글에 토큰이 없으면 UNAUTHORIZED를 준다', async () => {
    const response = await call(`/events/${ENDED_EVENT_CODE}/report`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: false }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
