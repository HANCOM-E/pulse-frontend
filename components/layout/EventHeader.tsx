import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';
import { ChevronLeftIcon } from '@/components/ui/icons';

/**
 * 참가자 공개 화면의 헤더입니다.
 *
 * 화면마다 모양이 달라야 해서 레이아웃이 아니라 각 페이지가 부릅니다. 레이아웃에 두면
 * 다섯 화면이 한 헤더를 공유하게 되고, 게임·라이브·리포트에서만 뒤로가기를 띄우려면
 * `usePathname`을 쓰려고 레이아웃을 클라이언트로 내려야 합니다(#308).
 *
 * `components/layout/Header`는 쓰지 않습니다. 그 컴포넌트는 `email`·`onLogout`을 필수로
 * 받는 호스트 전용이고, 참가자는 로그인하지 않아서 넘길 값 자체가 없습니다.
 *
 * `h-14`는 그 Header의 모바일 높이에서 가져온 값입니다(`components/layout/README.md` 스펙 표).
 * 반대로 반응형 단계(`md:h-16`·`md:px-20`)는 따라가지 않습니다. 참가자 화면은 QR로 들어오는
 * 모바일 전용이라 넓은 화면을 위한 단계가 필요 없습니다.
 *
 * 여백은 바깥(`header`), 테두리는 안쪽(`div`)에 겁니다. 이래야 선이 화면 끝이 아니라 로고
 * 왼쪽 끝에서 시작해서 본문 오른쪽 끝에서 멈춥니다. 둘을 한 요소에 몰면 선이 `px-5`까지 덮습니다.
 */

const FOCUS =
  'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker';

interface EventHeaderProps {
  /** 뒤로가기와 로고가 가리킬 이벤트 홈입니다. 404 화면처럼 코드를 모르면 넘기지 않습니다. */
  eventCode?: string;
  /** 넘기면 로고 대신 「← 이름」이 됩니다. */
  title?: string;
}

const EventHeader = ({ eventCode, title }: EventHeaderProps) => {
  return (
    <header className="mx-auto w-full max-w-md px-5">
      <div className="flex h-14 items-center gap-2 border-b border-border-subtle">
        {title !== undefined && eventCode !== undefined ? (
          <>
            <Link
              href={`/e/${eventCode}`}
              aria-label="소감 화면으로 돌아가기"
              className={`-ml-1 flex cursor-pointer items-center rounded p-1 text-text-secondary hover:bg-background-secondary ${FOCUS}`}
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </Link>
            {/*
              `h1`이 아닙니다. 세 화면 다 본문에 제목이 이미 있어서, 여기를 제목 요소로 만들면
              스크린리더에서 제목이 둘로 갈립니다.
            */}
            <p className="text-base font-semibold leading-6 text-text-primary">{title}</p>
          </>
        ) : eventCode !== undefined ? (
          /*
            `aria-label`에 `Pulse`를 남깁니다. 로고의 `Pulse`는 진짜 텍스트라 그냥 두면 접근
            이름이 되는데, `aria-label`은 자식 텍스트를 덮어써서 빼면 사라집니다. 뒷부분이 호스트
            Header의 "Pulse 홈으로"와 다른 이유는 목적지가 서비스 홈이 아니라 그 이벤트의
            홈이기 때문입니다.
          */
          <Link href={`/e/${eventCode}`} aria-label="Pulse 이벤트 홈으로" className={FOCUS}>
            <Logo />
          </Link>
        ) : (
          /*
            404 화면입니다. `not-found.tsx`는 `params`를 못 받아 이벤트 코드를 모릅니다.
            예전에는 레이아웃이 코드를 갖고 있어서 로고가 방금 404를 낸 주소를 가리켰는데(#239),
            갈 데가 없으면 링크를 안 거는 게 맞습니다.
          */
          <Logo />
        )}
      </div>
    </header>
  );
};

export { EventHeader };
