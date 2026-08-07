'use client';

import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';

interface HeaderProps {
  email: string;
  onLogout: () => void;
}

const Header = ({ email, onLogout }: HeaderProps) => {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-background-default px-5 md:h-16 md:px-20">
      <Link href="/events" aria-label="Pulse 홈으로">
        <Logo />
      </Link>

      <div className="flex items-center gap-4">
        <span className="hidden max-w-48 truncate text-sm font-normal leading-5 text-text-secondary md:inline">
          {email}
        </span>
        <button
          type="button"
          onClick={onLogout}
          className="py-3 text-sm font-normal leading-5 text-text-secondary underline transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-default"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
};

export { Header };
