# components/feedback

소감과 감정 분류를 다루는 컴포넌트입니다. Pulse의 도메인 개념을 아는 것들이 여기 있습니다.

`components/ui/`와 갈리는 기준은 이렇습니다. 그 파일만 열었을 때 Pulse가 뭐 하는 서비스인지 몰라도 이해되면 `ui/`, `긍정`·`독성 의심` 같은 말이 나오면 여기입니다.

---

## FeedItem

`components/feedback/FeedItem.tsx`

소감 하나를 보여주는 카드입니다. 실시간 피드와 모더레이션 큐에서 씁니다.

### 세 가지 상태

| state | 배경 | 테두리 | 본문 | 쓰는 곳 |
| --- | --- | --- | --- | --- |
| `normal` | `bg-background-default` | `border-border-subtle` | `text-text-primary` | 실시간 피드 |
| `flagged` | `bg-background-default` | `border-toxic-lighter` | `text-text-primary` | 모더레이션 큐 |
| `hidden` | `bg-background-muted` | `border-transparent` | `text-text-tertiary` | 숨김 처리된 항목 |

`hidden`의 테두리는 투명입니다. 안 보이지만 자리를 차지해서 다른 상태와 높이가 어긋나지 않습니다.

### 감정은 코드가 문구로 바꿉니다

```tsx
<FeedItem sentiment="positive" ... />   →  <Badge tone="positive">긍정</Badge>
```

| sentiment | Badge tone | 문구 |
| --- | --- | --- |
| `positive` | positive | 긍정 |
| `neutral` | neutral | 중립 |
| `negative` | negative | 부정 |
| `none` | outline | 미분류 |
| `toxic` | toxic | ⚑ 독성 의심 |

이 표가 여기 있는 이유는 `ui/Badge`가 Pulse를 몰라야 하기 때문입니다. 감정을 문구로 바꾸는 일은 도메인 컴포넌트가 합니다.

### `· 숨김`은 자동으로 붙습니다

`state="hidden"`이면 메타 문구 끝에 ` · 숨김`이 붙습니다.

```
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
      <Button variant="secondary" size="sm" onClick={handleHide}>숨기기</Button>
      <Button variant="secondary" size="sm" onClick={handleDelete}>삭제</Button>
    </>
  }
/>
```

`actions`를 안 넘기면 버튼 영역 자체가 렌더되지 않습니다. `normal`은 버튼이 없어서 높이가 80, 나머지는 122입니다.

### 주의

- **`<article>`로 렌더합니다.** 목록 안에 넣을 때는 `<ul><li>`로 감싸세요.
- 본문은 `content` prop으로 받습니다. 서식 있는 내용이 들어올 자리가 아니라 문자열입니다.

### 사용 예

```tsx
import { FeedItem } from '@/components/feedback/FeedItem';

<FeedItem state="normal" sentiment="positive" meta="방금 · 세션 A" content="데모가 진짜 인상적이었어요" />
<FeedItem state="hidden" sentiment="toxic" meta="2분 전 · 세션 B" content="신고된 소감" actions={<Button variant="secondary" size="sm">숨김 해제</Button>} />
```

---

## 결정 기록

- 2026.08.06 — 감정 → 문구 매핑을 `ui/Badge`가 아니라 여기에 둠. `ui/`는 Pulse 도메인을 몰라야 함
- 2026.08.06 — `state="hidden"`일 때 메타에 ` · 숨김`을 자동으로 붙임. 배경 명도만으로 구분하면 색을 못 보는 사용자에게 전달되지 않고, 화면마다 손으로 쓰면 빠뜨림
- 2026.08.06 — 버튼을 `actions` prop으로 받음. 숨기기·삭제가 무슨 일을 하는지 FeedItem이 알 필요가 없음
