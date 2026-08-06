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

`aria-pressed`는 밖에서 못 바꿉니다. props 타입에서 `Omit`으로 빼고 `{...props}`보다 뒤에 두었습니다. `selected`와 어긋난 값이 들어가면 화면과 스크린리더가 다른 말을 하게 됩니다.

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

## Banner

`components/ui/Banner.tsx`

레이아웃 흐름 안에 자리를 차지하는 알림입니다. 문제가 해결되면 사라지고, 그전까지는 남아 있습니다.

### Banner와 Toast의 구분

둘을 가르는 기준은 생김새가 아니라 화면에 놓이는 방식입니다.

| | Banner | Toast |
| --- | --- | --- |
| 위치 | 흐름 안, 자리를 차지 | 화면 위에 떠 있음 |
| 사라짐 | 조건이 해소되면 | 몇 초 뒤 자동 |
| 담당 | 실패 · 주의 | 성공 · 확인 |

**실패를 Toast로 띄우지 마세요.** 몇 초 뒤 사라지므로 다른 곳을 보던 사용자가 놓칩니다.

### 닫기 버튼이 없는 이유

Banner가 사라지는 방식은 두 가지입니다.

| | 사라지는 계기 | 닫기 버튼 |
| --- | --- | --- |
| 조건형 | 문제가 해결되면 렌더를 멈춤 | 필요 없음 |
| 공지형 | 사용자가 읽고 닫음 | 필요함 |

현재 두 type은 모두 조건형입니다. 닫기 버튼을 달면 등록이 여전히 실패한 상태인데 배너만 사라져서, 사용자가 해결된 줄 알고 넘어갑니다. 입력 폼의 오류 메시지에 X 버튼을 안 다는 것과 같은 이유입니다.

```tsx
{isFailed && <Banner type="negative">등록에 실패했어요</Banner>}
```

닫는 것은 코드가 합니다. 공지형 배너가 필요해지면 그때 `onClose` prop을 추가하세요.

### Figma → 코드

| Figma variant | 코드 |
| --- | --- |
| `type=negative` | `type="negative"` |
| `type=warning` | `type="warning"` |

`type`에 기본값이 없습니다. 남은 둘 중 "보통 이것"이라 할 게 없어서, 안 쓰면 타입 에러가 나도록 필수로 두었습니다.

`negative`는 `role="alert"`, `warning`은 `role="status"`로 렌더합니다. 실패는 스크린리더가 하던 말을 끊고 즉시 읽고, 주의는 하던 말이 끝난 뒤 읽습니다.

`role`은 밖에서 못 바꿉니다. props 타입에서 `Omit`으로 빼고, `{...props}`보다 뒤에 두었습니다. 접근성 의미를 컴포넌트가 책임지기 위해서입니다.

### 공통 스펙

| 항목 | 값 |
| --- | --- |
| 높이 | 44 (`py-3` + lh 20) |
| radius | `rounded-lg` (8) |
| 좌우 padding | `px-3.5` (14) |
| 아이콘 gap | `gap-1.5` (6) |
| 아이콘 | 16 × 16, 선 굵기 2.5 |
| 폰트 | 14 / Medium / lh 20 |
| 너비 | Hug — 늘리려면 `className="w-full"` |

### 상태

| type | 배경 | 글자 · 아이콘 | 대비 |
| --- | --- | --- | --- |
| negative | `bg-negative-subtle` | `text-negative-darker` | 8.86:1 |
| warning | `bg-warning-subtle` | `text-warning-darker` | 8.72:1 |

아이콘 색은 `currentColor`라 글자색을 따라갑니다. 타입마다 따로 지정할 필요가 없습니다.

### 주의

- **색만으로 종류를 구분하지 않습니다.** `negative`는 ✕, `warning`은 느낌표로 모양이 다릅니다. 아이콘을 지우지 마세요.
- 아이콘은 뜻이 문구에 이미 있으므로 `aria-hidden`입니다. 스크린리더는 문구만 읽습니다.

### 사용 예

```tsx
import { Banner } from '@/components/ui/Banner';

<Banner type="negative">등록에 실패했어요</Banner>
<Banner type="warning" className="w-full">잠시 후 다시 시도해주세요</Banner>
```

---

## Badge

`components/ui/Badge.tsx`

상태나 분류를 나타내는 표시 전용 꼬리표입니다. 누를 수 없습니다. 누를 수 있으면 Chip입니다.

### Figma → 코드

| Figma variant | 코드 |
| --- | --- |
| `type=positive` | `tone="positive"` |
| `type=neutral` | `tone="neutral"` |
| `type=negative` | `tone="negative"` |
| `type=toxic` | `tone="toxic"` |
| `type=none` | **`tone="outline"`** |

`none`은 코드에서 `outline`입니다. `tone="none"`은 "배지 없음"으로 읽혀서 헷갈립니다. 생김새 기준으로 이름 지었습니다.

**문구는 `children`으로 받습니다.** `긍정`·`독성 의심` 같은 Pulse 도메인 문구가 컴포넌트 안에 들어가지 않도록 하기 위해서입니다. 같은 `positive`라도 감정에는 `긍정`, 이벤트 상태에는 `● LIVE`가 들어갑니다.

`tone`에 기본값이 없습니다. 다섯 중 "보통 이것"이라 할 게 없어서 필수로 두었습니다.

### 공통 스펙

| 항목 | 값 |
| --- | --- |
| 높이 | `h-6` (24) |
| radius | `rounded-full` |
| 좌우 padding | `px-2.5` (10) |
| 폰트 | 12 / Regular / lh 16 |
| 너비 | Hug |

### 상태

| tone | 배경 | 글자 | 대비 |
| --- | --- | --- | --- |
| positive | `bg-positive-subtle` | `text-positive-darker` | 8.21:1 |
| neutral | `bg-neutral-subtle` | `text-neutral-darker` | 8.49:1 |
| negative | `bg-negative-subtle` | `text-negative-darker` | 8.86:1 |
| toxic | `bg-toxic-subtle` | `text-toxic-darker` | 8.98:1 |
| outline | `bg-background-default` + `border-border-strong` | `text-text-secondary` | 6.49:1 |

`outline`만 테두리가 있습니다. 배경이 흰색이라 테두리 없이는 경계가 사라집니다.

### 주의

- **hover도 focus도 없습니다.** 누를 수 없는 요소라 상태가 하나뿐입니다.
- 굵기를 `font-normal`로 고정했습니다. 안 적으면 부모를 상속해서, `font-medium`인 컨테이너 안에 들어갔을 때 시안과 달라집니다.
- 같은 tone을 다른 뜻으로 재사용해도 됩니다. `positive`는 긍정 감정에도, 진행 중인 이벤트에도 씁니다. 나오는 자리가 달라 헷갈리지 않습니다.
- 문구 앞의 기호(`⚑`, `●`)는 문자열의 일부라 호출부에서 넣습니다. 폰트에 없는 기호를 쓰면 다른 폰트로 떨어져 크기가 틀어질 수 있으니 확인하고 쓰세요.

### 사용 예

```tsx
import { Badge } from '@/components/ui/Badge';

<Badge tone="positive">긍정</Badge>
<Badge tone="toxic">⚑ 독성 의심</Badge>
<Badge tone="outline">미분류</Badge>
<Badge tone="positive">● LIVE</Badge>
<Badge tone="neutral">ENDED</Badge>
```

---

## Toast

`components/ui/Toast.tsx`

화면 위에 잠깐 떴다 사라지는 확인 알림입니다. 성공과 확인만 담당합니다. 실패는 Banner로 보내세요.

### 이번에 만든 것은 생김새뿐입니다

띄우는 방식은 들어 있지 않습니다. 아래는 전부 별도 작업입니다.

- 화면 어느 구석에 뜰지
- 여러 개가 동시에 나올 때 쌓는 방식
- 몇 초 뒤 사라질지
- 사라지는 도중 마우스를 올리면 멈출지

이건 컴포넌트가 아니라 훅과 뷰포트 구조라, `hooks/useToast.ts`와 `components/ui/ToastViewport.tsx`로 따로 붙입니다.

### 공통 스펙

| 항목 | 값 |
| --- | --- |
| 높이 | 44 (`py-3` + lh 20) |
| radius | `rounded-lg` (8) |
| 좌우 padding | `px-4` (16) |
| 아이콘 gap | `gap-1.5` (6) |
| 배경 | `bg-background-inverse` |
| 글자 · 아이콘 | `text-text-inverse` |
| 대비 | 13.99:1 |
| 폰트 | 14 / **Regular** / lh 20 |
| 그림자 | `shadow-toast` |

Banner는 Medium, Toast는 Regular입니다. 어두운 배경 위의 흰 글씨는 같은 굵기라도 더 두껍게 보여서, 한 단계 낮춰야 균형이 맞습니다.

### 주의

- **type이 없습니다.** 성공·확인 전용이라 한 가지 모양뿐입니다. 실패를 Toast로 띄우면 몇 초 뒤 사라져서 사용자가 놓칩니다.
- `role="status"`가 고정입니다. 하던 말이 끝난 뒤 읽히므로 사용자의 작업을 방해하지 않습니다.
- 아이콘도 고정입니다. 종류가 하나뿐이라 바꿀 이유가 없습니다.

### 사용 예

```tsx
import { Toast } from '@/components/ui/Toast';

<Toast>링크가 복사되었어요</Toast>
```

---

## icons

`components/ui/icons.tsx`

여러 컴포넌트가 함께 쓰는 아이콘입니다. 모두 16 × 16, 선 굵기 2.5, 끝은 둥글게.

색은 `stroke`와 `fill` 모두 `currentColor`라 부모의 글자색을 따라갑니다. 컴포넌트에서 색을 넘길 필요가 없습니다.

선으로 그린 부분은 `stroke`, `AlertIcon`의 점처럼 면으로 채운 부분은 `fill`을 씁니다. 새 아이콘을 추가할 때도 두 속성 다 `currentColor`로 두세요.

| 이름 | 모양 | 쓰는 곳 |
| --- | --- | --- |
| `CheckIcon` | 체크 | Toast |
| `XIcon` | ✕ | Banner `negative` |
| `AlertIcon` | 느낌표 | Banner `warning` |

모양 기준으로 이름 짓습니다. `XIcon`을 `ErrorIcon`으로 두면 나중에 닫기 버튼에 쓸 때 이름이 어색해집니다.

**모두 장식용입니다.** `aria-hidden="true"`가 고정이라 밖에서 못 켭니다. `<title>`이 없어서 노출시켜도 이름 없는 그래픽으로만 읽히기 때문입니다.

아이콘만 있고 옆에 글자가 없는 버튼을 만들 때는, 아이콘을 노출하지 말고 **버튼에 `aria-label`을 다세요.**

```tsx
<button aria-label="닫기"><XIcon /></button>
```

---

## 미작성

Input · Card · Dialog

Toast를 화면에 띄우는 구조(`useToast` · `ToastViewport`)도 아직입니다.

---

## 결정 기록

- 2026.08.05 — 모더레이션 버튼 높이 32 → 36으로 통일. size는 lg/md/sm 3종만 유지
- 2026.08.06 (#14) — focus 규격은 시안에 정의가 없어 코드에서 정함 (`Primary/default` 2px, offset 2)
- 2026.08.06 (#14) — primary·secondary hover 색 확정. 이때 추가한 신규 토큰은 `Primary/pressed`(#036176) 하나
- 2026.08.06 (#16) — danger 배경을 `Negative/default`(3.87:1, AA 미달)에서 `Negative/darker`(10.21:1)로 교체. hover용 `Negative/pressed`(#4F1D0D) 신설. `Negative/default` 값은 그대로 둬서 부정 감정 차트·배지는 영향 없음
- 2026.08.06 (#15) — Chip의 `state` variant를 `selected` 불리언으로 매핑. 필터는 `<button>`으로 렌더하고 `aria-pressed`를 붙임. 표시 전용 꼬리표는 Chip이 아니라 Badge가 담당하기로 함
- 2026.08.06 (#15) — Chip 선택 상태 hover는 배경 대신 테두리를 진하게 함. `Primary/lighter` 배경은 텍스트 대비 3.79:1로 AA 미달. 신규 토큰 없음
- 2026.08.06 (#21) — Banner에서 `positive` variant 제거. 성공 알림은 Toast가 담당하므로 흐름 안에 남을 이유가 없음. 필요해지면 다시 추가
- 2026.08.06 (#21) — Banner의 `type`은 기본값 없이 필수. 남은 둘 다 나쁜 소식이라 기본값을 두면 실패가 조용히 주의 색으로 뜰 수 있음
- 2026.08.06 (#21) — 아이콘을 텍스트 글자에서 벡터로 교체하고 `icons.tsx`로 분리. `✔️` 같은 이모지는 지정한 색이 안 먹고 OS마다 다르게 렌더됨. 신규 토큰 없음
- 2026.08.06 — Badge의 `LIVE`·`ENDED` variant 삭제. `LIVE`는 `positive`와 색이 완전히 같았고 `ENDED`는 `neutral`과 배경이 같은데 글자색만 달랐음. 색이 같은 variant를 따로 두면 한쪽만 고쳐져 어긋남. 문구만 바꿔 쓰는 방식으로 통일
- 2026.08.06 — Badge `none`의 글자색을 `Text/tertiary`(3.61:1, AA 미달)에서 `Text/secondary`(6.49:1)로 교체. 테두리는 `Border/strong` 유지 — 배지는 조작 요소가 아니라 3:1 규정 대상이 아니고, 이 시스템에서 가장 진한 테두리 토큰임
- 2026.08.06 — Badge 문구를 `children`으로 받음. `긍정`·`독성 의심` 같은 도메인 문구가 `ui/` 안에 들어가지 않게 하기 위함. Figma의 `none`은 코드에서 `outline`으로 이름 변경
- 2026.08.06 — Toast는 생김새만 만들고 띄우는 방식은 분리. 위치·스택·타이머는 컴포넌트가 아니라 훅과 뷰포트의 일이라 섞으면 Toast가 비대해짐. 신규 토큰은 `--shadow-toast` 하나
- 2026.08.06 — Toast 폰트를 Regular로. Banner는 Medium인데, 어두운 배경 위 흰 글씨는 같은 굵기라도 두껍게 보여서 한 단계 낮춰야 균형이 맞음
- 2026.08.06 (#23) — 컴포넌트가 계산하는 접근성 속성은 밖에서 못 바꾸게 막는다. props 타입에서 `Omit`으로 빼고 JSX에서도 `{...props}` 뒤에 배치한다. 타입만 막으면 느슨한 객체를 펼칠 때 런타임에서 뚫린다. 현재 대상은 Banner의 `role`, Chip의 `aria-pressed`, 아이콘의 `aria-hidden`
- 2026.08.06 (#21) — Banner에 닫기 버튼을 넣지 않음. 현재 두 type이 모두 조건형이라, 닫으면 문제가 남아 있는데 표시만 사라짐. 공지형이 생기면 그때 `onClose` 추가