'use client';

import { type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import useAuth from '@/hooks/useAuth';

interface EventsLayoutProps {
  children: ReactNode;
}

/**
 * `/events` 이하 전체(목록·생성·상세·대시보드)의 로그인 여부를 확인하는 레이아웃입니다.
 *
 * 원래는 `proxy.ts`(Next.js 미들웨어)가 서버 쿠키 존재 여부로 이 역할을 했습니다. 배포 환경에서는
 * 프론트(Vercel)와 백엔드(Render) 도메인이 서로 달라서, `accessToken` 쿠키가 백엔드 도메인에만 묶여
 * 프론트 서버로 가는 요청에는 실리지 않습니다. 그래서 서버 미들웨어는 실제 로그인 여부와 무관하게
 * 항상 "쿠키 없음"으로 판단했습니다(이슈 #139).
 *
 * `useAuth()`의 `/auth/me` 요청은 브라우저가 백엔드로 직접 보내므로 이 문제에서 자유롭습니다.
 * 대신 인증 확인이 끝날 때까지 로딩 상태가 한 번 보입니다.
 */
const EventsLayout = ({ children }: EventsLayoutProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-text-secondary">로그인 확인 중...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default EventsLayout;
