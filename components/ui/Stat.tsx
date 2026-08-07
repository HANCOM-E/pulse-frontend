import type { ComponentProps } from 'react';

type StatTone = 'default' | 'positive' | 'toxic' | 'muted';

interface StatProps extends Omit<ComponentProps<'div'>, 'children'> {
  label: string;
  value: string;
  tone?: StatTone;
}

const BASE = 'flex w-full flex-col gap-1 rounded-lg bg-background-muted px-4 py-3.5';

const TONE: Record<StatTone, string> = {
  default: 'text-text-primary',
  positive: 'text-positive-darker',
  toxic: 'text-toxic-darker',
  muted: 'text-text-secondary',
};

const Stat = ({ label, value, tone = 'default', className = '', ...props }: StatProps) => {
  return (
    <div className={`${BASE} ${className}`} {...props}>
      <span className="text-xs font-normal leading-4 text-text-secondary">{label}</span>
      <span className={`text-xl font-semibold leading-7 ${TONE[tone]}`}>{value}</span>
    </div>
  );
};

export { Stat };
export type { StatTone };
