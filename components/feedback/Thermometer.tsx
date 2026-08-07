import type { ComponentProps } from 'react';

interface ThermometerProps extends Omit<
  ComponentProps<'div'>,
  'children' | 'role' | 'aria-label' | 'aria-labelledby'
> {
  positive: number;
  neutral: number;
  negative: number;
}

const toPercent = (value: number, total: number) =>
  total === 0 ? 0 : Math.round((value / total) * 100);

const Thermometer = ({
  positive,
  neutral,
  negative,
  className = '',
  ...props
}: ThermometerProps) => {
  const total = positive + neutral + negative;

  const rate = {
    positive: toPercent(positive, total),
    neutral: toPercent(neutral, total),
    negative: toPercent(negative, total),
  };

  return (
    <div
      className={`flex flex-col gap-2 ${className}`}
      {...props}
      role="img"
      aria-label={`긍정 ${rate.positive}%, 중립 ${rate.neutral}%, 부정 ${rate.negative}%`}
      aria-labelledby={undefined}
    >
      <div className="flex h-4 overflow-hidden rounded-full bg-background-muted">
        <div className="bg-positive-default" style={{ flexGrow: positive }} />
        <div className="bg-neutral-lighter" style={{ flexGrow: neutral }} />
        <div className="bg-negative-default" style={{ flexGrow: negative }} />
      </div>

      <div className="flex justify-between text-xs font-normal leading-4">
        <span className="text-positive-darker">긍정 {rate.positive}%</span>
        <span className="text-text-secondary">중립 {rate.neutral}%</span>
        <span className="text-negative-darker">부정 {rate.negative}%</span>
      </div>
    </div>
  );
};

export { Thermometer };
