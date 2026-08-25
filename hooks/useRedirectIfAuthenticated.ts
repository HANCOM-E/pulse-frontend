'use client';

import useAuth from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const useRedirectIfAuthenticated = () => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/events');
    }
  }, [isAuthenticated, router]);
};

export default useRedirectIfAuthenticated;
