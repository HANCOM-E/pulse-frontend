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

const InfoIcon = (props: IconProps) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props} aria-hidden="true">
    <circle cx="8" cy="4" r="1.25" fill="currentColor" />
    <path d="M8 7.5V12.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const DuplicateIcon = (props: IconProps) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props} aria-hidden="true">
    <rect
      x="2.5"
      y="2.5"
      width="8"
      height="8"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="5.5"
      y="5.5"
      width="8"
      height="8"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRightIcon = (props: IconProps) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" {...props}>
    <path
      d="M6.75 4.5L11.25 9L6.75 13.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronLeftIcon = (props: IconProps) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" {...props}>
    <path
      d="M11.25 4.5L6.75 9L11.25 13.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export { AlertIcon, CheckIcon, InfoIcon, XIcon, DuplicateIcon, ChevronRightIcon, ChevronLeftIcon };
export type { IconProps };
