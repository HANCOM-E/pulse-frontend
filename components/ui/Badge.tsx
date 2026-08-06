import type { ComponentProps } from 'react';

type BadgeTone = 'positive' | 'neutral' | 'negative' | 'toxic' | 'outline';

interface BadgeProps extends ComponentProps<'span'> {
  tone: BadgeTone;
}

const BASE = ['inline-flex h-6 items-center justify-center', 'rounded-full px-2.5', 'text-xs leading-4'].join(
  ' ',
);

const TONE: Record<BadgeTone, string> = {
  positive: 'bg-positive-subtle text-positive-darker',
  neutral: 'bg-neutral-subtle text-neutral-darker',
  negative: 'bg-negative-subtle text-negative-darker',
  toxic: 'bg-toxic-subtle text-toxic-darker',
  outline: 'border border-border-strong bg-background-default text-text-secondary',
};

const Badge = ({ tone, className = '', ...props }: BadgeProps) => {
  return <span className={`${BASE} ${TONE[tone]} ${className}`} {...props} />;
};

export { Badge };
