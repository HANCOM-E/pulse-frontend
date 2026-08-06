import { getStoredAccessToken } from '@/lib/authToken';
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
  skipAuth?: boolean;
}

function getAccessToken(): string | null {
  // JWT 저장 방식(localStorage vs 쿠키)은 팀 논의 후 확정됩니다. 축 1이 useAuth와 함께 구현합니다.
  // 확정 전까지 /admin/* 호출이 401로 막히지 않도록 임시 보관소만 연결해 둡니다.
  return getStoredAccessToken();
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

export async function apiClient<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  const token = skipAuth ? null : getAccessToken();

  const mergedHeaders = new Headers(headers);
  if (!mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json');
  }
  if (token) {
    mergedHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    let body: { code?: string; message?: string } | null;
    try {
      body = (await parseJsonSafely(response)) as { code?: string; message?: string } | null;
    } catch {
      body = null;
    }
    throw new ApiError(body?.code ?? 'UNKNOWN_ERROR', body?.message ?? `요청 실패 (${response.status})`);
  }

  try {
    return (await parseJsonSafely(response)) as T;
  } catch {
    throw new ApiError('INVALID_RESPONSE', '서버 응답을 파싱할 수 없습니다.');
  }
}

export default apiClient;
