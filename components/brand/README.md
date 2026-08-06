# components/brand

Pulse의 브랜드 자산입니다. 로고, 워드마크처럼 서비스 정체성을 담은 것만 여기 둡니다.

`components/ui/`와 갈리는 지점은 이렇습니다. `ui/`는 Pulse가 뭐 하는 서비스인지 몰라도 이해되는 것들이고, 여기는 Pulse 그 자체입니다.

---

## Logo

`components/brand/Logo.tsx`

심볼과 워드마크를 묶은 lockup입니다. 헤더에서 씁니다.

### 스펙

| 항목 | 값 |
| --- | --- |
| 전체 크기 | 86 × 39 |
| 심볼 | 44 × 39 |
| 간격 | `gap-1` (4) |
| 워드마크 | 16 / SemiBold / lh 24 / `tracking-tighter` |

데스크탑과 모바일이 같은 크기입니다.

### 색

| | 토큰 | 지정 |
| --- | --- | --- |
| 심볼 | `Primary/default` | `text-primary-default` + `stroke="currentColor"` |
| 워드마크 | `Primary/darker` | `text-primary-darker` |

심볼을 `currentColor`로 둔 이유는 어두운 배경용 흰색 로고가 필요해질 때 클래스 하나만 바꾸면 되기 때문입니다.

### 주의

- **`Pulse`는 진짜 텍스트입니다.** SVG 패스로 바꾸지 마세요. 스크린리더가 로고를 이름으로 읽고, 복사할 수 있고, 폰트 크기 설정을 따릅니다. 심볼은 `aria-hidden`이라 따로 `aria-label`을 붙일 필요가 없습니다.
- **링크는 여기 없습니다.** 헤더에서 로고를 누르면 홈으로 가지만, 그건 헤더가 할 일입니다. Logo는 생김새만 담당합니다.
- 자간 `-5%`는 Tailwind의 `tracking-tighter`(-0.05em)와 정확히 같습니다. 임의값을 쓰지 마세요.

### 사용 예

```tsx
import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';

<Logo />
```

헤더처럼 눌러서 이동해야 하는 자리에서는 **밖에서 감쌉니다.** Logo에 `href` prop을 붙이지 마세요.

```tsx
<Link href="/">
  <Logo />
</Link>
```

---

## 결정 기록

- 2026.08.06 — Logo를 `ui/`가 아니라 `brand/`에 둠. 로고는 그 자체가 브랜드라 "Pulse를 몰라도 이해되는가" 기준에 맞지 않음
- 2026.08.06 — lockup 간격을 시안의 8에서 4로 줄임. 심볼 SVG 오른쪽에 여백 4가 들어 있어 8로 두면 눈에는 12로 보임. 로고를 단독으로 쓸 때(파비콘·OG 이미지)는 이 여백이 따라오므로 그때 SVG를 다시 잘라야 함
- 2026.08.06 — 워드마크를 텍스트로 유지. 패스로 만들면 접근성·복사·폰트 크기 대응을 모두 잃음
