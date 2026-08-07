import type { ComponentProps } from 'react';

interface TextareaProps extends Omit<ComponentProps<'textarea'>, 'aria-invalid'> {
  invalid?: boolean;
}

const BASE = [
  'min-h-24 w-full resize-none rounded-lg border px-3.5 py-3',
  'text-base font-normal leading-6 text-text-primary',
  'placeholder:text-text-disabled',
  'transition-colors',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-default',
  'disabled:cursor-not-allowed disabled:bg-background-muted disabled:text-text-disabled',
].join(' ');

const DEFAULT = 'border-border-default focus:border-primary-default';
const ERROR = 'border-negative-default';

const Textarea = ({ invalid = false, className = '', ...props }: TextareaProps) => {
  return (
    <textarea
      className={`${BASE} ${invalid ? ERROR : DEFAULT} ${className}`}
      {...props}
      aria-invalid={invalid || undefined}
    />
  );
};

export { Textarea };
export type { TextareaProps };
