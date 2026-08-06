import type { ComponentProps } from 'react';

import { CheckIcon } from '@/components/ui/icons';

type ToastProps = Omit<ComponentProps<'div'>, 'role'>;

const BASE = [
  'inline-flex items-center gap-1.5',
  'rounded-lg px-4 py-3',
  'bg-background-inverse text-text-inverse',
  'text-sm leading-5',
  'shadow-toast',
].join(' ');

const Toast = ({ className = '', children, ...props }: ToastProps) => {
  return (
    <div className={`${BASE} ${className}`} {...props} role="status">
      <CheckIcon className="shrink-0" />
      {children}
    </div>
  );
};

export { Toast };
