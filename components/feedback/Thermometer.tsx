import type { ComponentProps } from 'react';

import { SentimentLegend } from '@/components/feedback/SentimentLegend';
import { toChartLabel, toRates, type SentimentCounts } from '@/components/feedback/sentiment';

interface ThermometerProps
  extends
    Omit<ComponentProps<'div'>, 'children' | 'role' | 'aria-label' | 'aria-labelledby'>,
    SentimentCounts {}

const Thermometer = ({
  positive,
  neutral,
  negative,
  className = '',
  ...props
}: ThermometerProps) => {
  const rate = toRates({ positive, neutral, negative });

  return (
    <div
      className={`flex flex-col gap-2 ${className}`}
      {...props}
      role="img"
      aria-label={toChartLabel(rate)}
      aria-labelledby={undefined}
    >
      <div className="flex h-4 overflow-hidden rounded-full bg-background-muted">
        <div className="bg-positive-default" style={{ flexGrow: positive }} />
        <div className="bg-neutral-lighter" style={{ flexGrow: neutral }} />
        <div className="bg-negative-default" style={{ flexGrow: negative }} />
      </div>

      <SentimentLegend rate={rate} />
    </div>
  );
};

export { Thermometer };
