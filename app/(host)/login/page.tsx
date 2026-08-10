'use client';

import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useState, type SubmitEvent } from 'react';

const LoginPage = () => {
  // API: POST /auth/login. useAuth() 훅과 라우트 가드는 실제 구현 시 연결합니다.
  // 로그인 실패는 별도 라우트가 아니라 이 페이지 내부에서 처리합니다.
  // 401 응답(INVALID_CREDENTIALS)은 존재하지 않는 사용자와 비밀번호 불일치를 병합해서 내려주므로(API 명세서 확정),
  // 어느 필드가 틀렸는지는 표시하지 않습니다. 이메일·비밀번호 입력 필드 모두 invalid 스타일로 표시하고, 공통 에러 문구 하나만 보여줍니다.
  const [loginFailed, setLoginFailed] = useState(false);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: useAuth 연동 후 실제 로그인 요청으로 교체해야 합니다. 지금은 항상 실패 상태를 보여줍니다.
    setLoginFailed(true);
  };

  return (
    <div className="min-h-dvh flex justify-center items-center p-14 bg-background-default">
      <div className="w-100 p-8 flex flex-col items-center gap-4 border border-border-default rounded-xl bg-background-default">
        <Logo size="lg" />
        <form className="flex flex-col w-full gap-4" onSubmit={handleSubmit}>
          <Field
            className="w-full"
            label="이메일"
            type="email"
            placeholder="host@example.com"
            invalid={loginFailed}
          />
          <Field
            className="w-full"
            label="비밀번호"
            type="password"
            placeholder="••••••••"
            invalid={loginFailed}
          />
          <p
            role="alert"
            aria-atomic="true"
            className={loginFailed ? 'text-xs text-negative-darker' : 'sr-only'}
          >
            {loginFailed ? '이메일 또는 비밀번호가 올바르지 않습니다.' : null}
          </p>
          <Button type="submit" variant="primary" className="w-full">
            로그인
          </Button>
        </form>
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
