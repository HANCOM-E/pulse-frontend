# components/ui

Figma 디자인 시스템을 코드로 옮긴 공용 컴포넌트입니다.
색·크기·모양만 알고, 서비스의 개념은 모르는 것만 여기 둡니다.
문구와 동작은 전부 props로 받습니다.

판단 기준: 그 파일만 열었을 때 Pulse가 뭐 하는 서비스인지 몰라도 이해되면 ui/입니다.
감정 종류·독성 플래그 같은 매핑이 파일 안에 들어가면 components/<도메인>/으로 보내세요.

## 규칙

- 화살표 함수형으로 선언, 파일명은 컴포넌트명(PascalCase)과 일치
- import는 절대경로 `@/components/ui/Button`
- 색·radius는 토큰 클래스만 사용 (`bg-primary-darker`, `border-border-default`)
- 하드코딩 hex 금지

## Figma variant ≠ 코드 prop

Figma는 "어떻게 생겼는가"를, 코드는 "어떤 상태인가"를 표현합니다.
둘이 1:1로 대응하지 않는 경우가 있으니 아래 표를 기준으로 하세요.

---

## Button

`components/ui/Button.tsx`

### Figma → 코드

| Figma variant | 코드 |
| --- | --- |
| `type=primary` | `variant="primary"` (기본값) |
| `type=secondary` | `variant="secondary"` |
| `type=danger` | `variant="danger"` |
| `type=disabled` | **`disabled` 속성** — variant 아님 |

`disabled`를 variant로 만들면 회색으로 보이지만 클릭이 되는 버튼이 생깁니다.
HTML `disabled` 속성을 쓰면 브라우저가 클릭·포커스·폼 제출을 막고
스크린리더에도 "사용 불가"로 전달됩니다. 스타일은 `disabled:` 유틸리티가 처리합니다.

### size

Figma 마스터 높이는 52이고, 화면에서는 인스턴스로 조정되어 있습니다.

| prop | 높이 | 쓰는 곳 |
| --- | --- | --- |
| `lg` | 52 | 모바일 주요 버튼 |
| `md` | 48 | 기본 (로그인, 다이얼로그) |
| `sm` | 36 | 대시보드 상단 액션, 모더레이션 |

### 공통 스펙

| 항목 | 값 |
| --- | --- |
| radius | `rounded-lg` (8) |
| 좌우 padding | `px-5` (20) |
| 아이콘 gap | `gap-2.5` (10) |
| 폰트 | 16 / SemiBold / lh 24 |
| 너비 | Hug — 늘리려면 `className="w-full"` |

### 주의

- `type` 기본값이 `"button"`입니다. 폼 제출 버튼에는 `type="submit"`을 명시하세요.

### 상태

| variant | 기본 | 기본 대비 | hover | hover 대비 |
| --- | --- | --- | --- | --- |
| primary | `bg-primary-darker` | 5.55:1 | `hover:bg-primary-pressed` | 7.06:1 |
| secondary | `bg-background-default` | 13.99:1 | `hover:bg-background-muted` | 12.16:1 |
| danger | `bg-negative-darker` | 10.21:1 | `hover:bg-negative-pressed` | 13.87:1 |

세 variant 모두 기본과 hover 양쪽에서 WCAG AA(4.5:1)를 충족합니다.
`Primary/default`와 `Negative/default`는 흰 글씨를 받으면 각각 2.65:1, 3.87:1로 미달하므로
버튼 배경으로 쓰지 마세요. 두 색은 아이콘·그래프·테두리 등 텍스트가 얹히지 않는 자리에 씁니다.

focus는 `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-default`.
`border`가 아니라 `outline`입니다. border로 만들면 버튼 크기가 밀립니다.

### danger 사용 원칙

대비는 충족했지만 색만으로는 위험을 전달할 수 없습니다. 색각 이상 사용자에게 빨강과 회색은 비슷하게 보입니다.

- **문구에 행동을 명시하세요.** `삭제` ○ / `확인` ✕
- 되돌릴 수 없는 동작은 danger 버튼 하나로 끝내지 말고 확인 다이얼로그를 거칩니다
- 한 화면에 danger 버튼을 여러 개 두지 마세요. 강조가 분산되면 없는 것과 같습니다

### 사용 예

```tsx
import { Button } from '@/components/ui/Button';

<Button type="submit" size="lg" className="w-full">로그인</Button>
<Button variant="secondary" size="sm">링크 복사</Button>
<Button variant="danger">삭제</Button>
<Button disabled>요약 생성</Button>
```

---

## Chip

`components/ui/Chip.tsx`

선택할 수 있는 필터입니다. 표시 전용 꼬리표는 Chip이 아니라 Badge를 쓰세요.

### Figma → 코드

| Figma variant | 코드 |
| --- | --- |
| `state=default` | 기본값 |
| `state=selected` | **`selected` prop** — variant 아님 |

값이 둘뿐이고 켜고 끄는 성격이라 `variant="selected"`보다 `selected` 불리언이 자연스럽습니다.
`<Chip selected={filter === 'A'}>`처럼 상태와 바로 연결됩니다.

`aria-pressed`가 자동으로 붙습니다. 선택 여부를 배경색으로만 표시하면 스크린리더에 전달되지 않기 때문입니다.

### 공통 스펙

| 항목 | 값 |
| --- | --- |
| 높이 | `h-8` (32) |
| radius | `rounded-full` |
| 좌우 padding | `px-3.5` (14) |
| 아이콘 gap | `gap-2.5` (10) |
| 폰트 | 14 / lh 20 |
| 테두리 | 1 |
| 너비 | Hug — 늘리려면 `className="w-full"` |

### 상태

| 상태 | 배경 | 테두리 | 텍스트 | 굵기 | 대비 |
| --- | --- | --- | --- | --- | --- |
| 미선택 | `bg-background-default` | `border-border-default` | `text-text-secondary` | Regular | 6.49:1 |
| 미선택 hover | `bg-background-muted` | `border-border-default` | `text-text-secondary` | Regular | 5.64:1 |
| 선택 | `bg-primary-subtle` | `border-primary-default` | `text-primary-darker` | Medium | 5.05:1 |
| 선택 hover | `bg-primary-subtle` | `border-primary-darker` | `text-primary-darker` | Medium | 5.05:1 |
| disabled | `bg-background-muted` | `border-border-subtle` | `text-text-disabled` | Regular | — |

focus는 Button과 같습니다. `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-default`

선택 상태의 hover는 배경이 아니라 테두리를 진하게 합니다.
배경을 `Primary/lighter`로 채우면 텍스트 대비가 3.79:1로 떨어져 AA에 미달하기 때문입니다.

### 주의

- 선택 시 글자 굵기가 Regular → Medium으로 바뀌어 칩 너비가 1~2px 늘어납니다. 시안이 그렇게 정의돼 있어 그대로 구현했습니다. 여러 칩이 줄바꿈되는 곳에서 흔들림이 거슬리면 양쪽 다 Medium으로 통일하세요.
- disabled는 선택 여부와 무관하게 같은 회색입니다. 상태 표시보다 조작 불가 표시가 우선입니다.

### 사용 예

```tsx
import { Chip } from '@/components/ui/Chip';

<Chip selected={sessionId === 'A'} onClick={() => handleSelect('A')}>
  세션 A
</Chip>
<Chip disabled>세션 C</Chip>
```

---

## 미작성

Badge · Input · Card · Toast · Dialog

---

## 결정 기록

- 2026.08.05 — 모더레이션 버튼 높이 32 → 36으로 통일. size는 lg/md/sm 3종만 유지
- 2026.08.06 (#14) — focus 규격은 시안에 정의가 없어 코드에서 정함 (`Primary/default` 2px, offset 2)
- 2026.08.06 (#14) — primary·secondary hover 색 확정. 이때 추가한 신규 토큰은 `Primary/pressed`(#036176) 하나
- 2026.08.06 (#16) — danger 배경을 `Negative/default`(3.87:1, AA 미달)에서 `Negative/darker`(10.21:1)로 교체. hover용 `Negative/pressed`(#4F1D0D) 신설. `Negative/default` 값은 그대로 둬서 부정 감정 차트·배지는 영향 없음
- 2026.08.06 (#15) — Chip의 `state` variant를 `selected` 불리언으로 매핑. 필터는 `<button>`으로 렌더하고 `aria-pressed`를 붙임. 표시 전용 꼬리표는 Chip이 아니라 Badge가 담당하기로 함
- 2026.08.06 (#15) — Chip 선택 상태 hover는 배경 대신 테두리를 진하게 함. `Primary/lighter` 배경은 텍스트 대비 3.79:1로 AA 미달. 신규 토큰 없음