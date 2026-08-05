export interface UseAuthReturn {
  user: { id: string; email: string } | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  // 실제 구현은 축 1이 담당합니다. JWT 저장 위치는 팀 논의 후 확정됩니다.
  throw new Error('Not implemented');
}

export default useAuth;
