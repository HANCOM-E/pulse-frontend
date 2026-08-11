'use client';

import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ChangeEvent, type SubmitEvent, useState } from 'react';
import { passwordSchema, signupRequestSchema } from '@/lib/schemas/api';

type SignupInputs = {
  email: string;
  password: string;
  passwordConfirm: string;
};

type SignupErrors = {
  email?: string;
  password?: string;
  passwordConfirm?: string;
};

const initialSignupInputs: SignupInputs = {
  email: '',
  password: '',
  passwordConfirm: '',
};

const SignupPage = () => {
  // API: POST /auth/signup
  // useAuth()의 signup 함수는 아직 없기 때문에(PR #79 미머지)
  // 클라이언트 사전 검증까지만 하고 실제 서버 제출은 하지 않습니다.
  const [signupInputs, setSignupInputs] = useState<SignupInputs>(initialSignupInputs);
  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSignupInputs((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailValidation = signupRequestSchema.shape.email.safeParse(signupInputs.email);
    const passwordValidation = passwordSchema.safeParse(signupInputs.password);
    const passwordConfirmError =
      signupInputs.password !== signupInputs.passwordConfirm ? '비밀번호가 일치하지 않습니다.' : '';

    setSignupErrors((prev) => ({
      ...prev,
      email: emailValidation.error?.issues[0].message,
      password: passwordValidation.error?.issues[0].message,
      passwordConfirm: passwordConfirmError,
    }));
  };

  return (
    <div className="min-h-dvh flex justify-center items-center p-14 bg-background-default">
      <div className="w-100 p-8 flex flex-col items-center gap-4 border border-border-default rounded-xl bg-background-default">
        <Logo size="lg" />
        <form className="flex flex-col w-full gap-4" onSubmit={handleSubmit} noValidate={true}>
          <Field
            onChange={handleChange}
            className="w-full"
            label="이메일"
            name="email"
            type="email"
            placeholder="host@example.com"
            value={signupInputs.email}
            error={signupErrors.email}
          />
          <Field
            onChange={handleChange}
            className="w-full"
            label="비밀번호"
            name="password"
            type="password"
            placeholder="••••••••"
            value={signupInputs.password}
            error={signupErrors.password}
          />
          <Field
            onChange={handleChange}
            className="w-full"
            label="비밀번호 확인"
            name="passwordConfirm"
            type="password"
            placeholder="••••••••"
            value={signupInputs.passwordConfirm}
            error={signupErrors.passwordConfirm}
          />
          <Button type="submit" variant="primary" className="w-full">
            회원가입
          </Button>
        </form>
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
