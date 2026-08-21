import { HttpResponse } from 'msw';
import type { z } from 'zod';
import type { ApiErrorCode, PulseEvent } from '@/lib/schemas/api';
import { API_ERROR_STATUS } from '@/lib/schemas/api';
import type { MockAccount } from '@/mocks/data/store';
import { findAccountById, findEventByCode } from '@/mocks/data/store';

/**
 * 핸들러 공통 유틸입니다. 에러 봉투·인증 검사·요청 바디 검증처럼
 * 모든 도메인 핸들러가 똑같이 반복하는 부분만 모아뒀습니다.
 */

/** 목이 가로챌 주소. 요청을 보내는 쪽(apiClient)과 같은 상수를 봅니다. */
export { API_BASE_URL } from '@/lib/env';

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: '요청 값이 올바르지 않습니다.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  UNAUTHORIZED: '로그인이 필요합니다.',
  NOT_OWNER: '이 이벤트의 소유자가 아닙니다.',
  CSRF_TOKEN_INVALID: '요청이 만료되었습니다. 새로고침 후 다시 시도해 주세요.',
  EMAIL_ALREADY_EXISTS: '이미 가입된 이메일입니다.',
  EVENT_NOT_FOUND: '이벤트를 찾을 수 없습니다.',
  SESSION_NOT_FOUND: '세션을 찾을 수 없습니다.',
  FEEDBACK_NOT_FOUND: '소감을 찾을 수 없습니다.',
  REPORT_NOT_FOUND: '리포트를 찾을 수 없습니다.',
  EVENT_NOT_LIVE: '진행 중인 이벤트가 아닙니다.',
  SESSION_CLOSED: '지금은 이 순서에 소감을 받지 않습니다.',
  INVALID_EVENT_STATE_TRANSITION: '허용되지 않는 상태 전이입니다.',
  EVENT_ALREADY_DELETED: '이미 삭제된 이벤트입니다.',
  FEEDBACK_ALREADY_DELETED: '이미 삭제된 소감입니다.',
  SESSION_ALREADY_DELETED: '이미 삭제된 세션입니다.',
  EVENT_NOT_ENDED: '종료된 이벤트에서만 리포트를 만들 수 있습니다.',
  REPORT_ALREADY_EXISTS: '리포트가 이미 생성 중이거나 완료되었습니다.',
  RATE_LIMIT_EXCEEDED: '잠시 후 다시 시도해 주세요.',
  REPORT_GENERATION_FAILED: '요약 생성에 실패했습니다.',
  GAME_NOT_FOUND: '게임을 찾을 수 없습니다.',
  GAME_NOT_OPEN: '지금은 참가를 받지 않습니다.',
  INVALID_GAME_STATE_TRANSITION: '허용되지 않는 상태 전이입니다.',
  GAME_ALREADY_FINISHED: '이미 끝난 게임입니다.',
  INTERNAL_ERROR: '알 수 없는 오류가 발생했습니다.',
};

export const errorResponse = (code: ApiErrorCode, message?: string) =>
  HttpResponse.json(
    { code, message: message ?? DEFAULT_MESSAGE[code] },
    { status: API_ERROR_STATUS[code] },
  );

/** 인증 쿠키 이름입니다(2026-08-07 명세). 실제 BE가 `Set-Cookie`로 내려주는 이름과 같아야 합니다. */
export const ACCESS_TOKEN_COOKIE = 'accessToken';

export const REFRESH_TOKEN_COOKIE = 'refreshToken';

/** CSRF double-submit용 쿠키. HttpOnly가 아니라서 FE가 읽어 `X-XSRF-TOKEN` 헤더로 되돌려 보냅니다. */
export const XSRF_TOKEN_COOKIE = 'XSRF-TOKEN';

/**
 * 인증 검사는 `request.headers`가 아니라 리졸버의 `cookies` 인자를 봅니다. 브라우저는 `Cookie`를
 * 금지 헤더로 막아서 서비스 워커가 요청 헤더에서 쿠키를 읽을 수 없고, MSW가 목 응답의
 * `Set-Cookie`를 자체 저장소에 담아 이 인자로 되돌려 주기 때문입니다.
 */
export type RequestCookies = Record<string, string>;

/**
 * 목 토큰은 서명하지 않고 계정 id만 실어 둡니다.
 *
 * 목이 토큰을 검증할 수는 없지만, 최소한 "누가 로그인했는지"는 알아야 합니다. 존재 여부만 보면
 * 가입한 아무 계정이나 남의 이벤트를 수정하고 모더레이션 큐를 열 수 있습니다.
 */
const ACCESS_TOKEN_PREFIX = 'mock-access-token-';

export const issueAccessToken = (accountId: number): string => `${ACCESS_TOKEN_PREFIX}${accountId}`;

const REFRESH_TOKEN_PREFIX = 'mock-refresh-token-';

export const issueRefreshToken = (accountId: number): string =>
  `${REFRESH_TOKEN_PREFIX}${accountId}`;

const accountIdFromAccessToken = (token: string | undefined): number | null => {
  if (token === undefined || !token.startsWith(ACCESS_TOKEN_PREFIX)) return null;
  const parsed = Number(token.slice(ACCESS_TOKEN_PREFIX.length));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const accountIdFromRefreshToken = (token: string | undefined): number | null => {
  if (token === undefined || !token.startsWith(REFRESH_TOKEN_PREFIX)) return null;
  const parsed = Number(token.slice(REFRESH_TOKEN_PREFIX.length));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * 요청을 보낸 계정을 복원합니다. 인증 판정은 전부 이 함수를 거칩니다.
 *
 * `credentials: 'omit'`이면 쿠키가 없는 것으로 봅니다. MSW는 목 응답의 `Set-Cookie`를 자체
 * 저장소(tough-cookie)에 담아 두는데, 이 저장소가 요청의 `credentials`를 보지 않고 무조건
 * `cookies` 인자에 섞습니다. 그대로 두면 브라우저가 쿠키를 빼고 보냈는데도 목만 로그인
 * 상태로 보고, `skipAuth`로 게스트 응답을 받아야 하는 `GET /events/{eventCode}/report`가
 * 소유자 응답을 돌려줍니다.
 */
export const authenticatedAccount = (
  request: Request,
  cookies: RequestCookies,
): MockAccount | null => {
  if (request.credentials === 'omit') return null;

  const accountId = accountIdFromAccessToken(cookies[ACCESS_TOKEN_COOKIE]);
  return accountId === null ? null : (findAccountById(accountId) ?? null);
};

/**
 * 인증이 필요한 화면에서 쿠키가 없을 때 401이 나야 FE가 실제와 같은 분기를 탑니다.
 */
export const requireAccount = (request: Request, cookies: RequestCookies): MockAccount | Response =>
  authenticatedAccount(request, cookies) ?? errorResponse('UNAUTHORIZED');

/**
 * 소유자 전용 경로의 공통 앞단입니다. 인증 → code 조회 → 소유자 확인을 순서대로 검사하고,
 * 전부 통과하면 이벤트를 돌려줍니다. 하나라도 걸리면 에러 응답이 그대로 나옵니다.
 *
 * 2026-08-06 명세에서 이벤트 경로 파라미터가 전부 `eventCode`로 통일되면서
 * 이벤트·리포트 쓰기 핸들러가 똑같은 세 단계를 반복하게 돼 한곳으로 모았습니다.
 */
export const requireOwnedEvent = (
  request: Request,
  cookies: RequestCookies,
  eventCode: string | readonly string[] | undefined,
): PulseEvent | Response => {
  const account = requireAccount(request, cookies);
  if (account instanceof Response) return account;

  const event = typeof eventCode === 'string' ? findEventByCode(eventCode) : undefined;
  if (!event) return errorResponse('EVENT_NOT_FOUND');
  if (event.ownerId !== account.id) return errorResponse('NOT_OWNER');

  return event;
};

type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * 요청 바디를 계약 스키마로 검증합니다.
 * BE가 `@Valid` 실패를 전부 VALIDATION_ERROR로 내리므로 목도 같은 코드로 맞춥니다.
 */
export const parseBody = async <T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<ParsedBody<z.infer<T>>> => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: errorResponse('VALIDATION_ERROR', '요청 본문이 JSON이 아닙니다.'),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const [issue] = result.error.issues;
    const path = issue.path.join('.');
    return {
      ok: false,
      response: errorResponse(
        'VALIDATION_ERROR',
        path ? `${path}: ${issue.message}` : issue.message,
      ),
    };
  }

  return { ok: true, data: result.data };
};

/** 경로 파라미터로 들어온 숫자 id를 좁힙니다. `useParams`는 항상 문자열을 주기 때문에 필요합니다. */
export const toNumericId = (value: string | readonly string[] | undefined): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
