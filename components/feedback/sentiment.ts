/**
 * 감정 분포 차트가 공유하는 계산입니다. Thermometer와 Donut이 같이 씁니다.
 *
 * 반올림을 여기 모은 이유는 화면마다 나누면 같은 데이터에 다른 숫자가 뜨기
 * 때문입니다. 라벨 문구가 한 곳에서만 만들어집니다.
 *
 * 세 값을 각각 반올림하므로 **라벨의 합은 99나 101이 될 수 있습니다.** 예를 들어
 * 1·1·1이면 33% 세 개라 99%입니다. 이건 막지 않습니다 — 어느 한 조각만 보정하면
 * 그 값이 실제 비율과 어긋납니다.
 *
 * 도형에 틈이 생기지 않는 것은 이 반올림과 무관합니다. Thermometer는 `flexGrow`에,
 * Donut은 `stroke-dasharray`에 **반올림 전 개수**를 그대로 넘겨서 브라우저가 나눕니다(#47 결정).
 */

interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
}

const toPercent = (value: number, total: number) =>
  total === 0 ? 0 : Math.round((value / total) * 100);

/** 개수를 백분율로 바꿉니다. 라벨에만 씁니다 — 도형 크기는 개수를 그대로 넘기세요. */
const toRates = ({ positive, neutral, negative }: SentimentCounts): SentimentCounts => {
  const total = positive + neutral + negative;

  return {
    positive: toPercent(positive, total),
    neutral: toPercent(neutral, total),
    negative: toPercent(negative, total),
  };
};

/**
 * 차트의 `aria-label`입니다.
 *
 * 색칠된 도형뿐이라 스크린리더에게는 아무 내용이 없습니다. `role="img"`를 붙이면
 * 안쪽 범례도 함께 가려지므로, 같은 숫자를 여기서 다시 읽어줍니다.
 */
const toChartLabel = (rate: SentimentCounts) =>
  `긍정 ${rate.positive}%, 중립 ${rate.neutral}%, 부정 ${rate.negative}%`;

export { toRates, toChartLabel };
export type { SentimentCounts };
