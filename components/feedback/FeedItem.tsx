import type { ComponentProps, ReactNode } from 'react';

import { Badge } from '@/components/ui/Badge';
import type { Sentiment as FeedbackSentiment } from '@/lib/schemas/api';

type FeedItemState = 'normal' | 'flagged' | 'hidden';
type Sentiment = 'positive' | 'neutral' | 'negative' | 'none' | 'toxic';

/**
 * 서버가 내려주는 감정 코드를 배지 종류로 바꿉니다.
 *
 * 유니온과 같은 파일에 두는 이유는 감정을 하나 더 늘릴 때 짝을 빠뜨릴 수 없게 하려는
 * 것입니다. 실시간 피드와 모더레이션 큐가 같이 쓰는데, 화면마다 두면 한쪽만 고쳐집니다.
 *
 * `toxic`은 이 표에 없습니다. 독성은 감정 분류가 아니라 따로 붙는 플래그라, 같은 소감의
 * 감정 대신 독성을 보여줄지는 쓰는 화면이 정합니다.
 */
const FEED_SENTIMENT: Record<FeedbackSentiment, Sentiment> = {
  POS: 'positive',
  NEU: 'neutral',
  NEG: 'negative',
  UNKNOWN: 'none',
};

interface FeedItemProps extends Omit<ComponentProps<'article'>, 'children'> {
  state: FeedItemState;
  sentiment: Sentiment;
  meta: string;
  content: string;
  actions?: ReactNode;
}

const BASE = 'flex flex-col gap-1.5 rounded-lg border px-3.5 py-3';

const STATE: Record<FeedItemState, string> = {
  normal: 'border-border-subtle bg-background-default',
  flagged: 'border-toxic-lighter bg-background-default',
  hidden: 'border-transparent bg-background-muted',
};

const CONTENT: Record<FeedItemState, string> = {
  normal: 'text-text-primary',
  flagged: 'text-text-primary',
  hidden: 'text-text-tertiary',
};

const SENTIMENT: Record<Sentiment, { tone: ComponentProps<typeof Badge>['tone']; label: string }> =
  {
    positive: { tone: 'positive', label: '긍정' },
    neutral: { tone: 'neutral', label: '중립' },
    negative: { tone: 'negative', label: '부정' },
    none: { tone: 'outline', label: '미분류' },
    toxic: { tone: 'toxic', label: '⚑ 독성 의심' },
  };

const FeedItem = ({
  state,
  sentiment,
  meta,
  content,
  actions,
  className = '',
  ...props
}: FeedItemProps) => {
  const { tone, label } = SENTIMENT[sentiment];

  return (
    <article className={`${BASE} ${STATE[state]} ${className}`} {...props}>
      <div className="flex items-center justify-between gap-1.5">
        <Badge tone={tone}>{label}</Badge>
        <span className="text-xs font-normal leading-4 text-text-tertiary">
          {state === 'hidden' ? `${meta} · 숨김` : meta}
        </span>
      </div>

      <p className={`text-base font-normal leading-6 ${CONTENT[state]}`}>{content}</p>

      {actions ? <div className="flex gap-1.5">{actions}</div> : null}
    </article>
  );
};

export { FeedItem, FEED_SENTIMENT };
export type { FeedItemState, Sentiment };
