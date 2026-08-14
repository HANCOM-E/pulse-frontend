# components/layout

화면 전체의 뼈대입니다. 여러 페이지가 공유하는 머리·꼬리·감싸는 틀이 여기 있습니다.

`components/ui/`가 부품이라면 여기는 부품을 배치하는 자리입니다.

---

## Header

`components/layout/Header.tsx`

호스트 화면의 상단 바입니다. 로고, 이메일, 로그아웃으로 구성됩니다.

**참가자 화면에는 쓰지 않습니다.** 참가자는 로그인하지 않아서 이메일도 로그아웃도 없습니다.

### 컴포넌트가 하나인 이유

Figma에는 `Header/Desktop`과 `Header/mobile` 두 개가 있지만 코드는 하나입니다. 구조가 같고 세 가지만 다릅니다.

|              | 모바일      | 데스크탑        |
| ------------ | ----------- | --------------- |
| 높이         | `h-14` (56) | `md:h-16` (64)  |
| 좌우 padding | `px-5` (20) | `md:px-20` (80) |
| 이메일       | 숨김        | 보임            |

파일을 둘로 나누면 로고 위치나 테두리 색을 바꿀 때 두 번 고쳐야 합니다.

### 공통 스펙

| 항목                 | 값                                                     |
| -------------------- | ------------------------------------------------------ |
| 배경                 | `bg-background-default`                                |
| 아래 테두리          | `border-b border-border-subtle`                        |
| 배치                 | `justify-between`, 세로 가운데                         |
| 이메일               | 14 / Regular / lh20 / `text-text-secondary`            |
| 로그아웃             | 14 / Regular / lh20 / `text-text-secondary`, 상시 밑줄 |
| 이메일·로그아웃 간격 | `gap-4` (16)                                           |

### 주의

- **로그아웃은 `<button>`입니다.** 세션을 지우는 동작이라 링크가 아닙니다. 주소가 바뀌지 않는 것은 링크로 만들지 않습니다.
- **밑줄로 누를 수 있음을 표시합니다.** 색을 바꾸면 헤더에 강조가 하나 더 생겨 로고와 경쟁합니다. hover에서만 `Text/primary`로 진해집니다.
- **로그아웃에 `py-3`이 붙어 있습니다.** 글자 높이가 20이라 그대로 두면 누를 수 있는 영역이 20px뿐입니다. 위아래 12씩 더해 44로 만들었습니다. 헤더 높이가 고정이라 레이아웃에는 영향이 없습니다.
- **로그아웃에 `cursor-pointer`가 붙어 있습니다.** `<button>`의 브라우저 기본 커서는 `cursor: default`라, 스타일이 있는 `components/ui/Button.tsx`(이슈 #106에서 `cursor-pointer`를 추가함)와 달리 이 버튼은 공용 컴포넌트를 쓰지 않아서 직접 붙여야 합니다.
- **긴 이메일은 잘립니다.** `max-w-48`(192)을 넘으면 `...`으로 줄어듭니다. 로고와 로그아웃이 밀리지 않게 하기 위해서입니다.
- **로고를 링크로 감싸는 것은 헤더의 일입니다.** `Logo` 자체는 생김새만 담당합니다. 링크에도 포커스 링이 붙습니다 — 헤더의 첫 탭 정지점이라 여기가 비어 있으면 브라우저 기본 링이 나옵니다.

### 세션은 밖에서 넘깁니다

`email`·`onLogout`·`isEmailLoading`을 props로 받습니다. `hooks/useAuth.ts`를 직접 부르지 않습니다.

Header가 세션을 알면 이 컴포넌트만 따로 보기 어려워지고, 로그인하지 않은 상태를 그려볼 수도 없습니다.

### 클라이언트 컴포넌트입니다

`onLogout`을 `onClick`으로 연결하기 때문에 `'use client'`가 붙어 있습니다.

**호출부도 클라이언트여야 합니다.** 서버 컴포넌트는 함수를 props로 넘길 수 없습니다. `app/(host)/layout.tsx`는 서버 컴포넌트이므로 사이에 얇은 래퍼를 하나 두세요.

실제 래퍼는 `components/layout/HostHeader.tsx`입니다. `app/(host)/layout.tsx`가 이 컴포넌트를 렌더링합니다.

```tsx
'use client';

import { usePathname } from 'next/navigation';

import { Header } from '@/components/layout/Header';
import useAuth from '@/hooks/useAuth';

const HEADER_HIDDEN_PATHS = ['/login', '/signup'];

const HostHeader = () => {
  const pathname = usePathname();

  if (HEADER_HIDDEN_PATHS.includes(pathname)) {
    return null;
  }

  return <SessionHeader />;
};

const SessionHeader = () => {
  const { user, logout, isLoading: isEmailLoading } = useAuth();

  return <Header email={user?.email ?? ''} onLogout={logout} isEmailLoading={isEmailLoading} />;
};

export { HostHeader };
```

`/login`·`/signup`도 `app/(host)` 밑에 있어서, 이 pathname 확인이 없으면 로그인하지 않은 사용자에게도 Header가 노출됩니다. 이 확인은 `Header`가 아니라 `HostHeader`가 맡습니다 — `Header`가 라우팅까지 알게 되면 세션과 마찬가지로 이 컴포넌트만 따로 보기 어려워지기 때문입니다.

`useAuth()`는 `HostHeader`가 아니라 `SessionHeader` 안에서 부릅니다. 훅은 조건 없이 항상 실행되므로, `HostHeader`에서 직접 불렀다면 `/login`에서도 세션 확인 요청이 나가버립니다. `SessionHeader`를 따로 둬서, `/login`·`/signup`에서는 이 컴포넌트 자체가 마운트되지 않게 만들었습니다.

`'use client'`만 붙이고 서버 레이아웃에서 바로 `<Header onLogout={...} />`를 쓰면 안 됩니다. 지시문은 Header가 클라이언트에서 실행된다는 뜻일 뿐, 서버가 함수를 건네줄 수 있게 해주지는 않습니다.

**Server Action을 안 쓰는 이유.** 2026-08-07 명세에서 토큰이 HttpOnly 쿠키(`accessToken`)로 확정됐지만, 그래도 로그아웃은 브라우저에서 해야 합니다. 이 쿠키는 API 도메인 소유(`SameSite=None`)라 Next 서버의 `cookies()`로는 보이지 않고, Server Action이 `POST /auth/logout`을 대신 불러도 만료시킬 쿠키를 가지고 있지 않습니다. `lib/api/endpoints.ts`의 `logout()`을 클라이언트에서 부르세요.

### 사용 예

```tsx
'use client';

import { Header } from '@/components/layout/Header';

<Header email={user.email} onLogout={handleLogout} />;
```

---

## 결정 기록

- 2026.08.06 — Figma는 데스크탑·모바일 두 컴포넌트지만 코드는 하나. 높이·padding·이메일 표시 여부만 반응형 클래스로 처리
- 2026.08.07 (#59) — 로고 링크에 포커스 링을 추가. 헤더의 첫 탭 정지점인데 스타일이 없어 브라우저 기본 링(검정+흰색 이중선)이 나오고 있었음. 링 색은 `ui/README.md`의 공통 focus 규격을 따름
- 2026.08.06 — 모바일에서 이메일을 감춤. 자리는 남지만 자기 이메일을 헤더에서 확인할 일이 거의 없고 좁은 화면에서 로고와 경쟁함
- 2026.08.06 — Header를 클라이언트 컴포넌트로 둠. 토큰이 `localStorage`에 있어 로그아웃이 브라우저 동작이라, 쿠키를 전제하는 Server Action을 지금 도입할 수 없음. 저장 위치가 확정되면 `<form action>`으로 바꾸고 래퍼를 없앨 수 있음
- 2026.08.10 (#69) — 저장 위치가 HttpOnly 쿠키로 확정됐지만 Header는 클라이언트로 유지. 쿠키가 API 도메인 소유라 Next 서버가 읽지도 만료시키지도 못해서, `<form action>` 전환은 여전히 불가능함
- 2026.08.06 — 로그아웃을 밑줄로 표시. 색을 바꾸는 대신 밑줄을 쓰면 강조가 늘어나지 않고, 색을 못 보는 사용자에게도 전달됨. 대시보드의 `전체보기` 링크와 같은 규칙
- 2026.08.14 (#158) — `HostHeader`를 실제 코드로 구현하고 `app/(host)/layout.tsx`에 연결. 기존에는 `EventsListPage` 하나에서만 `Header`를 직접 렌더링해서, `app/(host)` 밑에 화면이 늘어날 때마다 각자 세션을 다시 연결해야 했음. `HostHeader`에 pathname 확인도 같이 넣어 `/login`·`/signup`에서는 `Header`를 숨김
- 2026.08.14 (#171) — 로그아웃 버튼에 `cursor-pointer` 추가. 공용 `Button`·`Chip`은 이슈 #106에서 이미 고쳤지만 이 버튼은 그 컴포넌트를 안 써서 빠져 있었음
