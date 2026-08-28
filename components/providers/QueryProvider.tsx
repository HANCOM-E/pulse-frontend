'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/apiClient';
import { useRouter } from 'next/navigation';
import { isPermanentFailure } from '@/lib/api/retryPolicy';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * TanStack Query 프로바이더입니다.
 *
 * `QueryClient`를 모듈 최상단이 아니라 `useState` 초기값으로 만드는 이유는,
 * 서버에서 모듈이 한 번만 평가되면 여러 요청이 같은 캐시를 공유하게 되기 때문입니다.
 *
 * 폴링 간격(`refetchInterval`)은 화면마다 성격이 달라서 여기서 정하지 않습니다.
 * 실시간 대시보드처럼 필요한 쿼리에서 개별로 지정합니다.
 */
const QueryProvider = ({ children }: QueryProviderProps) => {
  const router = useRouter();
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 10_000,
          // 다시 물어봐도 같은 답이 오는 실패는 재시도하지 않습니다.
          retry: (failureCount, error) => (isPermanentFailure(error) ? false : failureCount < 2),
        },
      },
      queryCache: new QueryCache({
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
            client.setQueryData(['auth', 'me'], null);
            router.push('/login');
          }
        },
      }),
    });

    return client;
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export default QueryProvider;
