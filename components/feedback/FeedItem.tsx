import type { ComponentProps, ReactNode } from 'react';

import { Badge } from '@/components/ui/Badge';

type FeedItemState = 'normal' | 'flagged' | 'hidden';
type Sentiment = 'positive' | 'neutral' | 'negative' | 'none' | 'toxic';

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

const SENTIMENT: Record<Sentiment, { tone: ComponentProps<typeof Badge>['tone']; label: string }> = {
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

export { FeedItem };
export type { FeedItemState, Sentiment };
