import { fetchMe, login, logout, signup } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import { AuthUser } from '@/lib/schemas/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** 서버에 로그인 여부를 아직 확인받지 못한 상태입니다. false라고 해서 반드시 로그인된 건 아니므로, 로그인 여부는 user로 판단해야 합니다. */
  isLoading: boolean;
  /** UNAUTHORIZED(비로그인)는 여기 담기지 않습니다. 서버·네트워크 오류가 있을 때만 채워지며, 이 경우에도 user는 이전 값을 유지할 수 있으므로 로그인 여부는 error가 아니라 user로 판단해야 합니다. */
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  // HttpOnly 쿠키는 클라이언트에서 읽지 않고 /auth/me 응답으로 인증 상태를 확인합니다.
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async ({ signal }) => {
      try {
        return await fetchMe(signal);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
          return null;
        }
        throw error;
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['auth', 'me'] });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data);
    },
    onSettled: () => {
      return queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const signupMutation = useMutation({
    mutationFn: signup,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['auth', 'me'] });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data);
    },
    onSettled: () => {
      return queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['auth', 'me'] });
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
    },
    onSettled: () => {
      return queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const user = meQuery.data ?? null;

  return {
    user,
    isAuthenticated: user !== null,
    isLoading: meQuery.isPending,
    error: meQuery.error,
    login: async (email, password) => {
      await loginMutation.mutateAsync({ email, password });
    },
    signup: async (email, password) => {
      await signupMutation.mutateAsync({ email, password });
    },
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
  };
}

export default useAuth;
