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

const Button = ({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) => {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    />
  );
};

export { Button };
