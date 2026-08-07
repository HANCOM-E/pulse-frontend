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

| | 모바일 | 데스크탑 |
| --- | --- | --- |
| 높이 | `h-14` (56) | `md:h-16` (64) |
| 좌우 padding | `px-5` (20) | `md:px-20` (80) |
| 이메일 | 숨김 | 보임 |

파일을 둘로 나누면 로고 위치나 테두리 색을 바꿀 때 두 번 고쳐야 합니다.

### 공통 스펙

| 항목 | 값 |
| --- | --- |
| 배경 | `bg-background-default` |
| 아래 테두리 | `border-b border-border-subtle` |
| 배치 | `justify-between`, 세로 가운데 |
| 이메일 | 14 / Regular / lh20 / `text-text-secondary` |
| 로그아웃 | 14 / Regular / lh20 / `text-text-secondary`, 상시 밑줄 |
| 이메일·로그아웃 간격 | `gap-4` (16) |

### 주의

- **로그아웃은 `<button>`입니다.** 세션을 지우는 동작이라 링크가 아닙니다. 주소가 바뀌지 않는 것은 링크로 만들지 않습니다.
- **밑줄로 누를 수 있음을 표시합니다.** 색을 바꾸면 헤더에 강조가 하나 더 생겨 로고와 경쟁합니다. hover에서만 `Text/primary`로 진해집니다.
- **로그아웃에 `py-3`이 붙어 있습니다.** 글자 높이가 20이라 그대로 두면 누를 수 있는 영역이 20px뿐입니다. 위아래 12씩 더해 44로 만들었습니다. 헤더 높이가 고정이라 레이아웃에는 영향이 없습니다.
- **긴 이메일은 잘립니다.** `max-w-48`(192)을 넘으면 `...`으로 줄어듭니다. 로고와 로그아웃이 밀리지 않게 하기 위해서입니다.
- **로고를 링크로 감싸는 것은 헤더의 일입니다.** `Logo` 자체는 생김새만 담당합니다.

### 세션은 밖에서 넘깁니다

`email`과 `onLogout`을 props로 받습니다. `hooks/useAuth.ts`를 직접 부르지 않습니다.

Header가 세션을 알면 이 컴포넌트만 따로 보기 어려워지고, 로그인하지 않은 상태를 그려볼 수도 없습니다.

### 클라이언트 컴포넌트입니다

`onLogout`을 `onClick`으로 연결하기 때문에 `'use client'`가 붙어 있습니다.

**호출부도 클라이언트여야 합니다.** 서버 컴포넌트는 함수를 props로 넘길 수 없습니다. `app/(host)/layout.tsx`는 서버 컴포넌트이므로 사이에 얇은 래퍼를 하나 두세요.

```tsx
'use client';

import { Header } from '@/components/layout/Header';
import { useAuth } from '@/hooks/useAuth';

export const HostHeader = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return <Header email={user.email} onLogout={logout} />;
};
```

`'use client'`만 붙이고 서버 레이아웃에서 바로 `<Header onLogout={...} />`를 쓰면 안 됩니다. 지시문은 Header가 클라이언트에서 실행된다는 뜻일 뿐, 서버가 함수를 건네줄 수 있게 해주지는 않습니다.

**Server Action을 안 쓰는 이유.** 토큰이 `lib/authToken.ts`의 `localStorage`에 있어서 로그아웃은 브라우저에서만 할 수 있습니다. 팀이 쿠키로 옮기기로 하면 `<form action={logoutAction}>`으로 바꿀 수 있고 이 래퍼도 필요 없어집니다. 저장 위치가 아직 미정이라 지금 Server Action을 전제하면 안 됩니다.

### 사용 예

```tsx
'use client';

import { Header } from '@/components/layout/Header';

<Header email={user.email} onLogout={handleLogout} />
```

---

## 결정 기록

- 2026.08.06 — Figma는 데스크탑·모바일 두 컴포넌트지만 코드는 하나. 높이·padding·이메일 표시 여부만 반응형 클래스로 처리
- 2026.08.06 — 모바일에서 이메일을 감춤. 자리는 남지만 자기 이메일을 헤더에서 확인할 일이 거의 없고 좁은 화면에서 로고와 경쟁함
- 2026.08.06 — Header를 클라이언트 컴포넌트로 둠. 토큰이 `localStorage`에 있어 로그아웃이 브라우저 동작이라, 쿠키를 전제하는 Server Action을 지금 도입할 수 없음. 저장 위치가 확정되면 `<form action>`으로 바꾸고 래퍼를 없앨 수 있음
- 2026.08.06 — 로그아웃을 밑줄로 표시. 색을 바꾸는 대신 밑줄을 쓰면 강조가 늘어나지 않고, 색을 못 보는 사용자에게도 전달됨. 대시보드의 `전체보기` 링크와 같은 규칙
