import type { SentimentCounts } from '@/components/feedback/sentiment';

type LegendAlign = 'between' | 'center';

interface SentimentLegendProps {
  /** 개수가 아니라 백분율입니다. `toRates`를 거친 값을 넘기세요. */
  rate: SentimentCounts;
  align?: LegendAlign;
}

const ALIGN: Record<LegendAlign, string> = {
  between: 'justify-between',
  center: 'justify-center gap-2',
};

/**
 * 감정 분포 차트 아래에 붙는 숫자 줄입니다. Thermometer와 Donut이 같이 씁니다.
 *
 * 긍정과 부정은 명도가 거의 같아(1.13:1) 색만으로는 구분되지 않습니다.
 * 숫자가 진실이고 색은 보조라, 차트에서 이 줄을 빼지 마세요.
 */
const SentimentLegend = ({ rate, align = 'between' }: SentimentLegendProps) => (
  <div className={`flex text-xs font-normal leading-4 ${ALIGN[align]}`}>
    <span className="text-positive-darker">긍정 {rate.positive}%</span>
    <span className="text-text-secondary">중립 {rate.neutral}%</span>
    <span className="text-negative-darker">부정 {rate.negative}%</span>
  </div>
);

export { SentimentLegend };
export type { LegendAlign };
