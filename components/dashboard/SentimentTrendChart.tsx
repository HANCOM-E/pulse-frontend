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
}
const SentimentTrendChart = ({ trend, positive, neutral, negative }: SentimentTrendChartProps) => {
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
          />
          <Line
            type="monotone"
            dataKey="NEU"
            name="중립"
            stroke="var(--color-neutral-default)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="NEG"
            name="부정"
            stroke="var(--color-negative-default)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export { SentimentTrendChart };
