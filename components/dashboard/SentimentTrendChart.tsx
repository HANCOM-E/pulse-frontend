import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { TREND_BUCKET_MS, type TrendPoint } from '@/components/dashboard/metrics';
import type { SentimentCounts } from '@/components/feedback/sentiment';

interface SentimentTrendChartProps extends SentimentCounts {
  trend: TrendPoint[];
  /**
   * 선이 그려지는 등장 애니메이션입니다. 인쇄용 문서(#268)만 끕니다.
   *
   * recharts는 선을 `stroke-dasharray`로 늘리면서 그립니다. 켜져 있으면 붙자마자 찍는
   * 순간에는 선이 거의 0 길이라, 종이에는 축과 격자만 있고 선은 왼쪽 끝 토막만 남습니다.
   * 애니메이션이 끝날 때까지 기다리는 방법도 있지만(기본 1.5초), 그동안 인쇄창이 안 떠서
   * 버튼이 먹통처럼 보입니다. 종이에서 애니메이션은 어차피 뜻이 없어서 아예 끕니다.
   */
  isAnimated?: boolean;
}
const SentimentTrendChart = ({
  trend,
  positive,
  neutral,
  negative,
  isAnimated = true,
}: SentimentTrendChartProps) => {
  return (
    <div
      className="h-40"
      role="img"
      aria-label={`${TREND_BUCKET_MS / 60_000}분 단위 감정별 소감 건수 추이. 긍정 ${positive}건, 중립 ${neutral}건, 부정 ${negative}건.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border-subtle)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border-subtle)',
              fontSize: '0.75rem',
            }}
          />
          <Line
            type="monotone"
            dataKey="POS"
            name="긍정"
            stroke="var(--color-positive-default)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={isAnimated}
          />
          <Line
            type="monotone"
            dataKey="NEU"
            name="중립"
            stroke="var(--color-neutral-default)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={isAnimated}
          />
          <Line
            type="monotone"
            dataKey="NEG"
            name="부정"
            stroke="var(--color-negative-default)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={isAnimated}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export { SentimentTrendChart };
