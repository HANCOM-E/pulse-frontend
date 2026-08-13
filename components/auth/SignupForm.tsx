'use client';

import { useRouter } from 'next/navigation';
import { ChangeEvent, type SubmitEvent, useState } from 'react';

import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { passwordSchema, signupRequestSchema } from '@/lib/schemas/api';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';

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

const SignupForm = () => {
  // API: POST /auth/signup. useAuth().signup으로 실제 요청을 보냅니다.
  const [signupInputs, setSignupInputs] = useState<SignupInputs>(initialSignupInputs);
  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});
  // 필드별 에러(signupErrors)로 표현할 수 없는 서버 에러(400 폴백)만 여기 담습니다.
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { signup } = useAuth();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSignupInputs((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const emailValidation = signupRequestSchema.shape.email.safeParse(signupInputs.email);
    const passwordValidation = passwordSchema.safeParse(signupInputs.password);
    const passwordConfirmError =
      signupInputs.password !== signupInputs.passwordConfirm ? '비밀번호가 일치하지 않습니다.' : '';

    const nextErrors: SignupErrors = {
      email: emailValidation.error?.issues[0].message,
      password: passwordValidation.error?.issues[0].message,
      passwordConfirm: passwordConfirmError,
    };
    setSignupErrors(nextErrors);

    if (nextErrors.email || nextErrors.password || nextErrors.passwordConfirm) return;

    setIsSubmitting(true);
    try {
      await signup(signupInputs.email, signupInputs.password);
      router.push('/events');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_EXISTS') {
        setSignupErrors((prev) => ({ ...prev, email: '이미 가입된 이메일입니다.' }));
      } else {
        setFormError('회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
      <p
        role="alert"
        aria-atomic="true"
        className={formError ? 'text-xs text-negative-darker' : 'sr-only'}
      >
        {formError}
      </p>
      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? '가입 중...' : '회원가입'}
      </Button>
    </form>
  );
};

export default SignupForm;
