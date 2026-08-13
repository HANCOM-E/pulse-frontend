import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';
import LoginForm from '@/components/auth/LoginForm';

const LoginPage = () => {
  return (
    <div className="min-h-dvh flex justify-center items-center p-14 bg-background-default">
      <div className="w-100 p-8 flex flex-col items-center gap-4 border border-border-default rounded-xl bg-background-default">
        <Logo size="lg" />
        <LoginForm />
        <p className="text-xs text-text-secondary">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="font-medium text-primary-darker">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
