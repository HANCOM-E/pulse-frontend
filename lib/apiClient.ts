import { API_BASE_URL } from '@/lib/env';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiClientOptions extends RequestInit {
  /**
   * 인증 쿠키를 일부러 빼고 보냅니다. `GET /events/{eventCode}/report`처럼 같은 경로가
   * 인증 여부로 응답이 갈리는 자리에서, 로그인 상태여도 게스트 응답을 받아야 할 때 씁니다.
   */
  skipAuth?: boolean;
}

const XSRF_TOKEN_COOKIE = 'XSRF-TOKEN';
const XSRF_TOKEN_HEADER = 'X-XSRF-TOKEN';

/** 조회 요청에는 CSRF 토큰이 필요 없습니다. 상태를 바꾸는 메서드만 헤더를 답니다. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF double-submit용 토큰입니다. `accessToken`과 달리 HttpOnly가 아니라서 FE가 읽을 수 있고,
 * 읽은 값을 그대로 헤더에 실어 보내면 서버가 쿠키와 대조합니다(2026-08-07 명세).
 *
 * SSR에는 `document`가 없습니다. 서버에서 나가는 요청은 애초에 인증 쿠키도 없어서 상태 변경을
 * 하지 않으므로 그냥 건너뜁니다.
 */
const readXsrfToken = (): string | null => {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${XSRF_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

async function parseJsonSafely(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

export async function apiClient<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = options;

  const mergedHeaders = new Headers(headers);
  if (!mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json');
  }

  const method = (rest.method ?? 'GET').toUpperCase();
  const xsrfToken = skipAuth ? null : readXsrfToken();
  if (xsrfToken !== null && !SAFE_METHODS.has(method) && !mergedHeaders.has(XSRF_TOKEN_HEADER)) {
    mergedHeaders.set(XSRF_TOKEN_HEADER, xsrfToken);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    // 인증은 HttpOnly 쿠키라 FE가 헤더로 실어 보낼 수 없습니다. 브라우저가 붙이게 맡깁니다.
    credentials: skipAuth ? 'omit' : 'include',
    headers: mergedHeaders,
  });

  if (!response.ok) {
    let body: { code?: string; message?: string } | null;
    try {
      body = (await parseJsonSafely(response)) as { code?: string; message?: string } | null;
    } catch {
      body = null;
    }
    throw new ApiError(
      body?.code ?? 'UNKNOWN_ERROR',
      body?.message ?? `요청 실패 (${response.status})`,
    );
  }

  try {
    return (await parseJsonSafely(response)) as T;
  } catch {
    throw new ApiError('INVALID_RESPONSE', '서버 응답을 파싱할 수 없습니다.');
  }
}

export default apiClient;
