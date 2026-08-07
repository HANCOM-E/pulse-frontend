# components/feedback

소감과 감정 분류를 다루는 컴포넌트입니다. Pulse의 도메인 개념을 아는 것들이 여기 있습니다.

`components/ui/`와 갈리는 기준은 이렇습니다. 그 파일만 열었을 때 Pulse가 뭐 하는 서비스인지 몰라도 이해되면 `ui/`, `긍정`·`독성 의심` 같은 말이 나오면 여기입니다.

---

## FeedItem

`components/feedback/FeedItem.tsx`

소감 하나를 보여주는 카드입니다. 실시간 피드와 모더레이션 큐에서 씁니다.

### 세 가지 상태

| state     | 배경                    | 테두리                 | 본문                 | 쓰는 곳          |
| --------- | ----------------------- | ---------------------- | -------------------- | ---------------- |
| `normal`  | `bg-background-default` | `border-border-subtle` | `text-text-primary`  | 실시간 피드      |
| `flagged` | `bg-background-default` | `border-toxic-lighter` | `text-text-primary`  | 모더레이션 큐    |
| `hidden`  | `bg-background-muted`   | `border-transparent`   | `text-text-tertiary` | 숨김 처리된 항목 |

`hidden`의 테두리는 투명입니다. 안 보이지만 자리를 차지해서 다른 상태와 높이가 어긋나지 않습니다.

### 감정은 코드가 문구로 바꿉니다

```tsx
<FeedItem sentiment="positive" ... />   →  <Badge tone="positive">긍정</Badge>
```

| sentiment  | Badge tone | 문구        |
| ---------- | ---------- | ----------- |
| `positive` | positive   | 긍정        |
| `neutral`  | neutral    | 중립        |
| `negative` | negative   | 부정        |
| `none`     | outline    | 미분류      |
| `toxic`    | toxic      | ⚑ 독성 의심 |

이 표가 여기 있는 이유는 `ui/Badge`가 Pulse를 몰라야 하기 때문입니다. 감정을 문구로 바꾸는 일은 도메인 컴포넌트가 합니다.

### `· 숨김`은 자동으로 붙습니다

`state="hidden"`이면 메타 문구 끝에 `· 숨김`이 붙습니다.

```text
방금 · 세션 A        →  방금 · 세션 A · 숨김
```

화면마다 손으로 쓰면 빠뜨립니다. 배경이 흐려지는 것만으로 구분하면 색을 못 보는 사용자에게 전달되지 않습니다.

### 버튼은 밖에서 넘깁니다

`actions`로 받습니다. FeedItem은 숨기기·삭제가 무슨 일을 하는지 몰라도 됩니다.

```tsx
<FeedItem
  state="flagged"
  sentiment="toxic"
  meta="2분 전 · 세션 B"
  content="신고된 소감 내용"
  actions={
    <>
      <Button variant="secondary" size="sm" onClick={handleHide}>
        숨기기
      </Button>
      <Button variant="secondary" size="sm" onClick={handleDelete}>
        삭제
      </Button>
    </>
  }
/>
```

`actions`를 안 넘기면 버튼 영역 자체가 렌더되지 않습니다.

### 높이는 지정하지 않습니다

시안의 80·122는 내용에서 자동으로 나오는 값입니다.

```text
normal   12 + 24(배지) + 6 + 24(한 줄) + 12 + 테두리 2 = 80
flagged  12 + 24 + 6 + 24 + 6 + 36(버튼) + 12 + 2      = 122
```

`min-h`로 못 박지 않았습니다. 같은 숫자가 두 곳에 생기면 나중에 padding을 바꿨을 때 계산값과 어긋납니다. 소감이 두 줄이면 카드가 길어지는 것도 맞는 동작입니다.

### 주의

- **`<article>`로 렌더합니다.** 목록 안에 넣을 때는 `<ul><li>`로 감싸세요.
- 본문은 `content` prop으로 받습니다. 서식 있는 내용이 들어올 자리가 아니라 문자열입니다.

### 사용 예

```tsx
import { FeedItem } from '@/components/feedback/FeedItem';
import { Button } from '@/components/ui/Button';

<FeedItem state="normal" sentiment="positive" meta="방금 · 세션 A" content="데모가 진짜 인상적이었어요" />
<FeedItem state="hidden" sentiment="toxic" meta="2분 전 · 세션 B" content="신고된 소감" actions={<Button variant="secondary" size="sm">숨김 해제</Button>} />
```

---

## Thermometer

`components/feedback/Thermometer.tsx`

감정 분포를 가로 막대 하나로 보여줍니다. 모바일 대시보드에서 도넛 대신 씁니다.

### 스펙

```text
막대     16    radius 999
gap       8
라벨 줄   16    12 / Regular / lh16, 양끝 정렬
```

| 구간 | 막대                  | 라벨                   |
| ---- | --------------------- | ---------------------- |
| 긍정 | `bg-positive-default` | `text-positive-darker` |
| 중립 | `bg-neutral-lighter`  | `text-text-secondary`  |
| 부정 | `bg-negative-default` | `text-negative-darker` |

### 비율이 아니라 개수를 받습니다

```tsx
<Thermometer positive={181} neutral={87} negative={44} />
```

화면마다 백분율을 계산하면 반올림 때문에 합이 99나 101이 되어 막대에 틈이 생깁니다. 컴포넌트가 직접 나눕니다.

막대는 `flexGrow`에 개수를 그대로 넘겨 브라우저가 정확히 나누게 합니다. 라벨의 백분율만 반올림합니다.

### 라벨이 컴포넌트 안에 있습니다

긍정과 부정은 색상은 다르지만 명도가 거의 같습니다. 적록색약 사용자에게는 두 구간이 같아 보이고, 중립이 0%인 이벤트에서는 막대 전체가 한 덩어리로 보입니다.

라벨을 화면에서 붙이게 두면 어딘가에서 빠지고, 그러면 읽을 방법이 사라집니다. 숫자가 진실이고 색은 보조입니다.

`role="img"`과 `aria-label`도 붙습니다. 색칠된 사각형 세 개라 스크린리더에게는 아무 내용이 없기 때문입니다.

### 주의

- **`role`·`aria-label`·`aria-labelledby`는 밖에서 못 바꿉니다.** 개수가 진실의 원천입니다. `aria-labelledby`까지 막는 이유는 그게 `aria-label`보다 우선순위가 높아서, 들어오면 계산된 비율이 무시되기 때문입니다.
- 막대 뒤에 `bg-background-muted`가 깔려 있습니다. 세 값이 모두 0일 때 빈 막대가 보이게 하려는 것입니다.
- 도넛과 언제 갈리는지는 아직 정해지지 않았습니다. 화면 조립할 때 breakpoint를 정하세요.

### 사용 예

```tsx
import { Thermometer } from '@/components/feedback/Thermometer';

<Thermometer positive={181} neutral={87} negative={44} />;
```

---

## 결정 기록

- 2026.08.06 — Thermometer가 개수를 받아 직접 백분율을 계산함. 화면마다 나누면 반올림 때문에 합이 100이 안 되어 막대에 틈이 생김. 막대는 `flexGrow`로 정확히 나누고 라벨만 반올림
- 2026.08.06 — Thermometer의 라벨을 컴포넌트 안에 둠. 긍정과 부정은 명도가 거의 같아 색만으로는 구분되지 않음. 라벨이 빠지면 읽을 방법이 없어져서 밖에서 붙이게 두지 않음
- 2026.08.06 — 감정 → 문구 매핑을 `ui/Badge`가 아니라 여기에 둠. `ui/`는 Pulse 도메인을 몰라야 함
- 2026.08.06 — 높이를 `min-h`로 고정하지 않음. 시안의 80·122는 padding·gap·글자 높이에서 나오는 결과값이라, 따로 적으면 같은 숫자가 두 곳에 생겨 나중에 어긋남
- 2026.08.06 — `state="hidden"`일 때 메타에 `· 숨김`을 자동으로 붙임. 배경 명도만으로 구분하면 색을 못 보는 사용자에게 전달되지 않고, 화면마다 손으로 쓰면 빠뜨림
- 2026.08.06 — 버튼을 `actions` prop으로 받음. 숨기기·삭제가 무슨 일을 하는지 FeedItem이 알 필요가 없음
