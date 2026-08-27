import { Logo } from '@/components/brand/Logo';

interface SpeakerLayoutProps {
  children: React.ReactNode;
}

/**
 * 강연자 화면의 레이아웃입니다.
 *
 * `app/(host)`의 `HostHeader`를 쓰지 않습니다. 그쪽은 `useAuth`로 이메일과 로그아웃 버튼을
 * 그리는데, 강연자는 계정 없이 링크로 들어와서 보여줄 값이 없고 `/auth/me` 요청만 새로 나갑니다.
 *
 * `app/e`의 참가자 레이아웃도 쓰지 않습니다. 저쪽은 QR로 들어오는 모바일 전용이라 `max-w-md`
 * 한 열인데, 이 화면은 강연 중 노트북에 띄워두는 모니터링 화면이라 넓은 화면을 씁니다.
 *
 * 로고에 링크를 걸지 않습니다. 강연자에게는 돌아갈 상위 화면이 없습니다 — 이벤트 홈은 참가자용
 * 제출 화면이고, 주최자 화면은 로그인이 필요합니다.
 *
 * 이 경로는 `proxy.ts`의 matcher(`/events/:path*`)에 걸리지 않습니다. 걸리면 쿠키 없는 강연자가
 * 화면을 보기도 전에 `/login`으로 튕깁니다. 라우트를 `/events` 아래로 옮기지 마세요.
 */
const SpeakerLayout = ({ children }: SpeakerLayoutProps) => {
  return (
    <div className="flex flex-1 flex-col">
      <header className="px-5 md:px-20">
        <div className="flex h-14 items-center border-b border-border-subtle md:h-16">
          <Logo />
        </div>
      </header>
      {children}
    </div>
  );
};

export default SpeakerLayout;
