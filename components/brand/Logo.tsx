import type { ComponentProps } from 'react';

type LogoProps = Omit<ComponentProps<'span'>, 'children'>;

const Logo = ({ className = '', ...props }: LogoProps) => {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} {...props}>
      <svg
        width="44"
        height="39"
        viewBox="0 0 44 39"
        fill="none"
        aria-hidden="true"
        className="shrink-0 text-primary-default"
      >
        <path
          d="M2.75 9.75C2.75 7.90296 3.47433 6.13156 4.76364 4.82551C6.05295 3.51945 7.80164 2.78571 9.625 2.78571H31.625C33.4484 2.78571 35.197 3.51945 36.4864 4.82551C37.7757 6.13156 38.5 7.90296 38.5 9.75V23.6786C38.5 25.5256 37.7757 27.297 36.4864 28.6031C35.197 29.9091 33.4484 30.6429 31.625 30.6429H22L16.5 36.2143V30.6429H9.625C7.80164 30.6429 6.05295 29.9091 4.76364 28.6031C3.47433 27.297 2.75 25.5256 2.75 23.6786V9.75Z"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M8.25 16.7143H13.75L17.1875 11.1429L21.3125 22.2857L25.4375 13.9286L28.875 16.7143H34.375"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-base font-semibold leading-6 tracking-tighter text-primary-darker">
        Pulse
      </span>
    </span>
  );
};

export { Logo };
