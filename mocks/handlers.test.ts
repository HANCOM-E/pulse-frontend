import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  authUserSchema,
  eventViewSchema,
  feedbackListResponseSchema,
  feedbackSnapshotSchema,
  gameParticipantSchema,
  gameViewSchema,
  listResponseSchema,
  publicReportSchema,
  pulseEventSchema,
  reportSchema,
  sessionSchema,
  sessionViewSchema,
} from '@/lib/schemas/api';
import { db, nextAccountId, resetDb } from '@/mocks/data/store';
import { createAuthHandlers } from '@/mocks/handlers/auth';
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

/**
 * 인증은 HttpOnly 쿠키입니다(2026-08-07 명세). 목은 토큰을 검증하지 않고 존재만 보지만,
 * `GET /auth/me`가 계정을 되찾아야 해서 값에 시드 계정 id(1)를 담아 둡니다.
 */
const AUTH_HEADERS = { Cookie: 'accessToken=mock-access-token-1' };

const call = (path: string, init?: RequestInit) => fetch(`${API_BASE_URL}${path}`, init);

/**
 * `Set-Cookie`를 쿠키별로 갈라 놓습니다.
 *
 * `headers.get('Set-Cookie')`는 두 쿠키를 `, `로 이어 붙인 한 문자열을 줘서, 거기에 대고
 * `HttpOnly`를 찾으면 그게 어느 쿠키에 붙은 속성인지 구분되지 않습니다. 두 쿠키의 속성이
 * 서로 달라야 하는 게 이 테스트의 요점이라 `getSetCookie()`로 나눠서 봅니다.
 */
const splitSetCookie = (response: Response) => {
  const cookies = response.headers.getSetCookie();
  const find = (name: string) => {
    const cookie = cookies.find((value) => value.startsWith(`${name}=`));
    expect(cookie, `${name} 쿠키가 응답에 없습니다`).toBeDefined();
    return cookie as string;
  };

  return { accessToken: find('accessToken'), xsrfToken: find('XSRF-TOKEN') };
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetDb();
});
afterAll(() => server.close());

describe('auth', () => {
  it('시드 계정으로 로그인하면 토큰이 아니라 쿠키를 준다', async () => {
    const response = await call('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'host@example.com', password: 'pulse1234' }),
    });

    expect(response.status).toBe(200);

    // 토큰이 바디에 실리면 FE가 그 값을 저장하는 코드로 되돌아갑니다.
    const body = (await response.json()) as Record<string, unknown>;
    expect(authUserSchema.parse(body).email).toBe('host@example.com');
    expect(body).not.toHaveProperty('accessToken');

    const { accessToken, xsrfToken } = splitSetCookie(response);
    // 이 테스트는 mocks/server.ts(msw/node)를 쓰므로 Service Worker를 거치지 않습니다.
    // 계약 테스트인 만큼 명세대로 accessToken에 HttpOnly가 붙어야 합니다. 브라우저에서만
    // HttpOnly를 빼는 예외(이슈 #128)는 아래 별도 테스트가 검증합니다.
    expect(accessToken).toContain('HttpOnly');
    // CSRF 토큰은 FE가 읽어서 헤더로 되돌려 보내야 해서 HttpOnly면 안 됩니다.
    expect(xsrfToken).not.toContain('HttpOnly');
  });

  it('브라우저 목은 accessToken에 HttpOnly를 붙이지 않는다 (이슈 #128)', async () => {
    // Service Worker가 가로챈 응답은 HttpOnly Set-Cookie를 브라우저 저장소에 반영하지
    // 못해서(mocks/handlers/auth.ts의 sessionCookies 주석 참고), mocks/browser.ts는
    // httpOnly: false로 이 핸들러를 띄웁니다. 여기서는 같은 옵션으로 만든 핸들러를
    // 이 테스트에서만 잠깐 끼워 넣어(server.use) 그 동작을 직접 검증합니다.
    server.use(...createAuthHandlers({ httpOnly: false }));

    const response = await call('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'host@example.com', password: 'pulse1234' }),
    });

    const { accessToken, xsrfToken } = splitSetCookie(response);
    expect(accessToken).not.toContain('HttpOnly');
    expect(xsrfToken).not.toContain('HttpOnly');
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
    const created = authUserSchema.parse(await signup.json());
    expect(created.id).not.toBe(1); // 시드 계정(host)과 다른 id

    const login = await call('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    expect(login.status).toBe(200);
    await expect(login.json()).resolves.toMatchObject({ id: created.id, email: credentials.email });
  });

  it('쿠키가 있으면 /auth/me가 그 계정을 돌려준다', async () => {
    const response = await call('/auth/me', { headers: AUTH_HEADERS });

    expect(response.status).toBe(200);
    expect(authUserSchema.parse(await response.json()).email).toBe('host@example.com');
  });

  it('쿠키가 없으면 /auth/me는 UNAUTHORIZED를 준다', async () => {
    const response = await call('/auth/me');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('로그아웃은 204와 함께 두 쿠키를 모두 만료시킨다', async () => {
    const response = await call('/auth/logout', { method: 'POST', headers: AUTH_HEADERS });

    expect(response.status).toBe(204);

    // 하나만 만료시키면 CSRF 토큰이 브라우저에 남습니다.
    const { accessToken, xsrfToken } = splitSetCookie(response);
    expect(accessToken).toContain('Max-Age=0');
    expect(xsrfToken).toContain('Max-Age=0');
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

/**
 * 목이 쿠키의 존재만 보고 전부 통과시키면, 가입만 한 계정이 남의 이벤트를 수정하고
 * 모더레이션 큐를 열 수 있습니다. 화면이 그 위에 붙으면 권한 분기를 테스트할 수 없습니다.
 */
describe('다른 계정의 자원 접근', () => {
  /**
   * 시드 호스트가 아닌 계정을 만들고 그 계정의 쿠키를 돌려줍니다.
   *
   * `/auth/signup`을 부르지 않고 저장소에 직접 넣습니다. 목이 응답에 실은 `Set-Cookie`는
   * MSW의 쿠키 저장소에 남아 뒤따르는 "쿠키 없음" 케이스까지 로그인 상태로 만듭니다.
   */
  const createOtherAccount = (): Record<string, string> => {
    const account = {
      id: nextAccountId(),
      email: 'other@example.com',
      password: 'pulse5678',
      createdAt: '2026-08-09T00:00:00.000Z',
    };
    db.accounts.push(account);

    return { Cookie: `accessToken=mock-access-token-${account.id}` };
  };

  it('내 이벤트 목록에 남의 이벤트가 섞이지 않는다', async () => {
    const other = createOtherAccount();
    const response = await call('/events', { headers: other });

    expect(response.status).toBe(200);
    // 시드 이벤트 3개는 전부 호스트 소유입니다. 가입 직후라 자기 이벤트는 없습니다.
    const { items } = listResponseSchema(pulseEventSchema).parse(await response.json());
    expect(items).toHaveLength(0);
  });

  it('남의 이벤트를 수정하면 NOT_OWNER를 준다', async () => {
    const other = createOtherAccount();
    const response = await call(`/events/${LIVE_EVENT_CODE}`, {
      method: 'PATCH',
      headers: { ...other, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '남의 이벤트 수정 시도' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'NOT_OWNER' });
  });

  it('모더레이션 큐에 남의 소감이 나오지 않는다', async () => {
    const other = createOtherAccount();
    const response = await call('/admin/feedbacks', { headers: other });

    expect(response.status).toBe(200);
    const { items } = feedbackListResponseSchema.parse(await response.json());
    expect(items).toHaveLength(0);
  });

  it('남의 비공개 리포트는 소유자 응답이 아니라 404다', async () => {
    const other = createOtherAccount();

    const hidden = await call(`/events/${ENDED_EVENT_CODE}/report`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: false }),
    });
    expect(hidden.status).toBe(200);

    const response = await call(`/events/${ENDED_EVENT_CODE}/report`, { headers: other });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'REPORT_NOT_FOUND' });
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

  /*
   * 2026-08-12 명세로 들어온 필드입니다. 행사 당일(`eventDate`)과 이벤트를 만든 시각
   * (`createdAt`)이 다른 값이라는 게 요점이라, 존재만 보지 않고 시드의 실제 값을 확인합니다.
   */
  it('공개 상세에 행사 날짜가 실리고 생성 시각과 구분된다', async () => {
    const response = await call(`/events/${DRAFT_EVENT_CODE}`);
    const event = eventViewSchema.parse(await response.json());

    expect(event.eventDate).toBe('2026-09-01');
    expect(event.createdAt.slice(0, 10)).toBe('2026-08-04');
  });

  it('행사 날짜 없이 이벤트를 만들면 VALIDATION_ERROR를 준다', async () => {
    const response = await call('/events', {
      method: 'POST',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '날짜 빠진 이벤트' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('시각이 붙은 문자열은 행사 날짜로 받지 않는다', async () => {
    const response = await call('/events', {
      method: 'POST',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '형식 틀린 이벤트', eventDate: '2026-09-01T00:00:00.000Z' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('행사 날짜만 보내면 그 값만 바뀐다', async () => {
    const before = pulseEventSchema.parse(
      (await (await call('/events', { headers: AUTH_HEADERS })).json()).items.find(
        (item: { code: string }) => item.code === DRAFT_EVENT_CODE,
      ),
    );

    const response = await call(`/events/${DRAFT_EVENT_CODE}`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventDate: '2026-09-15' }),
    });

    expect(response.status).toBe(200);
    const after = pulseEventSchema.parse(await response.json());
    expect(after.eventDate).toBe('2026-09-15');
    expect(after.title).toBe(before.title);
    expect(after.status).toBe(before.status);
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
      eventDate: '2026-08-05',
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
    const scoped = await call(
      `/admin/feedbacks?eventCode=${LIVE_EVENT_CODE}&toxic=true&includeHidden=true`,
      { headers: AUTH_HEADERS },
    );
    const scopedBody = feedbackListResponseSchema.parse(await scoped.json());

    const all = await call('/admin/feedbacks?toxic=true&includeHidden=true', {
      headers: AUTH_HEADERS,
    });

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
        await call(`/admin/feedbacks?eventCode=${LIVE_EVENT_CODE}&sessionId=101`, {
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

  it('독성으로 태깅된 소감은 HIDDEN으로 저장되어 공개 스냅샷에 안 나온다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/feedbacks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'client-toxic' },
      body: JSON.stringify({
        sessionId: 101,
        text: '시발 뭐라는 건지 하나도 모르겠네',
        sentiment: 'NEG',
        toxic: true,
        keywords: [],
        taggerVersion: 'koelectra-small-v3-nsmc-q8+tau-1.2',
      }),
    });

    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: number };

    // 저장 상태는 관리자 큐로만 확인합니다. 공개 응답에는 status가 없습니다.
    const queue = (await (
      await call(`/admin/feedbacks?eventCode=${LIVE_EVENT_CODE}&includeHidden=true`, {
        headers: AUTH_HEADERS,
      })
    ).json()) as { items: { id: number; status: string }[] };

    expect(queue.items.find((item) => item.id === id)?.status).toBe('HIDDEN');

    // 집계와 최근 피드에서 빠져야 실시간 지표에 욕설이 안 뜹니다.
    const snapshot = (await (
      await call(`/events/${LIVE_EVENT_CODE}/feedbacks?sessionId=101`)
    ).json()) as { recentFeedbacks: { id: number }[] };

    expect(snapshot.recentFeedbacks.some((item) => item.id === id)).toBe(false);
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

  it('리포트의 미분류 건수가 같은 이벤트의 집계 스냅샷과 일치한다', async () => {
    const snapshot = feedbackSnapshotSchema.parse(
      await (await call(`/events/${ENDED_EVENT_CODE}/feedbacks`)).json(),
    );
    const report = publicReportSchema.parse(
      await (await call(`/events/${ENDED_EVENT_CODE}/report`)).json(),
    );

    /*
     * 감정 분포는 UNKNOWN을 빼고 세므로 POS+NEU+NEG가 분석 총 건수보다 작습니다.
     * 이 필드가 없으면 화면이 분모를 복원할 수 없어 비율이 실제보다 부풀어 보입니다.
     */
    expect(snapshot.unclassifiedCount).toBeGreaterThan(0);
    expect(report.unclassifiedCount).toBe(snapshot.unclassifiedCount);
    expect(report.sentimentBreakdown).toEqual(snapshot.sentimentBreakdown);
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

describe('게임', () => {
  /** 시드 게임(mock/data/seed.ts) */
  const FINISHED_GAME_ID = 1;
  const OPEN_GAME_ID = 2;

  const createGame = (title: string) =>
    call(`/events/${LIVE_EVENT_CODE}/games`, {
      method: 'POST',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

  const patchGame = (gameId: number, status: string) =>
    call(`/events/${LIVE_EVENT_CODE}/games/${gameId}`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

  const joinGame = (gameId: number, nickname: string, clientId: string) =>
    call(`/events/${LIVE_EVENT_CODE}/games/${gameId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId },
      body: JSON.stringify({ nickname }),
    });

  /*
   * 참가자 목록이 프로젝터와 폰에 그대로 뿌려집니다. 브라우저 식별자가 섞여 나가면
   * 누가 어떤 소감을 냈는지 추적할 여지가 생깁니다. 스키마 통과만으로는 못 잡습니다 —
   * zod가 모르는 키를 조용히 떨구기 때문에 직렬화한 문자열을 직접 봅니다.
   */
  it('공개 조회에 clientId가 실리지 않는다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/games/${OPEN_GAME_ID}`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    const game = gameViewSchema.parse(body);
    expect(game.status).toBe('OPEN');
    expect(JSON.stringify(body)).not.toContain('clientId');
    expect(JSON.stringify(body)).not.toContain('seed-client-');
  });

  it('participantCount는 명단 길이와 같다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/games/${OPEN_GAME_ID}`);
    const game = gameViewSchema.parse(await response.json());

    expect(game.participantCount).toBe(game.participants.length);
  });

  it('다른 이벤트의 gameId는 GAME_NOT_FOUND를 준다', async () => {
    const response = await call(`/events/${DRAFT_EVENT_CODE}/games/${OPEN_GAME_ID}`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'GAME_NOT_FOUND' });
  });

  it('current는 가장 최근 게임을 준다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/games/current`);
    const game = gameViewSchema.parse(await response.json());

    expect(game.id).toBe(OPEN_GAME_ID);
  });

  /*
   * 소감 화면 배너가 이 응답만 보고 자기를 띄웁니다. DRAFT가 잡히면 주최자가 아직 열지
   * 않은 게임에 참가자가 들어가려다 GAME_NOT_OPEN을 맞습니다.
   */
  it('current는 DRAFT를 잡지 않는다', async () => {
    const created = await createGame('아직 안 연 게임');
    expect(created.status).toBe(201);
    const draft = gameViewSchema.parse(await created.json());
    expect(draft.status).toBe('DRAFT');
    // gameType을 안 보냈는데도 채워집니다(스키마 기본값).
    expect(draft.gameType).toBe('PINBALL');

    const response = await call(`/events/${LIVE_EVENT_CODE}/games/current`);
    const current = gameViewSchema.parse(await response.json());

    expect(current.id).toBe(OPEN_GAME_ID);
    expect(current.id).not.toBe(draft.id);
  });

  it('열면 current가 그 게임으로 바뀐다', async () => {
    const draft = gameViewSchema.parse(await (await createGame('오후 게임')).json());
    expect((await patchGame(draft.id, 'OPEN')).status).toBe(200);

    const current = gameViewSchema.parse(
      await (await call(`/events/${LIVE_EVENT_CODE}/games/current`)).json(),
    );

    expect(current.id).toBe(draft.id);
  });

  it('게임이 없는 이벤트의 current는 GAME_NOT_FOUND를 준다', async () => {
    const response = await call(`/events/${DRAFT_EVENT_CODE}/games/current`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'GAME_NOT_FOUND' });
  });

  it('상태는 한 칸씩만 간다', async () => {
    const draft = gameViewSchema.parse(await (await createGame('건너뛰기 시도')).json());
    const response = await patchGame(draft.id, 'RUNNING');

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_GAME_STATE_TRANSITION',
    });
  });

  /*
   * RUNNING → FINISHED 는 결과 확정만 할 수 있습니다. PATCH로도 열어두면 results가 null인
   * 채로 FINISHED가 돼서, 화면이 "끝났는데 결과가 없는" 상태를 그리게 됩니다.
   */
  it('PATCH로는 FINISHED까지 갈 수 없다', async () => {
    expect((await patchGame(OPEN_GAME_ID, 'RUNNING')).status).toBe(200);
    const response = await patchGame(OPEN_GAME_ID, 'FINISHED');

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_GAME_STATE_TRANSITION',
    });
  });

  it('끝난 게임은 다시 바꿀 수 없다', async () => {
    const response = await patchGame(FINISHED_GAME_ID, 'OPEN');

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'GAME_ALREADY_FINISHED',
    });
  });

  it('모집 중이 아니면 참가가 막힌다', async () => {
    const response = await joinGame(FINISHED_GAME_ID, '늦둥이', 'client-late');

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'GAME_NOT_OPEN',
    });
  });

  /*
   * 새로고침으로 인원을 부풀릴 수 없어야 합니다. 별도 빈도 제한을 안 두기로 한 근거가
   * 이 동작이라(#246), 여기서 깨지면 그 결정도 같이 깨집니다.
   */
  it('같은 브라우저가 다시 참가하면 닉네임만 바뀐다', async () => {
    const before = gameViewSchema.parse(
      await (await call(`/events/${LIVE_EVENT_CODE}/games/${OPEN_GAME_ID}`)).json(),
    );

    const first = await joinGame(OPEN_GAME_ID, '첫 이름', 'client-same');
    expect(first.status).toBe(201);
    const created = gameParticipantSchema.parse(await first.json());

    const second = await joinGame(OPEN_GAME_ID, '바꾼이름', 'client-same');
    // 새로 만든게 아니고 갱신이라 201이 아닙니다.
    expect(second.status).toBe(200);
    const updated = gameParticipantSchema.parse(await second.json());

    expect(updated.id).toBe(created.id);
    expect(updated.nickname).toBe('바꾼이름');

    const after = gameViewSchema.parse(
      await (await call(`/events/${LIVE_EVENT_CODE}/games/${OPEN_GAME_ID}`)).json(),
    );
    expect(after.participantCount).toBe(before.participantCount + 1);
  });

  /*
   * 재참가 판정은 게임 단위입니다. clientId만 보면 한 브라우저가 두 번째 게임에
   * 아예 못 들어갑니다.
   */
  it('다른 게임에는 같은 브라우저도 새로 참가한다', async () => {
    // seed-client-1은 시드에서 FINISHED 게임에만 들어가 있습니다.
    const response = await joinGame(OPEN_GAME_ID, '초코송이', 'seed-client-1');

    expect(response.status).toBe(201);
  });

  it('결과를 올리면 FINISHED가 되고 순위가 채워진다', async () => {
    expect((await patchGame(OPEN_GAME_ID, 'RUNNING')).status).toBe(200);

    const response = await call(`/events/${LIVE_EVENT_CODE}/games/${OPEN_GAME_ID}/results`, {
      method: 'POST',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ranking: [5, 4] }),
    });

    expect(response.status).toBe(200);
    const game = gameViewSchema.parse(await response.json());

    expect(game.status).toBe('FINISHED');
    expect(game.results).toEqual([
      { rank: 1, participantId: 5, nickname: '커피' },
      { rank: 2, participantId: 4, nickname: '라면' },
    ]);
  });

  it('이 게임에 없는 참가자를 올리면 VALIDATION_ERROR를 준다', async () => {
    expect((await patchGame(OPEN_GAME_ID, 'RUNNING')).status).toBe(200);

    const response = await call(`/events/${LIVE_EVENT_CODE}/games/${OPEN_GAME_ID}/results`, {
      method: 'POST',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      // 1번은 FINISHED 게임의 참가자입니다.
      body: JSON.stringify({ ranking: [5, 1] }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('인증 없이 게임을 만들 수 없다', async () => {
    const response = await call(`/events/${LIVE_EVENT_CODE}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '몰래 만들기' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
