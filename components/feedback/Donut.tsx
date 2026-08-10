import type { ComponentProps } from 'react';

import { SentimentLegend } from '@/components/feedback/SentimentLegend';
import { toChartLabel, toRates, type SentimentCounts } from '@/components/feedback/sentiment';

interface DonutProps
  extends
    Omit<ComponentProps<'div'>, 'children' | 'role' | 'aria-label' | 'aria-labelledby'>,
    SentimentCounts {}

const SIZE = 112;
const THICKNESS = 16;
const CENTER = SIZE / 2;
const RADIUS = (SIZE - THICKNESS) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const Donut = ({ positive, neutral, negative, className = '', ...props }: DonutProps) => {
  const rate = toRates({ positive, neutral, negative });
  const total = positive + neutral + negative;

  /**
   * 호 길이는 백분율이 아니라 개수로 계산합니다. 반올림한 값을 쓰면 세 조각의 합이
   * 원주와 어긋나 마지막 조각 끝에 틈이 생깁니다.
   */
  let start = 0;
  const arcs = [
    { key: 'positive', value: positive, stroke: 'stroke-positive-default' },
    { key: 'neutral', value: neutral, stroke: 'stroke-neutral-lighter' },
    { key: 'negative', value: negative, stroke: 'stroke-negative-default' },
  ].map(({ key, value, stroke }) => {
    const length = total === 0 ? 0 : (value / total) * CIRCUMFERENCE;
    const offset = start;
    start += length;

    return { key, stroke, length, offset };
  });

  return (
    <div
      className={`flex flex-col items-center gap-3 ${className}`}
      {...props}
      role="img"
      aria-label={toChartLabel(rate)}
      aria-labelledby={undefined}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
        {/* 12시에서 시작하도록 돌립니다. SVG 원은 3시가 기본입니다. */}
        <g
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          fill="none"
          strokeWidth={THICKNESS}
          aria-hidden="true"
        >
          {/* 세 값이 모두 0일 때 빈 고리가 보이게 하는 바탕입니다. */}
          <circle cx={CENTER} cy={CENTER} r={RADIUS} className="stroke-background-muted" />

          {arcs.map(({ key, stroke, length, offset }) => (
            <circle
              key={key}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              className={stroke}
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={-offset}
            />
          ))}
        </g>
      </svg>

      <SentimentLegend rate={rate} align="center" />
    </div>
  );
};

export { Donut };
