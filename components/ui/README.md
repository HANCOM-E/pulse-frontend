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

| variant | 기본 | hover |
| --- | --- | --- |
| primary | `bg-primary-darker` | `hover:bg-primary-pressed` |
| secondary | `bg-background-default` | `hover:bg-background-muted` |
| danger | `bg-negative-default` | `hover:bg-negative-darker` |

focus는 `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-default`.
`border`가 아니라 `outline`입니다. border로 만들면 버튼 크기가 밀립니다.

### 접근성 — danger 대비 미달 (알려진 예외)

`bg-negative-default` + `text-text-inverse` 조합은 명암비 **3.88:1**로 WCAG AA 기준(4.5:1)에 미달합니다.
버튼 텍스트가 16px SemiBold라 '큰 텍스트' 예외(18.66px Bold 이상)에도 해당하지 않습니다.

시안 색상을 유지하기로 결정했으므로 아래를 지켜주세요.

- danger 버튼에 **색만으로 의미를 전달하지 마세요.** 문구에 행동을 명시합니다 (`삭제` ○ / `확인` ✕)
- 파괴적 동작은 danger 버튼 하나로 끝내지 말고 확인 다이얼로그를 거칩니다
- 이 조합을 본문 텍스트나 링크에 재사용하지 마세요. 버튼 한정입니다

AA를 충족하려면 `Negative/darker`(#712B13, 10.3:1)를 배경으로 쓰거나
중간 단계 토큰(#993C1D, 6.87:1)을 신설해야 합니다. 재논의 시 이 두 안을 검토하세요.

### 사용 예

```tsx
import { Button } from '@/components/ui/Button';

<Button type="submit" size="lg" className="w-full">로그인</Button>
<Button variant="secondary" size="sm">링크 복사</Button>
<Button variant="danger">삭제</Button>
<Button disabled>요약 생성</Button>
```
---

## 미작성

Badge · Chip · Input · Card · Toast · Dialog

---

## 결정 기록

- 2026.08.05 — 모더레이션 버튼 높이 32 → 36으로 통일. size는 lg/md/sm 3종만 유지
- 2026.08.06 — danger 기본 명암비 3.88:1 (AA 4.5:1 미달). 시안 색상 유지 결정. 색을 바꾸면 Figma 시안 전체와 `Negative/*` 스케일을 함께 손봐야 해서 이번 PR 범위를 넘어섭니다. 완화책은 위 '접근성' 절에 기재
- 2026.08.06 — focus 규격은 시안에 정의가 없어 코드에서 정함 (Primary/default 2px, offset 2)
- 2026.08.06 — hover 색 확정. 신규 토큰은 `Primary/pressed`(#036176) 하나