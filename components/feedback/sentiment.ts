/**
 * 감정 분포 차트가 공유하는 계산입니다. Thermometer와 Donut이 같이 씁니다.
 *
 * 반올림을 여기서만 하는 이유는, 화면마다 나누면 합이 99나 101이 되어
 * 막대에 틈이 생기기 때문입니다(#47 결정).
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
