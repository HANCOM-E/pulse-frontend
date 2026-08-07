import { Logo } from '@/components/brand/Logo';

interface EventLayoutProps {
  children: React.ReactNode;
}

/**
 * 참가자 공개 화면(`/e/[code]`, `/live`, `/report`)의 공통 레이아웃입니다.
 *
 * `components/layout/Header`는 쓰지 않습니다. 그 컴포넌트는 `email`·`onLogout`을 필수로 받는
 * 호스트 전용이고, README도 참가자 화면에는 쓰지 말라고 명시하고 있습니다. 참가자는 로그인하지
 * 않아서 넘길 값 자체가 없습니다.
 *
 * 호스트 Header의 반응형 값(`md:h-16`·`md:px-20`)은 따라가지 않습니다. 현재 참가자 화면은 QR로 들어오는
 * 모바일 전용이라 넓은 화면을 위한 단계가 필요 없습니다. 대신 로고를 각 페이지 본문과 같은
 * `max-w-md`·`px-5` 열에 맞췄습니다.
 *
 * 여백은 바깥(`header`), 테두리는 안쪽(`div`)에 겁니다. 이래야 선이 화면 끝이 아니라 로고 왼쪽
 * 끝에서 시작해서 본문 오른쪽 끝에서 멈춥니다. 둘을 한 요소에 몰면 선이 `px-5`까지 덮습니다.
 */
const EventLayout = ({ children }: EventLayoutProps) => {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-md px-5">
        <div className="flex h-14 items-center border-b border-border-subtle">
          <Logo />
        </div>
      </header>
      {children}
    </div>
  );
};

export default EventLayout;
