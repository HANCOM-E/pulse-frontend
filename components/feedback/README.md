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

### 서버 코드 → `sentiment`는 `FEED_SENTIMENT`가 바꿉니다

API의 `Sentiment`(`POS`·`NEU`·`NEG`·`UNKNOWN`)를 위 prop 값으로 옮기는 표를 같은 파일에서 내보냅니다.

```tsx
import { FEED_SENTIMENT, FeedItem } from '@/components/feedback/FeedItem';

<FeedItem sentiment={FEED_SENTIMENT[feedback.sentiment]} ... />;
```

유니온과 같은 파일에 둬서 감정을 하나 더 늘릴 때 짝을 빠뜨릴 수 없게 했습니다. 실시간 피드와 모더레이션 큐가 같이 씁니다.

**`toxic`은 이 표에 없습니다.** 독성은 감정 분류가 아니라 따로 붙는 플래그라, 감정 대신 독성 배지를 보여줄지는 쓰는 화면이 정합니다. 모더레이션 큐는 `feedback.toxic ? 'toxic' : FEED_SENTIMENT[feedback.sentiment]`로 가릅니다 — 주최자가 손으로 숨긴 소감까지 `⚑ 독성 의심`으로 그리면 자동 판정 결과처럼 읽힙니다.

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

화면마다 백분율을 계산하면 같은 데이터에 다른 숫자가 뜹니다. 컴포넌트가 직접 나눠서 라벨이 한 곳에서만 만들어지게 합니다.

세 값을 각각 반올림하므로 **라벨의 합은 99나 101이 될 수 있습니다.** 1·1·1이면 33% 세 개라 99%입니다. 한 조각만 보정하면 그 값이 실제 비율과 어긋나서 그대로 둡니다.

막대는 `flexGrow`에 개수를 그대로 넘겨 브라우저가 정확히 나누게 합니다. 라벨의 백분율만 반올림합니다.

### 라벨은 `SentimentLegend`가 그립니다

Donut과 같은 컴포넌트를 씁니다. 정렬만 다릅니다 — Thermometer는 막대 양끝에 맞춰 `between`, Donut은 `center`.

### 주의

- **`role`·`aria-label`·`aria-labelledby`는 밖에서 못 바꿉니다.** 개수가 진실의 원천입니다. `aria-labelledby`까지 막는 이유는 그게 `aria-label`보다 우선순위가 높아서, 들어오면 계산된 비율이 무시되기 때문입니다.
- 막대 뒤에 `bg-background-muted`가 깔려 있습니다. 세 값이 모두 0일 때 빈 막대가 보이게 하려는 것입니다.
- 참가자 화면은 모바일 전용이라 Thermometer 고정입니다. 호스트 대시보드를 좁은 화면에서 볼 때 Donut과 어떻게 갈릴지는 화면 조립 때 정하세요.

### 사용 예

```tsx
import { Thermometer } from '@/components/feedback/Thermometer';

<Thermometer positive={181} neutral={87} negative={44} />;
```

---

## Donut

`components/feedback/Donut.tsx`

같은 감정 분포를 고리로 보여줍니다. 호스트 대시보드(데스크탑)에서 씁니다.

### 스펙

```text
지름     112
링 두께   16
gap      12
범례      12 / Regular / lh16, 가운데 정렬 gap 8
```

| 구간 | 고리                      | 범례                   |
| ---- | ------------------------- | ---------------------- |
| 긍정 | `stroke-positive-default` | `text-positive-darker` |
| 중립 | `stroke-neutral-lighter`  | `text-text-secondary`  |
| 부정 | `stroke-negative-default` | `text-negative-darker` |

링 두께 16은 Thermometer 막대 높이(`h-4`)와 같은 값입니다. 시안의 도넛은 원 세 개를 겹쳐놓은 상태라 두께도 각도도 없어서 코드에서 정했습니다.

### 카드는 안 들어 있습니다

시안의 흰 카드(240 × 178, `border-subtle`, radius 12)는 화면이 그립니다. Thermometer도 같습니다.

178은 옆 카드(시간대별 추이)와 높이를 맞춘 값입니다. 내용에서 계산하면 172라 컴포넌트가 가질 숫자가 아닙니다.

### 호는 개수로 그립니다

```tsx
<Donut positive={181} neutral={87} negative={44} />
```

`stroke-dasharray`에 넘기는 길이를 백분율이 아니라 개수에서 뽑습니다. 반올림한 값을 쓰면 세 조각의 합이 원주와 어긋나 마지막 조각 끝에 틈이 생깁니다. 범례의 숫자만 반올림합니다.

SVG 원은 3시에서 시작하므로 `rotate(-90)`으로 12시로 돌립니다.

### 주의

- **`role`·`aria-label`·`aria-labelledby`는 밖에서 못 바꿉니다.** Thermometer와 같은 이유입니다.
- 고리 뒤에 `stroke-background-muted` 원이 깔려 있습니다. 세 값이 모두 0일 때 빈 고리가 보이게 하려는 것입니다.
- 가운데 텍스트는 없습니다. 시안에 없고, 숫자는 범례가 담당합니다.
- 지름이 112 고정입니다. 카드 폭에 맞춰 늘어나지 않습니다.
- **범례 폭은 고정하지 않았습니다.** 시안의 206은 범례의 크기가 아니라 카드 안쪽 폭(240 - 17×2)입니다. 범례가 `layoutAlign: STRETCH`라 카드를 채운 값이라, 컴포넌트에 박으면 일부러 제외한 카드 치수를 다시 끌고 들어옵니다. 항목이 가운데 정렬이라 폭을 줘도 렌더 결과가 같습니다 — 항목 합 161이 206 안에서 가운데면 22.5부터 시작하는데, 폭 없이 카드 안에서 가운데 정렬해도 같은 자리입니다.

### 사용 예

```tsx
import { Donut } from '@/components/feedback/Donut';

<Donut positive={181} neutral={87} negative={44} />;
```

---

## SentimentLegend

`components/feedback/SentimentLegend.tsx`

`긍정 58% · 중립 28% · 부정 14%` 한 줄입니다. Thermometer와 Donut이 같이 씁니다.

| align            | 정렬                   | 쓰는 곳                        |
| ---------------- | ---------------------- | ------------------------------ |
| `between` (기본) | `justify-between`      | Thermometer — 막대 양끝에 맞춤 |
| `center`         | `justify-center gap-2` | Donut                          |

**개수가 아니라 백분율을 받습니다.** `sentiment.ts`의 `toRates`를 거친 값을 넘기세요.

### 왜 따로 뺐나

두 차트의 범례가 글자 하나까지 같습니다. 각자 두면 감정 → 색·문구 매핑이 두 파일에 생기고, 색을 바꿀 때 한쪽만 고쳐집니다.

### 지우지 마세요

긍정과 부정은 색상은 다르지만 명도가 거의 같습니다(1.13:1). 적록색약 사용자에게는 두 구간이 같아 보이고, 중립이 0%인 이벤트에서는 도형 전체가 한 덩어리로 보입니다.

숫자가 진실이고 색은 보조입니다.

---

## sentiment.ts

`components/feedback/sentiment.ts`

두 차트가 공유하는 계산입니다.

| 함수           | 하는 일                              |
| -------------- | ------------------------------------ |
| `toRates`      | 개수 → 백분율. **반올림은 여기서만** |
| `toChartLabel` | `aria-label` 문구                    |

`role="img"`를 붙이면 안쪽 범례도 스크린리더에서 가려집니다. 그래서 `toChartLabel`이 같은 숫자를 다시 읽어줍니다.

---

## 결정 기록

- 2026.08.14 (#170) — 서버 감정 코드 → `sentiment` 매핑(`FEED_SENTIMENT`)을 `DashboardView`에서 `FeedItem.tsx`로 옮겨 내보냄. 실시간 피드에 숨기기 버튼이 붙으면서 모더레이션 큐도 같은 매핑이 필요해졌는데, 화면마다 두면 한쪽만 고쳐짐. 독성은 감정 분류가 아니라 별도 플래그라 표에 넣지 않음
- 2026.08.07 (#63) — 범례를 `SentimentLegend`로 분리하고 계산을 `sentiment.ts`로 뺌. 두 차트의 범례가 글자 하나까지 같아서, 각자 두면 감정 → 색·문구 매핑이 두 파일에 생기고 한쪽만 고쳐짐
- 2026.08.07 (#63) — Donut 링 두께를 16으로 정함. 시안이 원 세 개를 겹쳐놓은 상태라 두께도 각도도 없었음. Thermometer 막대 높이(`h-4`)와 맞춤
- 2026.08.07 (#63) — Donut에 카드를 넣지 않음. 시안의 240 × 178은 옆 카드와 높이를 맞춘 값이고 내용에서 계산하면 172임. Thermometer와 같은 판단
- 2026.08.07 (#63) — Donut 가운데에 텍스트를 두지 않음. 시안에 없고 숫자는 범례가 담당함
- 2026.08.06 — Thermometer가 개수를 받아 직접 백분율을 계산함. 화면마다 나누면 반올림 때문에 합이 100이 안 되어 막대에 틈이 생김. 막대는 `flexGrow`로 정확히 나누고 라벨만 반올림
- 2026.08.06 — Thermometer의 라벨을 컴포넌트 안에 둠. 긍정과 부정은 명도가 거의 같아 색만으로는 구분되지 않음. 라벨이 빠지면 읽을 방법이 없어져서 밖에서 붙이게 두지 않음
- 2026.08.06 — 감정 → 문구 매핑을 `ui/Badge`가 아니라 여기에 둠. `ui/`는 Pulse 도메인을 몰라야 함
- 2026.08.06 — 높이를 `min-h`로 고정하지 않음. 시안의 80·122는 padding·gap·글자 높이에서 나오는 결과값이라, 따로 적으면 같은 숫자가 두 곳에 생겨 나중에 어긋남
- 2026.08.06 — `state="hidden"`일 때 메타에 `· 숨김`을 자동으로 붙임. 배경 명도만으로 구분하면 색을 못 보는 사용자에게 전달되지 않고, 화면마다 손으로 쓰면 빠뜨림
- 2026.08.06 — 버튼을 `actions` prop으로 받음. 숨기기·삭제가 무슨 일을 하는지 FeedItem이 알 필요가 없음
