import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';
import SignupForm from '@/components/auth/SignupForm';

const SignupPage = () => {
  return (
    <div className="min-h-dvh flex justify-center items-center p-14 bg-background-default">
      <div className="w-100 p-8 flex flex-col items-center gap-4 border border-border-default rounded-xl bg-background-default">
        <Logo size="lg" />
        <SignupForm />
        <p className="text-xs text-text-secondary">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-primary-darker">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
