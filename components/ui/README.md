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

## focus

**Button · Chip · Input · Textarea · Header에 공통으로 적용됩니다.**

| 항목   | 값               |
| ------ | ---------------- |
| 색     | `Primary/darker` |
| 두께   | 2                |
| offset | 2                |

```text
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker
```

`border`가 아니라 `outline`입니다. border로 만들면 요소 크기가 밀립니다.

`focus`가 아니라 `focus-visible`입니다. 키보드로 이동할 때만 보이고 마우스로 누를 때는 안 나타납니다.

**컴포넌트마다 새로 정하지 마세요.** 여기서 한 번만 정의합니다. Figma도 마찬가지로 링을 컴포넌트 안에 그리지 않고 디자인 시스템 페이지의 States 프레임에만 적어둡니다. 오토레이아웃 안에 링을 넣으면 자기 자리를 차지해서 레이아웃이 밀립니다.

### 색이 `Primary/darker`인 이유

`Primary/default`는 어느 배경에서도 3:1을 못 넘깁니다.

| 배경                 | `Primary/default` | `Primary/darker` |
| -------------------- | ----------------- | ---------------- |
| `background/default` | 2.62:1            | 5.55:1           |
| `background/surface` | 2.51:1            | 5.31:1           |
| `background/muted`   | 2.28:1            | 4.82:1           |

브라우저 기본 포커스 표시를 지우고 이 링으로 대체했기 때문에, 링이 안 보이면 키보드로만 조작하는 사용자는 지금 어디에 있는지 알 수 없습니다. WCAG 1.4.11의 3:1이 기준입니다.

**링은 언제나 `Primary/darker`입니다.** 어느 컴포넌트든, 어떤 상태든 바뀌지 않습니다.

Input·Textarea는 링에 더해 테두리 색도 바뀌는데, **여기에는 예외가 하나 있습니다.**

| 상태            | 링               | 테두리                  |
| --------------- | ---------------- | ----------------------- |
| 기본            | `Primary/darker` | `Primary/darker`        |
| 오류(`invalid`) | `Primary/darker` | `Negative/default` 유지 |

오류일 때 테두리까지 파랗게 바뀌면 문제가 아직 안 풀렸는데 표시가 사라집니다. 링만으로도 포커스 위치는 보입니다.

이 예외 말고는 색을 따로 정하지 마세요. 링과 테두리 규칙이 갈라지면 한쪽만 고쳐집니다.

### 두께는 px입니다

`outline-2`와 `outline-offset-2`는 rem으로 바꾸지 마세요.

CLAUDE.md의 단위 규칙은 "폰트·간격은 rem, px은 1px 고정값(border 등)에만"입니다. outline은 간격이 아니라 테두리와 같은 성격의 선입니다. 글자 크기에 따라 포커스 링이 굵어질 이유가 없고, `outline-[0.125rem]`처럼 쓰면 읽기만 어려워집니다.

---

## Button

`components/ui/Button.tsx`

### Figma → 코드

| Figma variant    | 코드                               |
| ---------------- | ---------------------------------- |
| `type=primary`   | `variant="primary"` (기본값)       |
| `type=secondary` | `variant="secondary"`              |
| `type=danger`    | `variant="danger"`                 |
| `type=disabled`  | **`disabled` 속성** — variant 아님 |

`disabled`를 variant로 만들면 회색으로 보이지만 클릭이 되는 버튼이 생깁니다.
HTML `disabled` 속성을 쓰면 브라우저가 클릭·포커스·폼 제출을 막고
스크린리더에도 "사용 불가"로 전달됩니다. 스타일은 `disabled:` 유틸리티가 처리합니다.

### size

Figma 마스터 높이는 52이고, 화면에서는 인스턴스로 조정되어 있습니다.

| prop | 높이 | 쓰는 곳                        |
| ---- | ---- | ------------------------------ |
| `lg` | 52   | 모바일 주요 버튼               |
| `md` | 48   | 기본 (로그인, 다이얼로그)      |
| `sm` | 36   | 대시보드 상단 액션, 모더레이션 |

### 공통 스펙

| 항목         | 값                                  |
| ------------ | ----------------------------------- |
| radius       | `rounded-lg` (8)                    |
| 좌우 padding | `px-5` (20)                         |
| 아이콘 gap   | `gap-2.5` (10)                      |
| 폰트         | 16 / SemiBold / lh 24               |
| 너비         | Hug — 늘리려면 `className="w-full"` |

### 주의

- `type` 기본값이 `"button"`입니다. 폼 제출 버튼에는 `type="submit"`을 명시하세요.

### 상태

| variant   | 기본                    | 기본 대비 | hover                       | hover 대비 |
| --------- | ----------------------- | --------- | --------------------------- | ---------- |
| primary   | `bg-primary-darker`     | 5.55:1    | `hover:bg-primary-pressed`  | 7.06:1     |
| secondary | `bg-background-default` | 13.99:1   | `hover:bg-background-muted` | 12.16:1    |
| danger    | `bg-negative-darker`    | 10.21:1   | `hover:bg-negative-pressed` | 13.87:1    |

세 variant 모두 기본과 hover 양쪽에서 WCAG AA(4.5:1)를 충족합니다.
`Primary/default`와 `Negative/default`는 흰 글씨를 받으면 각각 2.65:1, 3.87:1로 미달하므로
버튼 배경으로 쓰지 마세요. 두 색은 아이콘·그래프·테두리 등 텍스트가 얹히지 않는 자리에 씁니다.

focus는 `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker`.
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

| Figma variant    | 코드                               |
| ---------------- | ---------------------------------- |
| `state=default`  | 기본값                             |
| `state=selected` | **`selected` prop** — variant 아님 |

값이 둘뿐이고 켜고 끄는 성격이라 `variant="selected"`보다 `selected` 불리언이 자연스럽습니다.
`<Chip selected={filter === 'A'}>`처럼 상태와 바로 연결됩니다.

`aria-pressed`가 자동으로 붙습니다. 선택 여부를 배경색으로만 표시하면 스크린리더에 전달되지 않기 때문입니다.

`aria-pressed`는 밖에서 못 바꿉니다. props 타입에서 `Omit`으로 빼고 `{...props}`보다 뒤에 두었습니다. `selected`와 어긋난 값이 들어가면 화면과 스크린리더가 다른 말을 하게 됩니다.

### 공통 스펙

| 항목         | 값                                  |
| ------------ | ----------------------------------- |
| 높이         | `h-8` (32)                          |
| radius       | `rounded-full`                      |
| 좌우 padding | `px-3.5` (14)                       |
| 아이콘 gap   | `gap-2.5` (10)                      |
| 폰트         | 14 / lh 20                          |
| 테두리       | 1                                   |
| 너비         | Hug — 늘리려면 `className="w-full"` |

### 상태

| 상태         | 배경                    | 테두리                   | 텍스트                | 굵기    | 대비   |
| ------------ | ----------------------- | ------------------------ | --------------------- | ------- | ------ |
| 미선택       | `bg-background-default` | `border-border-default`  | `text-text-secondary` | Regular | 6.49:1 |
| 미선택 hover | `bg-background-muted`   | `border-border-default`  | `text-text-secondary` | Regular | 5.64:1 |
| 선택         | `bg-primary-subtle`     | `border-primary-default` | `text-primary-darker` | Medium  | 5.05:1 |
| 선택 hover   | `bg-primary-subtle`     | `border-primary-darker`  | `text-primary-darker` | Medium  | 5.05:1 |
| disabled     | `bg-background-muted`   | `border-border-subtle`   | `text-text-disabled`  | Regular | —      |

focus는 Button과 같습니다. `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker`

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

|        | Banner               | Toast             |
| ------ | -------------------- | ----------------- |
| 위치   | 흐름 안, 자리를 차지 | 화면 위에 떠 있음 |
| 사라짐 | 조건이 해소되면      | 몇 초 뒤 자동     |
| 담당   | 실패 · 주의          | 성공 · 확인       |

**실패를 Toast로 띄우지 마세요.** 몇 초 뒤 사라지므로 다른 곳을 보던 사용자가 놓칩니다.

### 닫기 버튼이 없는 이유

Banner가 사라지는 방식은 두 가지입니다.

|        | 사라지는 계기               | 닫기 버튼 |
| ------ | --------------------------- | --------- |
| 조건형 | 문제가 해결되면 렌더를 멈춤 | 필요 없음 |
| 공지형 | 사용자가 읽고 닫음          | 필요함    |

현재 두 type은 모두 조건형입니다. 닫기 버튼을 달면 등록이 여전히 실패한 상태인데 배너만 사라져서, 사용자가 해결된 줄 알고 넘어갑니다. 입력 폼의 오류 메시지에 X 버튼을 안 다는 것과 같은 이유입니다.

```tsx
{
  isFailed && <Banner type="negative">등록에 실패했어요</Banner>;
}
```

닫는 것은 코드가 합니다. 공지형 배너가 필요해지면 그때 `onClose` prop을 추가하세요.

### Figma → 코드

| Figma variant   | 코드              |
| --------------- | ----------------- |
| `type=negative` | `type="negative"` |
| `type=warning`  | `type="warning"`  |

`type`에 기본값이 없습니다. 남은 둘 중 "보통 이것"이라 할 게 없어서, 안 쓰면 타입 에러가 나도록 필수로 두었습니다.

`negative`는 `role="alert"`, `warning`은 `role="status"`로 렌더합니다. 실패는 스크린리더가 하던 말을 끊고 즉시 읽고, 주의는 하던 말이 끝난 뒤 읽습니다.

`role`은 밖에서 못 바꿉니다. props 타입에서 `Omit`으로 빼고, `{...props}`보다 뒤에 두었습니다. 접근성 의미를 컴포넌트가 책임지기 위해서입니다.

### 공통 스펙

| 항목         | 값                                  |
| ------------ | ----------------------------------- |
| 높이         | 44 (`py-3` + lh 20)                 |
| radius       | `rounded-lg` (8)                    |
| 좌우 padding | `px-3.5` (14)                       |
| 아이콘 gap   | `gap-1.5` (6)                       |
| 아이콘       | 16 × 16, 선 굵기 2.5                |
| 폰트         | 14 / Medium / lh 20                 |
| 너비         | Hug — 늘리려면 `className="w-full"` |

### 상태

| type     | 배경                 | 글자 · 아이콘          | 대비   |
| -------- | -------------------- | ---------------------- | ------ |
| negative | `bg-negative-subtle` | `text-negative-darker` | 8.86:1 |
| warning  | `bg-warning-subtle`  | `text-warning-darker`  | 8.72:1 |

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

## Input · Field

`components/ui/Input.tsx` · `components/ui/Field.tsx`

두 겹으로 나뉩니다. Figma의 `input`·`field` 세트와 같은 구분입니다.

|         | 담당                                                |
| ------- | --------------------------------------------------- |
| `Input` | `<input>` 하나. 크기와 테두리 색                    |
| `Field` | 라벨 + Input + 오류 메시지. `id`와 접근성 속성 연결 |

**폼에서는 `Field`를 쓰세요.** `Input`을 직접 쓰면 라벨 연결과 `aria`를 손으로 해야 하고, 화면이 늘어나면 반드시 빠뜨립니다.

### Input 스펙

| 항목         | 값                               |
| ------------ | -------------------------------- |
| 높이         | `h-12` (48) — Button `md`와 동일 |
| radius       | `rounded-lg` (8)                 |
| 좌우 padding | `px-3.5` (14)                    |
| 폰트         | 16 / Regular / lh 24             |
| 너비         | `w-full`                         |

| 상태  | 테두리                        |
| ----- | ----------------------------- |
| 기본  | `border-border-default`       |
| focus | `focus:border-primary-darker` |
| 오류  | `border-negative-default`     |

오류일 때는 focus를 받아도 테두리가 빨간색 그대로입니다. 문제가 해결되기 전까지 표시가 사라지면 안 됩니다.

### Field 스펙

```text
라벨       16    12 / Regular / lh16 / text-text-secondary
gap         4
Input      48
gap         4    (오류가 있을 때만)
오류 메시지  16    12 / Regular / lh16 / text-negative-darker
```

오류 없을 때 68, 있을 때 88.

### Field가 대신 해주는 것

```tsx
<Field label="이메일" error="이메일 형식이 아닙니다" />
```

`error`를 넘기면 세 가지가 한꺼번에 일어납니다.

- Input 테두리가 오류 색으로
- `aria-invalid="true"`
- 오류 메시지에 `id`를 붙이고 Input에 `aria-describedby`로 연결

`id`는 `useId`로 자동 생성됩니다. 라벨을 눌러도 입력칸에 포커스가 갑니다.

### 주의

- **`Field`는 클라이언트 컴포넌트입니다.** `useId`를 쓰기 때문입니다. 폼은 어차피 상태가 필요해서 문제되지 않습니다.
- **`aria-invalid`와 `aria-describedby`는 밖에서 못 바꿉니다.** `error` prop이 진실의 원천입니다.
- **폼 전체에 걸리는 오류는 Field가 아니라 Banner입니다.** `이메일 또는 비밀번호가 일치하지 않습니다`는 어느 칸이 틀렸는지 특정할 수 없습니다. Field의 오류는 `이메일 형식이 아닙니다`처럼 그 칸에만 해당하는 것입니다.
- `disabled`는 시안에 없지만 HTML 속성이라 누구든 넘길 수 있습니다. 스타일이 없으면 브라우저 기본 회색이 나오므로 최소한만 정의했습니다.

### 알려진 대비 미달

시안 색을 유지하기로 결정했습니다.

| 항목                         | 대비   | 기준  |
| ---------------------------- | ------ | ----- |
| 기본 테두리 `Border/default` | 1.53:1 | 3:1   |
| placeholder `Text/disabled`  | 2.13:1 | 4.5:1 |

라벨(`Text/secondary` 6.49:1)과 오류 메시지(`Negative/darker` 10.21:1)는 통과합니다. 기본 상태의 focus 테두리는 `Primary/darker`(5.55:1)로 올려서 해결했습니다(#59). 오류 상태의 테두리는 `Negative/default`(3.87:1)로 3:1을 넘습니다.

그래서 아래를 지켜주세요.

- **placeholder에 꼭 필요한 정보를 넣지 마세요.** 입력 예시만 넣고, 무엇을 입력하는지는 라벨이 말합니다. placeholder는 글자를 입력하는 순간 사라지기도 합니다
- **오류를 테두리 색으로만 알리지 마세요.** `error` prop을 쓰면 문구가 함께 뜹니다

### 사용 예

```tsx
import { Field } from '@/components/ui/Field';

<Field label="이메일" type="email" placeholder="host@example.com" />
<Field label="비밀번호" type="password" error="8자 이상 입력해주세요" />
```

---

## Textarea

`components/ui/Textarea.tsx`

여러 줄 입력입니다. 소감 입력에 씁니다. 색·테두리·폰트·상태는 Input과 완전히 같습니다.

| 항목      | 값                      |
| --------- | ----------------------- |
| 최소 높이 | `min-h-24` (96) — 세 줄 |
| padding   | `py-3 px-3.5` (12 / 14) |
| 크기 조절 | `resize-none`           |

`96 = 12 + 24 × 3 + 12`입니다. 글자는 위에서부터 쌓입니다.

### 주의

- **사용자가 크기를 못 늘립니다.** 시안이 고정 높이라 `resize-none`을 넣었습니다. 긴 글을 받는 자리가 아니라서인데, 답답하다는 얘기가 나오면 `resize-y`로 바꾸세요. 대신 아래 요소가 밀려나는 걸 감안해야 합니다.
- **`Field`는 아직 Input만 감쌉니다.** 라벨과 오류가 붙은 여러 줄 입력이 필요해지면 그때 `Field`를 넓히세요. 지금 미리 만들면 props 타입이 복잡해지기만 합니다.
- 나머지 주의사항은 Input과 같습니다. placeholder 대비, 오류 표시 방식 모두요.

### 사용 예

```tsx
import { Textarea } from '@/components/ui/Textarea';

<Textarea placeholder="이번 세션은 어떠셨나요?" maxLength={200} />;
```

---

## Badge

`components/ui/Badge.tsx`

상태나 분류를 나타내는 표시 전용 꼬리표입니다. 누를 수 없습니다. 누를 수 있으면 Chip입니다.

### Figma → 코드

| Figma variant   | 코드                 |
| --------------- | -------------------- |
| `type=positive` | `tone="positive"`    |
| `type=neutral`  | `tone="neutral"`     |
| `type=negative` | `tone="negative"`    |
| `type=toxic`    | `tone="toxic"`       |
| `type=none`     | **`tone="outline"`** |

`none`은 코드에서 `outline`입니다. `tone="none"`은 "배지 없음"으로 읽혀서 헷갈립니다. 생김새 기준으로 이름 지었습니다.

**문구는 `children`으로 받습니다.** `긍정`·`독성 의심` 같은 Pulse 도메인 문구가 컴포넌트 안에 들어가지 않도록 하기 위해서입니다. 같은 `positive`라도 감정에는 `긍정`, 이벤트 상태에는 `● LIVE`가 들어갑니다.

`tone`에 기본값이 없습니다. 다섯 중 "보통 이것"이라 할 게 없어서 필수로 두었습니다.

### 공통 스펙

| 항목         | 값                   |
| ------------ | -------------------- |
| 높이         | `h-6` (24)           |
| radius       | `rounded-full`       |
| 좌우 padding | `px-2.5` (10)        |
| 폰트         | 12 / Regular / lh 16 |
| 너비         | Hug                  |

### 상태

| tone     | 배경                                             | 글자                   | 대비   |
| -------- | ------------------------------------------------ | ---------------------- | ------ |
| positive | `bg-positive-subtle`                             | `text-positive-darker` | 8.21:1 |
| neutral  | `bg-neutral-subtle`                              | `text-neutral-darker`  | 8.49:1 |
| negative | `bg-negative-subtle`                             | `text-negative-darker` | 8.86:1 |
| toxic    | `bg-toxic-subtle`                                | `text-toxic-darker`    | 8.98:1 |
| outline  | `bg-background-default` + `border-border-strong` | `text-text-secondary`  | 6.49:1 |

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

### 띄우는 법

`Toast`를 직접 렌더하지 마세요. `showToast`를 부르면 됩니다.

```tsx
import { showToast } from '@/hooks/useToast';

const handleCopy = async () => {
  await navigator.clipboard.writeText(url);
  showToast('링크가 복사되었어요');
};
```

훅이 아니라 그냥 함수라 이벤트 핸들러 안에서 바로 부를 수 있습니다.

| 항목            | 값                                         |
| --------------- | ------------------------------------------ |
| 위치            | 화면 하단 가운데, 아래에서 `bottom-8` (32) |
| 지속 시간       | 4초                                        |
| 동시 표시       | 하나 — 새 토스트가 이전 것을 갈아치웁니다  |
| hover 일시 정지 | 없음 — 마우스를 올려도 4초 뒤 사라집니다   |
| 애니메이션      | 페이드 + 0.5rem 위로, 0.2초                |

`prefers-reduced-motion`이면 애니메이션 없이 바로 나타납니다.

### 하나만 뜨는 이유

Pulse에서 토스트가 동시에 여러 개 뜰 상황이 없습니다. 링크 복사·QR·요약 생성 완료 정도인데 사용자가 한 번에 둘을 누를 수 없습니다. 같은 버튼을 연타하면 타이머가 리셋되는 셈이라 오히려 자연스럽습니다.

쌓기를 넣으면 스택 관리·최대 개수·순서 코드가 전부 따라옵니다. 필요해지면 그때 넓히세요.

### ToastViewport

`components/ui/ToastViewport.tsx`. `AppProviders`에 이미 들어 있어서 화면에서 따로 놓을 필요가 없습니다.

**토스트가 없어도 껍데기는 DOM에 남습니다.** 스크린리더는 미리 존재하던 영역에 내용이 들어와야 읽습니다. 뷰포트째로 나타났다 사라지면 읽히지 않습니다.

뷰포트에는 `aria-live`를 걸지 않았습니다. `Toast`가 이미 `role="status"`라서 중첩되면 두 번 읽힐 수 있습니다.

### 공통 스펙

| 항목          | 값                       |
| ------------- | ------------------------ |
| 높이          | 44 (`py-3` + lh 20)      |
| radius        | `rounded-lg` (8)         |
| 좌우 padding  | `px-4` (16)              |
| 아이콘 gap    | `gap-1.5` (6)            |
| 배경          | `bg-background-inverse`  |
| 글자 · 아이콘 | `text-text-inverse`      |
| 대비          | 13.99:1                  |
| 폰트          | 14 / **Regular** / lh 20 |
| 그림자        | `shadow-toast`           |

Banner는 Medium, Toast는 Regular입니다. 어두운 배경 위의 흰 글씨는 같은 굵기라도 더 두껍게 보여서, 한 단계 낮춰야 균형이 맞습니다.

### 주의

- **type이 없습니다.** 성공·확인 전용이라 한 가지 모양뿐입니다. 실패를 Toast로 띄우면 몇 초 뒤 사라져서 사용자가 놓칩니다.
- `role="status"`가 고정입니다. 하던 말이 끝난 뒤 읽히므로 사용자의 작업을 방해하지 않습니다.
- 아이콘도 고정입니다. 종류가 하나뿐이라 바꿀 이유가 없습니다.
- **`ConfirmDialog`가 열려 있으면 토스트가 그 뒤에 가립니다.** `<dialog>`의 `showModal()`은 브라우저 최상위 레이어에 그려져서 `z-index`로 못 넘습니다. 다이얼로그를 닫은 뒤에 띄우세요.
- 애니메이션 길이가 `globals.css`와 `hooks/useToast.ts` 두 곳에 있습니다. 한쪽만 바꾸면 사라지는 도중에 잘립니다.

### 사용 예

```tsx
import { showToast } from '@/hooks/useToast';

showToast('링크가 복사되었어요');
```

`Toast` 컴포넌트를 직접 import 하는 경우는 없습니다. 뷰포트만 씁니다.

---

## Stat

`components/ui/Stat.tsx`

라벨과 숫자를 보여주는 카드입니다. 대시보드 상단에 네 개가 나란히 놓입니다.

### 스펙

| 항목      | 값                                          |
| --------- | ------------------------------------------- |
| 배경      | `bg-background-muted`                       |
| radius    | `rounded-lg` (8)                            |
| padding   | `py-3.5 px-4` (14 / 16)                     |
| 요소 간격 | `gap-1` (4)                                 |
| 라벨      | 12 / Regular / lh16 / `text-text-secondary` |
| 값        | 20 / SemiBold / lh28                        |
| 높이      | 76                                          |

테두리가 없습니다. 배경색만으로 구분되며, 차트 카드(흰 배경 + `Border/subtle`)와는 다른 생김새입니다.

### tone

값의 색만 바뀝니다. 라벨은 항상 `text-text-secondary`입니다.

| tone       | 색                     | 쓰는 곳     | 대비    |
| ---------- | ---------------------- | ----------- | ------- |
| `default`  | `text-text-primary`    | 총 소감     | 12.16:1 |
| `positive` | `text-positive-darker` | 긍정 비율   | 8.16:1  |
| `toxic`    | `text-toxic-darker`    | 독성 플래그 | 9.00:1  |
| `muted`    | `text-text-secondary`  | 미분류      | 5.64:1  |

`muted`는 처음에 `Text/tertiary`였는데 3.13:1이었습니다. 20px SemiBold가 WCAG '큰 텍스트' 기준에 걸치는 크기라 통과 여부가 해석에 달려 있어서, 논란이 없는 `Text/secondary`로 올렸습니다. 크기와 굵기가 라벨과 달라 흐린 느낌은 그대로입니다.

### 주의

- **`value`는 문자열입니다.** `312`, `58%`, `4`가 모두 들어옵니다. 숫자 타입으로 받으면 `%`를 못 붙입니다.
- **너비는 `w-full`입니다.** 네 개를 나란히 놓을 때는 `grid`로 감싸세요. 칸 너비가 균등해집니다.
- 값 색을 화면에서 직접 지정하지 마세요. `tone`을 쓰지 않으면 화면마다 색이 갈라집니다.

### 사용 예

```tsx
import { Stat } from '@/components/ui/Stat';

<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
  <Stat label="총 소감" value="312" />
  <Stat label="긍정 비율" value="58%" tone="positive" />
  <Stat label="독성 플래그" value="4" tone="toxic" />
  <Stat label="미분류" value="7" tone="muted" />
</div>;
```

---

## ConfirmDialog

`components/ui/ConfirmDialog.tsx`

되돌릴 수 없는 동작을 실행하기 전에 한 번 묻는 창입니다. 시안의 `Alert`입니다.

### 이름을 바꾼 이유

`Alert`는 Banner가 이미 `role="alert"`로 쓰고 있어서 파일 목록에서 헷갈립니다. `Dialog`는 아무 내용이나 담는 껍데기로 읽히는데, 이건 제목·설명·버튼 세 자리가 정해진 확인 전용입니다.

### 네이티브 `<dialog>`를 씁니다

Radix 없이 `showModal()`만으로 아래가 전부 해결됩니다.

| 필요한 것           | 처리          |
| ------------------- | ------------- |
| 포커스 가두기       | 브라우저      |
| ESC로 닫기          | 브라우저      |
| 뒤 배경 클릭 차단   | 브라우저      |
| 딤 배경             | `::backdrop`  |
| 뒤 배경 스크롤 잠금 | `globals.css` |

스크롤 잠금만 `showModal()`이 안 해줍니다. `globals.css`의 `body:has(dialog[open])`가 대신합니다.

외부 컴포넌트 라이브러리 도입은 아직 보류 상태이므로(CLAUDE.md), 이 방식으로 갑니다.

### 스펙

| 항목      | 값                                        |
| --------- | ----------------------------------------- |
| 너비      | `w-90` (360), `max-w-[calc(100%_-_2rem)]` |
| radius    | `rounded-xl` (12)                         |
| padding   | `p-6` (24)                                |
| 요소 간격 | `gap-4` (16)                              |
| 버튼 간격 | `gap-2` (8)                               |
| 그림자    | `shadow-dialog`                           |
| 딤 배경   | `backdrop:bg-overlay`                     |
| 높이      | 176 (내용에서 나오는 값)                  |

| 요소 | 폰트                | 색                    | 대비    |
| ---- | ------------------- | --------------------- | ------- |
| 제목 | 18 / Medium / lh28  | `text-text-primary`   | 13.99:1 |
| 설명 | 14 / Regular / lh20 | `text-text-secondary` | 6.49:1  |

시안은 360 고정이지만 코드에는 `max-w`를 붙였습니다. 320px 화면에서 넘치기 때문입니다.

### `open`이 진실의 원천입니다

DOM의 `open` 속성을 직접 건드리지 않습니다. `open` prop을 보고 `showModal()`·`close()`를 호출합니다.

```tsx
const [open, setOpen] = useState(false);

<ConfirmDialog open={open} onClose={() => setOpen(false)} ... />
```

`<dialog open>`처럼 속성으로 열면 **모달이 아닌** 다이얼로그가 됩니다. 포커스도, 배경 차단도, 딤도 없습니다. 그래서 `open`을 props 타입에서 빼고 불리언으로 다시 받습니다.

ESC를 누르면 `onCancel`에서 `preventDefault()`를 하고 `onClose()`만 호출합니다. 브라우저가 먼저 닫아버리면 React는 아직 열려 있다고 알고 있어서 둘이 어긋납니다. 닫는 것은 항상 `open` prop이 합니다.

### 버튼은 밖에서 넘깁니다

FeedItem과 같은 방식입니다. 확인 버튼이 `danger`인지 `primary`인지는 무슨 동작이냐에 달렸고, 그건 컴포넌트가 알 일이 아닙니다.

```tsx
actions={
  <>
    <Button variant="secondary" onClick={() => setOpen(false)}>취소</Button>
    <Button variant="danger" onClick={handleDelete}>삭제</Button>
  </>
}
```

**취소를 먼저 두세요.** `showModal()`은 첫 번째 포커스 가능한 요소에 포커스를 줍니다. 파괴적 확인창에서 엔터를 눌렀을 때 취소되는 편이 안전합니다.

### 주의

- **`open:flex`입니다. `flex`로 바꾸지 마세요.** 닫힌 `<dialog>`를 숨기는 건 브라우저 기본 스타일인데, 작성자 스타일인 `.flex`가 그걸 이겨서 **닫혀도 화면에 남습니다.** `open:`을 붙이면 열렸을 때만 적용됩니다.
- **`m-auto`도 지우지 마세요.** Tailwind Preflight가 `dialog { margin: 0 }`으로 초기화해서, 안 넣으면 화면 가운데가 아니라 왼쪽 위에 붙습니다.
- **`role`·`aria-labelledby`·`aria-describedby`는 밖에서 못 바꿉니다.** `role="alertdialog"` 고정입니다. 되돌릴 수 없는 확인이라 스크린리더가 제목과 설명을 즉시 읽어야 합니다.
- **`description`은 필수입니다.** 무엇이 일어나는지 안 쓰면 물어보는 의미가 없습니다. `삭제하면 되돌릴 수 없어요`처럼 결과를 적으세요.
- **클라이언트 컴포넌트입니다.** `useRef`·`useEffect`를 씁니다.
- 배경을 눌러 닫는 동작은 없습니다. 파괴적 확인창에서는 실수로 닫히는 편이 더 나쁩니다. ESC와 취소 버튼만 남겼습니다.

### 사용 예

```tsx
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

<ConfirmDialog
  open={isConfirmOpen}
  onClose={handleClose}
  title="세션을 삭제할까요?"
  description="삭제하면 되돌릴 수 없어요"
  actions={
    <>
      <Button variant="secondary" onClick={handleClose}>
        취소
      </Button>
      <Button variant="danger" onClick={handleDelete}>
        삭제
      </Button>
    </>
  }
/>;
```

---

## icons

`components/ui/icons.tsx`

여러 컴포넌트가 함께 쓰는 아이콘입니다. 모두 16 × 16, 선 굵기 2.5, 끝은 둥글게.

색은 `stroke`와 `fill` 모두 `currentColor`라 부모의 글자색을 따라갑니다. 컴포넌트에서 색을 넘길 필요가 없습니다.

선으로 그린 부분은 `stroke`, `AlertIcon`의 점처럼 면으로 채운 부분은 `fill`을 씁니다. 새 아이콘을 추가할 때도 두 속성 다 `currentColor`로 두세요.

| 이름        | 모양   | 쓰는 곳           |
| ----------- | ------ | ----------------- |
| `CheckIcon` | 체크   | Toast             |
| `XIcon`     | ✕      | Banner `negative` |
| `AlertIcon` | 느낌표 | Banner `warning`  |

모양 기준으로 이름 짓습니다. `XIcon`을 `ErrorIcon`으로 두면 나중에 닫기 버튼에 쓸 때 이름이 어색해집니다.

**모두 장식용입니다.** `aria-hidden="true"`가 고정이라 밖에서 못 켭니다. `<title>`이 없어서 노출시켜도 이름 없는 그래픽으로만 읽히기 때문입니다.

아이콘만 있고 옆에 글자가 없는 버튼을 만들 때는, 아이콘을 노출하지 말고 **버튼에 `aria-label`을 다세요.**

```tsx
<button aria-label="닫기">
  <XIcon />
</button>
```

---

## 미작성

Card

---

## 결정 기록

- 2026.08.05 — 모더레이션 버튼 높이 32 → 36으로 통일. size는 lg/md/sm 3종만 유지
- 2026.08.07 (#61) — 토스트를 동시에 하나만 띄우기로 함. Pulse에서 둘이 겹칠 상황이 없고, 쌓기를 넣으면 스택 관리·최대 개수·순서 코드가 전부 따라옴. 연타하면 타이머가 리셋되는 셈이라 오히려 자연스러움
- 2026.08.07 (#61) — 상태를 Context가 아니라 모듈 변수 + `useSyncExternalStore`로 둠. 호출부가 훅 없이 `showToast('...')`만 부르면 되고, 프로바이더가 하나 더 늘지 않음. 공유할 상태가 객체 하나뿐이라 Context의 이점이 없음
- 2026.08.07 (#61) — 뷰포트를 상시 마운트. 스크린리더는 미리 존재하던 영역에 내용이 들어와야 읽고, 뷰포트째로 나타났다 사라지면 안 읽힘. `aria-live`는 걸지 않음 — `Toast`의 `role="status"`와 중첩되면 두 번 읽힐 수 있음
- 2026.08.07 (#61) — 지속 시간 4초, 위치는 하단 가운데 `bottom-8`. 위치는 시안(x 626.5 / 아래 여백 33)에서 가져와 가운데·32로 정리했고, 지속 시간은 시안에 없어 코드에서 정함
- 2026.08.07 (#61) — **hover 일시 정지를 넣지 않음.** 마우스를 올려도 4초 뒤 사라짐. 문구가 한 줄이라 4초면 읽는 데 충분하고, 타이머를 멈췄다 다시 재는 상태를 둘 만한 이득이 없음. 읽는 데 시간이 필요한 내용이면 애초에 Toast가 아니라 Banner가 맞음
- 2026.08.07 (#59) — 포커스 링 색을 `Primary/default`(2.62:1)에서 `Primary/darker`(5.55:1)로 교체. 브라우저 기본 표시를 지우고 이 링으로 대체했는데 어느 배경에서도 3:1을 못 넘겨, 키보드 사용자가 현재 위치를 알 수 없었음. Button·Chip·Input·Textarea·Header 5곳
- 2026.08.07 (#59) — Input·Textarea의 **기본 상태** focus 테두리도 같은 `Primary/darker`로 통일. 링과 테두리 색이 갈라지면 규칙이 두 개가 되고 한쪽만 고쳐짐. 오류(`invalid`) 상태의 테두리는 `Negative/default`를 그대로 유지 — 문제가 안 풀렸는데 표시가 사라지면 안 되고, 포커스 위치는 링만으로도 보임
- 2026.08.07 (#59) — `outline-2`·`outline-offset-2`를 px로 유지하기로 확정(#48 리뷰 지적). outline은 간격이 아니라 테두리와 같은 성격의 선이고, 글자 크기에 따라 포커스 링이 굵어질 이유가 없음
- 2026.08.06 (#14) — focus 규격은 시안에 정의가 없어 코드에서 정함 (`Primary/default` 2px, offset 2)
- 2026.08.06 (#14) — primary·secondary hover 색 확정. 이때 추가한 신규 토큰은 `Primary/pressed`(#036176) 하나
- 2026.08.06 (#16) — danger 배경을 `Negative/default`(3.87:1, AA 미달)에서 `Negative/darker`(10.21:1)로 교체. hover용 `Negative/pressed`(#4F1D0D) 신설. `Negative/default` 값은 그대로 둬서 부정 감정 차트·배지는 영향 없음
- 2026.08.06 (#15) — Chip의 `state` variant를 `selected` 불리언으로 매핑. 필터는 `<button>`으로 렌더하고 `aria-pressed`를 붙임. 표시 전용 꼬리표는 Chip이 아니라 Badge가 담당하기로 함
- 2026.08.06 (#15) — Chip 선택 상태 hover는 배경 대신 테두리를 진하게 함. `Primary/lighter` 배경은 텍스트 대비 3.79:1로 AA 미달. 신규 토큰 없음
- 2026.08.06 (#21) — Banner에서 `positive` variant 제거. 성공 알림은 Toast가 담당하므로 흐름 안에 남을 이유가 없음. 필요해지면 다시 추가
- 2026.08.06 (#21) — Banner의 `type`은 기본값 없이 필수. 남은 둘 다 나쁜 소식이라 기본값을 두면 실패가 조용히 주의 색으로 뜰 수 있음
- 2026.08.06 (#21) — 아이콘을 텍스트 글자에서 벡터로 교체하고 `icons.tsx`로 분리. `✔️` 같은 이모지는 지정한 색이 안 먹고 OS마다 다르게 렌더됨. 신규 토큰 없음
- 2026.08.06 (#43) — Stat의 `muted` 값 색을 `Text/tertiary`(3.13:1)에서 `Text/secondary`(5.64:1)로 교체. 20px SemiBold가 WCAG '큰 텍스트' 기준에 걸치는 크기라 통과 여부가 해석에 달려 있었음
- 2026.08.06 (#43) — Stat의 값 색을 `tone` prop으로 받음. 시안은 인스턴스마다 색을 덮어쓰고 있는데, 화면에서 손으로 지정하면 갈라짐
- 2026.08.06 (#34) — Input과 Field를 두 파일로 분리. `aria-describedby`·`aria-invalid`를 화면마다 손으로 붙이면 반드시 빠뜨림. Field가 `useId`로 연결을 대신함
- 2026.08.06 (#34) — Input의 focus에 테두리 색 변경과 outline 링을 함께 적용. 시안에는 테두리만 있지만, 링을 빼면 브라우저 기본 표시를 지운 자리에 2.65:1짜리 테두리만 남아 포커스가 어디 있는지 알기 어려움. Button·Chip과 같은 링이라 시스템도 일관됨
- 2026.08.06 (#34) — 오류 상태에서는 focus를 받아도 테두리를 빨간색으로 유지. 문제가 해결되기 전에 오류 표시가 사라지면 안 됨
- 2026.08.06 — Badge의 `LIVE`·`ENDED` variant 삭제. `LIVE`는 `positive`와 색이 완전히 같았고 `ENDED`는 `neutral`과 배경이 같은데 글자색만 달랐음. 색이 같은 variant를 따로 두면 한쪽만 고쳐져 어긋남. 문구만 바꿔 쓰는 방식으로 통일
- 2026.08.06 — Badge `none`의 글자색을 `Text/tertiary`(3.61:1, AA 미달)에서 `Text/secondary`(6.49:1)로 교체. 테두리는 `Border/strong` 유지 — 배지는 조작 요소가 아니라 3:1 규정 대상이 아니고, 이 시스템에서 가장 진한 테두리 토큰임
- 2026.08.06 — Badge 문구를 `children`으로 받음. `긍정`·`독성 의심` 같은 도메인 문구가 `ui/` 안에 들어가지 않게 하기 위함. Figma의 `none`은 코드에서 `outline`으로 이름 변경
- 2026.08.06 — Toast는 생김새만 만들고 띄우는 방식은 분리. 위치·스택·타이머는 컴포넌트가 아니라 훅과 뷰포트의 일이라 섞으면 Toast가 비대해짐. 신규 토큰은 `--shadow-toast` 하나
- 2026.08.06 — Toast 폰트를 Regular로. Banner는 Medium인데, 어두운 배경 위 흰 글씨는 같은 굵기라도 두껍게 보여서 한 단계 낮춰야 균형이 맞음
- 2026.08.06 (#23) — 컴포넌트가 계산하는 접근성 속성은 밖에서 못 바꾸게 막는다. props 타입에서 `Omit`으로 빼고 JSX에서도 `{...props}` 뒤에 배치한다. 타입만 막으면 느슨한 객체를 펼칠 때 런타임에서 뚫린다. 현재 대상은 Banner의 `role`, Chip의 `aria-pressed`, 아이콘의 `aria-hidden`
- 2026.08.07 — ConfirmDialog를 네이티브 `<dialog>` + `showModal()`로 구현. 포커스 가두기·ESC·배경 차단·딤을 브라우저가 처리해서 Radix 도입 논의가 필요 없어짐. 스크롤 잠금만 `globals.css`의 `body:has(dialog[open])`로 보완. 신규 토큰은 `--color-overlay`(시안에 딤 배경이 없어 코드에서 정함) 하나
- 2026.08.07 — 열림 상태를 `open` prop 하나로만 관리. `<dialog open>` 속성으로 열면 모달이 아니게 되어 포커스도 배경 차단도 사라짐. ESC는 `onCancel`에서 `preventDefault()` 후 `onClose()`만 호출해서, 브라우저가 먼저 닫고 React가 뒤늦게 아는 상황을 막음
- 2026.08.07 — 컴포넌트 이름을 시안의 `Alert`에서 `ConfirmDialog`로 변경. Banner가 이미 `role="alert"`를 쓰고 있어 혼동됨. `Dialog`는 아무 내용이나 담는 껍데기로 읽히는데 이건 제목·설명·버튼이 정해진 확인 전용
- 2026.08.07 — 버튼을 `actions` prop으로 받고 취소를 먼저 배치. 확인 버튼이 danger인지 primary인지는 도메인 사정이고, `showModal()`이 첫 포커스 가능 요소에 포커스를 주므로 파괴적 확인창에서는 취소가 먼저인 편이 안전함
- 2026.08.06 (#21) — Banner에 닫기 버튼을 넣지 않음. 현재 두 type이 모두 조건형이라, 닫으면 문제가 남아 있는데 표시만 사라짐. 공지형이 생기면 그때 `onClose` 추가
