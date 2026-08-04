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

export async function apiClient<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  const token = skipAuth ? null : getAccessToken();

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(error.code, error.message);
  }

  return response.json();
}

export default apiClient;
