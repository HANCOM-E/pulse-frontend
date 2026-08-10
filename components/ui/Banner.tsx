import type { ComponentProps, ComponentType } from 'react';

import { AlertIcon, InfoIcon, XIcon, type IconProps } from '@/components/ui/icons';

type BannerType = 'negative' | 'warning' | 'info';

interface BannerProps extends Omit<ComponentProps<'div'>, 'role'> {
  type: BannerType;
}

const BASE = [
  'inline-flex items-center gap-1.5',
  'rounded-lg border px-3.5 py-3',
  'text-sm font-normal leading-5',
].join(' ');

const TONE: Record<BannerType, string> = {
  negative: 'border-negative-lighter bg-negative-subtle text-negative-darker',
  warning: 'border-warning-lighter bg-warning-subtle text-warning-darker',
  info: 'border-primary-lighter bg-primary-subtle text-primary-darker',
};

const ICON: Record<BannerType, ComponentType<IconProps>> = {
  negative: XIcon,
  warning: AlertIcon,
  info: InfoIcon,
};

const Banner = ({ type, className = '', children, ...props }: BannerProps) => {
  const Icon = ICON[type];

  return (
    <div
      className={`${BASE} ${TONE[type]} ${className}`}
      {...props}
      role={type === 'negative' ? 'alert' : 'status'}
    >
      <Icon className="shrink-0" />
      {children}
    </div>
  );
};

export { Banner };
