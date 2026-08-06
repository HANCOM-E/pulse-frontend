import { HttpResponse } from 'msw';
import type { z } from 'zod';
import type { ApiErrorCode, PulseEvent } from '@/lib/schemas/api';
import { API_ERROR_STATUS } from '@/lib/schemas/api';
import { HOST_USER, findEventByCode } from '@/mocks/data/store';

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
  EMAIL_ALREADY_EXISTS: '이미 가입된 이메일입니다.',
  EVENT_NOT_FOUND: '이벤트를 찾을 수 없습니다.',
  SESSION_NOT_FOUND: '세션을 찾을 수 없습니다.',
  FEEDBACK_NOT_FOUND: '소감을 찾을 수 없습니다.',
  REPORT_NOT_FOUND: '리포트를 찾을 수 없습니다.',
  EVENT_NOT_LIVE: '진행 중인 이벤트가 아닙니다.',
  INVALID_EVENT_STATE_TRANSITION: '허용되지 않는 상태 전이입니다.',
  EVENT_ALREADY_DELETED: '이미 삭제된 이벤트입니다.',
  FEEDBACK_ALREADY_DELETED: '이미 삭제된 소감입니다.',
  EVENT_NOT_ENDED: '종료된 이벤트에서만 리포트를 만들 수 있습니다.',
  REPORT_ALREADY_EXISTS: '리포트가 이미 생성 중이거나 완료되었습니다.',
  RATE_LIMIT_EXCEEDED: '잠시 후 다시 시도해 주세요.',
  REPORT_GENERATION_FAILED: '요약 생성에 실패했습니다.',
  INTERNAL_ERROR: '알 수 없는 오류가 발생했습니다.',
};

export const errorResponse = (code: ApiErrorCode, message?: string) =>
  HttpResponse.json(
    { code, message: message ?? DEFAULT_MESSAGE[code] },
    { status: API_ERROR_STATUS[code] },
  );

/**
 * 목은 토큰을 검증하지 않고 존재 여부만 봅니다.
 * 인증이 필요한 화면에서 헤더를 빠뜨렸을 때 401이 나야 FE가 실제와 같은 분기를 탈 수 있습니다.
 */
export const requireAuth = (request: Request): Response | null => {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return errorResponse('UNAUTHORIZED');
  }
  return null;
};

/**
 * 소유자 전용 경로의 공통 앞단입니다. 인증 → code 조회 → 소유자 확인을 순서대로 검사하고,
 * 전부 통과하면 이벤트를 돌려줍니다. 하나라도 걸리면 에러 응답이 그대로 나옵니다.
 *
 * 이벤트 경로 파라미터가 전부 `eventCode`로 통일되면서(2026-08-06 명세) 이벤트·리포트
 * 쓰기 핸들러가 똑같은 세 단계를 반복하게 돼 한곳으로 모았습니다.
 */
export const requireOwnedEvent = (
  request: Request,
  eventCode: string | readonly string[] | undefined,
): PulseEvent | Response => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const event = typeof eventCode === 'string' ? findEventByCode(eventCode) : undefined;
  if (!event) return errorResponse('EVENT_NOT_FOUND');
  if (event.ownerId !== HOST_USER.id) return errorResponse('NOT_OWNER');

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
    return { ok: false, response: errorResponse('VALIDATION_ERROR', '요청 본문이 JSON이 아닙니다.') };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const [issue] = result.error.issues;
    const path = issue.path.join('.');
    return {
      ok: false,
      response: errorResponse('VALIDATION_ERROR', path ? `${path}: ${issue.message}` : issue.message),
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
