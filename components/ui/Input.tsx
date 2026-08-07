import type { ComponentProps } from 'react';

interface InputProps extends Omit<ComponentProps<'input'>, 'aria-invalid'> {
  invalid?: boolean;
}

const BASE = [
  'h-12 w-full rounded-lg border px-3.5',
  'text-base font-normal leading-6 text-text-primary',
  'placeholder:text-text-disabled',
  'transition-colors',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker',
  'disabled:cursor-not-allowed disabled:bg-background-muted disabled:text-text-disabled',
].join(' ');

const DEFAULT = 'border-border-default focus:border-primary-darker';
const ERROR = 'border-negative-default';

const Input = ({ invalid = false, className = '', ...props }: InputProps) => {
  return (
    <input
      className={`${BASE} ${invalid ? ERROR : DEFAULT} ${className}`}
      {...props}
      aria-invalid={invalid || undefined}
    />
  );
};

export { Input };
export type { InputProps };
