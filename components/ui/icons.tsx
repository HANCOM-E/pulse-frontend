import type { ComponentProps } from 'react';

type IconProps = ComponentProps<'svg'>;

const XIcon = (props: IconProps) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden {...props}>
    <path d="M4 4L12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M12 4L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const AlertIcon = (props: IconProps) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden {...props}>
    <path d="M8 3.5V8.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="8" cy="12" r="1.25" fill="currentColor" />
  </svg>
);

export { AlertIcon, XIcon };
export type { IconProps };
