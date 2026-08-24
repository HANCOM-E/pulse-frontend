import type { TrendPoint } from '@/components/dashboard/metrics';
import { SentimentTrendChart } from '@/components/dashboard/SentimentTrendChart';
import type { SentimentCounts } from '@/components/feedback/sentiment';

/**
 * 시간대별 감정 추이 카드입니다. 제목·갱신 상태 표시·빈 상태를 맡고, 선을 그리는 일은
 * `SentimentTrendChart`가 합니다.
 *
 * 빈 상태를 차트 안에 넣지 않는 이유는 높이를 카드가 잡기 때문입니다. 「아직 그릴 소감이
 * 없어요」도 `h-40`이라, 소감이 처음 들어오는 순간 카드가 들썩이지 않습니다.
 */

/* 카드 모양이 대시보드의 다른 섹션과 같습니다. `components/ui/`에 카드 프리미티브가 아직 없습니다. */
const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';
const CARD_TITLE = 'text-xs font-normal leading-4 text-text-tertiary';

interface SentimentTrendCardProps extends SentimentCounts {
  trend: TrendPoint[];
  /**
   * 스트림으로 데이터가 흐르고 있는지입니다. 끊겨서 폴백 폴링으로 도는 동안에는 `false`라
   * 문구를 감춥니다 — 그 사이에도 숫자는 갱신되지만 "실시간"은 아닙니다.
   */
  isLive: boolean;
}

const SentimentTrendCard = ({
  trend,
  positive,
  neutral,
  negative,
  isLive,
}: SentimentTrendCardProps) => (
  <section className={CARD}>
    <div className="flex items-center justify-between gap-2">
      <h2 className={CARD_TITLE}>시간대별 감정 추이</h2>
      {isLive && (
        <span className="text-xs font-normal leading-4 text-text-tertiary">실시간 갱신 중</span>
      )}
    </div>

    {trend.length === 0 ? (
      <p className="flex h-40 items-center justify-center text-sm text-text-tertiary">
        아직 그릴 소감이 없어요
      </p>
    ) : (
      <SentimentTrendChart
        trend={trend}
        positive={positive}
        neutral={neutral}
        negative={negative}
      />
    )}
  </section>
);

export { SentimentTrendCard };
