import type { ComponentProps } from 'react';

type IconProps = Omit<ComponentProps<'svg'>, 'aria-hidden'>;

const CheckIcon = (props: IconProps) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props} aria-hidden="true">
    <path
      d="M3.33 8.67L6.67 11.33L13.33 4.67"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const XIcon = (props: IconProps) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props} aria-hidden="true">
    <path d="M4 4L12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M12 4L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const AlertIcon = (props: IconProps) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props} aria-hidden="true">
    <path d="M8 3.5V8.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="8" cy="12" r="1.25" fill="currentColor" />
  </svg>
);

export { AlertIcon, CheckIcon, XIcon };
export type { IconProps };
