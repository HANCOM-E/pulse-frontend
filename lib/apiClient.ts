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
  return null;
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...rest,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    const body = (await parseJsonSafely(response)) as { code?: string; message?: string } | null;
    throw new ApiError(body?.code ?? 'UNKNOWN_ERROR', body?.message ?? `요청 실패 (${response.status})`);
  }

  return (await parseJsonSafely(response)) as T;
}

export default apiClient;
