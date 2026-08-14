'use client';

import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';

interface HeaderProps {
  email: string;
  onLogout: () => void;
  /** `/auth/me` 응답을 아직 못 받아 email이 비어있는 상태입니다. 자리에 스켈레톤을 대신 보여줍니다. */
  isEmailLoading?: boolean;
}

const Header = ({ email, onLogout, isEmailLoading = false }: HeaderProps) => {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-background-default px-5 md:h-16 md:px-20">
      <Link
        href="/events"
        aria-label="Pulse 홈으로"
        className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker"
      >
        <Logo />
      </Link>

      <div className="flex items-center gap-4">
        {isEmailLoading ? (
          <div
            className="hidden h-5 w-32 animate-pulse rounded bg-neutral-subtle md:block"
            aria-hidden
          />
        ) : (
          <span className="hidden max-w-48 truncate text-sm font-normal leading-5 text-text-secondary md:inline">
            {email}
          </span>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="py-3 text-sm font-normal leading-5 text-text-secondary underline transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
};

export { Header };
