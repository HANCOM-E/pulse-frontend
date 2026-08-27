'use client';

import { useRouter } from 'next/navigation';
import { ChangeEvent, type SubmitEvent, useState } from 'react';

import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { passwordSchema, signupRequestSchema } from '@/lib/schemas/api';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import useRedirectIfAuthenticated from '@/hooks/useRedirectIfAuthenticated';

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

const validateSignupInputs = (inputs: SignupInputs): SignupErrors => {
  const emailValidation = signupRequestSchema.shape.email.safeParse(inputs.email);
  const passwordValidation = passwordSchema.safeParse(inputs.password);
  const passwordConfirmError =
    inputs.password !== inputs.passwordConfirm ? '비밀번호가 일치하지 않습니다.' : '';

  return {
    email: emailValidation.error?.issues[0].message,
    password: passwordValidation.error?.issues[0].message,
    passwordConfirm: passwordConfirmError,
  };
};

const getSignupErrorFeedback = (error: unknown): { emailError?: string; formError?: string } => {
  if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_EXISTS') {
    return { emailError: '이미 가입된 이메일입니다.' };
  }
  return { formError: '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.' };
};

const SignupForm = () => {
  // API: POST /auth/signup. useAuth().signup으로 실제 요청을 보냅니다.
  const [signupInputs, setSignupInputs] = useState<SignupInputs>(initialSignupInputs);
  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});
  // 필드별 에러(signupErrors)로 표현할 수 없는 서버 에러(400 폴백)만 여기 담습니다.
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { signup, isLoading } = useAuth();
  useRedirectIfAuthenticated();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setSignupInputs((prev) => ({ ...prev, [name]: value }));

    // 비밀번호 확인 에러는 password·passwordConfirm 두 값을 비교해서 나므로,
    // 둘 중 어느 쪽이 바뀌어도 더 이상 유효하지 않은 판정이라 함께 지웁니다.
    setSignupErrors((prev) => ({
      ...prev,
      [name]: undefined,
      ...(name === 'password' ? { passwordConfirm: undefined } : {}),
    }));
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const validationErrors = validateSignupInputs(signupInputs);
    setSignupErrors(validationErrors);

    if (Object.values(validationErrors).some(Boolean)) return;

    setIsSubmitting(true);
    try {
      await signup(signupInputs.email, signupInputs.password);
      router.push('/events');
    } catch (error) {
      const feedback = getSignupErrorFeedback(error);
      if (feedback.emailError) {
        setSignupErrors((prev) => ({ ...prev, email: feedback.emailError }));
      } else {
        setFormError(feedback.formError ?? null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col w-full gap-4">
        <div className="h-12 w-full animate-pulse rounded-lg bg-neutral-subtle" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-neutral-subtle" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-neutral-subtle" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-neutral-subtle" />
      </div>
    );
  }

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
