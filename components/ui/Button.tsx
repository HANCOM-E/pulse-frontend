import type { ComponentProps } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'lg' | 'md' | 'sm';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE = [
  'inline-flex items-center justify-center gap-2.5',
  'rounded-lg px-5',
  'text-base font-semibold leading-6',
  'transition-colors',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker',
  'cursor-pointer',
  'disabled:cursor-not-allowed disabled:border-transparent',
  'disabled:bg-neutral-subtle disabled:text-text-disabled',
].join(' ');

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary-darker text-text-inverse hover:bg-primary-pressed',
  secondary:
    'border border-border-default bg-background-default text-text-primary hover:bg-background-muted',
  danger: 'bg-negative-darker text-text-inverse hover:bg-negative-pressed',
};

const SIZE: Record<ButtonSize, string> = {
  lg: 'h-13',
  md: 'h-12',
  sm: 'h-9',
};

/**
 * 버튼 모양이 필요한데 `<button>`을 쓸 수 없을 때 씁니다.
 *
 * 이동은 `<a>`(`next/link`)여야 새 탭 열기·주소 복사·스크린리더 안내·prefetch가
 * 살아 있는데, `<a>` 안에는 `<button>`을 넣을 수 없습니다(HTML 콘텐츠 모델에서
 * interactive content가 제외됩니다). 그래서 요소는 링크로 두고 모양만 가져다 씁니다.
 */
const buttonStyle = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md') =>
  `${BASE} ${VARIANT[variant]} ${SIZE[size]}`;

const Button = ({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) => {
  return <button type={type} className={`${buttonStyle(variant, size)} ${className}`} {...props} />;
};

export { Button, buttonStyle };
