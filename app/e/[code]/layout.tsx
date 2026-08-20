import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';

/**
 * 참가자 공개 화면(`/e/[code]`, `/live`, `/report`)의 공통 레이아웃입니다.
 *
 * `components/layout/Header`는 쓰지 않습니다. 그 컴포넌트는 `email`·`onLogout`을 필수로 받는
 * 호스트 전용이고, README도 참가자 화면에는 쓰지 말라고 명시하고 있습니다. 참가자는 로그인하지
 * 않아서 넘길 값 자체가 없습니다.
 *
 * `h-14`는 그 Header의 모바일 높이에서 가져온 값입니다(`components/layout/README.md` 스펙 표).
 * 반대로 반응형 단계(`md:h-16`·`md:px-20`)는 따라가지 않습니다. 현재 참가자 화면은 QR로 들어오는
 * 모바일 전용이라 넓은 화면을 위한 단계가 필요 없습니다. 대신 로고를 각 페이지 본문과 같은
 * `max-w-md`·`px-5` 열에 맞췄습니다.
 *
 * 여백은 바깥(`header`), 테두리는 안쪽(`div`)에 겁니다. 이래야 선이 화면 끝이 아니라 로고 왼쪽
 * 끝에서 시작해서 본문 오른쪽 끝에서 멈춥니다. 둘을 한 요소에 몰면 선이 `px-5`까지 덮습니다.
 *
 * `aria-label`에 `Pulse`를 남깁니다. 로고의 `Pulse`는 진짜 텍스트라 그냥 두면 접근 이름이 되는데
 * (`components/brand/README.md`), `aria-label`은 자식 텍스트를 덮어써서 빼면 사라집니다. 그러면
 * 음성 입력 사용자가 화면에 보이는 이름으로 이 링크를 지목할 수 없습니다. 뒷부분이 호스트 Header의
 * "Pulse 홈으로"와 다른 이유는 목적지가 서비스 홈이 아니라 그 이벤트의 홈이기 때문입니다.
 *
 * `not-found.tsx`도 이 레이아웃 안에서 그려집니다. 그때 로고는 방금 404를 낸 주소를 가리키지만
 * 그대로 뒀습니다. 참가자에게는 돌아갈 다른 홈이 없고, 막으려면 레이아웃이 자식이 `not-found`인지
 * 알아야 해서 장치가 더 붙습니다(#239).
 */
const EventLayout = async ({ children, params }: LayoutProps<'/e/[code]'>) => {
  const { code } = await params;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-md px-5">
        <div className="flex h-14 items-center border-b border-border-subtle">
          <Link
            href={`/e/${code}`}
            aria-label="Pulse 이벤트 홈으로"
            className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker"
          >
            <Logo />
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
};

export default EventLayout;
