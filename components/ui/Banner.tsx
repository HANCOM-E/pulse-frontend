import type { ComponentProps, ComponentType } from 'react';

import { AlertIcon, XIcon, type IconProps } from '@/components/ui/icons';

type BannerType = 'negative' | 'warning';

interface BannerProps extends ComponentProps<'div'> {
  type: BannerType;
}

const BASE = [
  'inline-flex items-center gap-1.5',
  'rounded-lg px-3.5 py-3',
  'text-sm font-medium leading-5',
].join(' ');

const TONE: Record<BannerType, string> = {
  negative: 'bg-negative-subtle text-negative-darker',
  warning: 'bg-warning-subtle text-warning-darker',
};

const ICON: Record<BannerType, ComponentType<IconProps>> = {
  negative: XIcon,
  warning: AlertIcon,
};

const Banner = ({ type, className = '', children, ...props }: BannerProps) => {
  const Icon = ICON[type];

  return (
    <div
      role={type === 'negative' ? 'alert' : 'status'}
      className={`${BASE} ${TONE[type]} ${className}`}
      {...props}
    >
      <Icon className="shrink-0" />
      {children}
    </div>
  );
};

export { Banner };
