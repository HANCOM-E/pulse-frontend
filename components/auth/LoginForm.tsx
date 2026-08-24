'use client';

import { useState, type SubmitEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import useRedirectIfAuthenticated from '@/hooks/useRedirectIfAuthenticated';

type LoginInputs = {
  email: string;
  password: string;
};

const initialLoginInputs = {
  email: '',
  password: '',
};

const LoginForm = () => {
  // API: POST /auth/login. useAuth() 훅 연결 완료. 라우트 가드는 별도 이슈에서 처리합니다.
  // 로그인 실패는 별도 라우트가 아니라 이 페이지 내부에서 처리합니다.
  // 401 응답(INVALID_CREDENTIALS)은 존재하지 않는 사용자와 비밀번호 불일치를 병합해서 내려주므로(API 명세서 확정),
  // 어느 필드가 틀렸는지는 표시하지 않습니다. 이메일·비밀번호 입력 필드 모두 invalid 스타일로 표시하고, 공통 에러 문구 하나만 보여줍니다.
  const [loginFailed, setLoginFailed] = useState(false);
  const [loginFailedMessage, setLoginFailedMessage] = useState<string | null>(null);
  const [loginInputs, setLoginInputs] = useState<LoginInputs>(initialLoginInputs);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { login } = useAuth();
  useRedirectIfAuthenticated();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLoginInputs((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
    setLoginFailed(false);
    setLoginFailedMessage(null);
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setLoginFailed(false);
    setLoginFailedMessage(null);

    setIsSubmitting(true);
    try {
      await login(loginInputs.email, loginInputs.password);
      router.push('/events');
      router.refresh();
    } catch (error) {
      setLoginFailed(true);

      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setLoginFailedMessage('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setLoginFailedMessage('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col w-full gap-4" onSubmit={handleSubmit}>
      <Field
        className="w-full"
        label="이메일"
        type="email"
        placeholder="host@example.com"
        invalid={loginFailed}
        onChange={handleChange}
        name="email"
        value={loginInputs.email}
      />
      <Field
        className="w-full"
        label="비밀번호"
        type="password"
        placeholder="••••••••"
        invalid={loginFailed}
        onChange={handleChange}
        name="password"
        value={loginInputs.password}
      />
      <p
        role="alert"
        aria-atomic="true"
        className={loginFailed ? 'text-xs text-negative-darker' : 'sr-only'}
      >
        {loginFailed ? loginFailedMessage : null}
      </p>
      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        로그인
      </Button>
    </form>
  );
};

export default LoginForm;
