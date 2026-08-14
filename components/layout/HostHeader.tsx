'use client';

import { usePathname, useRouter } from 'next/navigation';

import { Header } from '@/components/layout/Header';
import useAuth from '@/hooks/useAuth';

/** 로그인 전 화면입니다. 세션이 없어 email·onLogout을 보여줄 수 없으므로 Header를 숨깁니다. */
const HEADER_HIDDEN_PATHS = ['/login', '/signup'];

/**
 * `SessionHeader`를 pathname에 따라 마운트할지 결정합니다.
 *
 * `/login`·`/signup`에서는 `SessionHeader`를 아예 마운트하지 않습니다. `useAuth()` 호출을
 * `SessionHeader` 안에 둔 것도 이 때문입니다 — 여기서 `useAuth()`를 직접 부르면 훅은 조건 없이
 * 항상 실행되므로, `/login`에서도 세션 확인 요청이 나가버립니다.
 */
const HostHeader = () => {
  const pathname = usePathname();

  if (HEADER_HIDDEN_PATHS.includes(pathname)) {
    return null;
  }

  return <SessionHeader />;
};

const SessionHeader = () => {
  const router = useRouter();
  const { user, logout, isLoading: isEmailLoading } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <Header email={user?.email ?? ''} onLogout={handleLogout} isEmailLoading={isEmailLoading} />
  );
};

export { HostHeader };
