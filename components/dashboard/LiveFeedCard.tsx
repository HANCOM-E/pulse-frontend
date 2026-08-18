import { FEED_SENTIMENT, FeedItem } from '@/components/feedback/FeedItem';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ModerationActions } from '@/hooks/useModerationActions';
import type { Feedback } from '@/lib/schemas/api';

/**
 * 실시간 소감 피드 카드입니다. 참가자가 남긴 소감이 폴링으로 들어오는 대로 쌓입니다.
 *
 * 옆에 서는 `ModerationQueue`와 짝입니다. 받는 것도 같아서 props 이름을 맞췄습니다 —
 * 이쪽은 보이는 소감을, 그쪽은 숨겨진 소감을 받습니다.
 */

/* 카드 모양이 대시보드의 다른 섹션과 같습니다. `components/ui/`에 카드 프리미티브가 아직 없습니다. */
const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';
const CARD_TITLE = 'text-xs font-normal leading-4 text-text-tertiary';

interface LiveFeedCardProps {
  /** 이미 `VISIBLE`만 걸러진 목록입니다. 숨긴 건은 모더레이션 큐가 받습니다. */
  items: Feedback[];
  /** 소감 하나의 메타 문구를 만듭니다. 세션 제목을 아는 건 화면 쪽이라 밖에서 받습니다. */
  formatMeta: (feedback: Feedback) => string;
  actions: ModerationActions;
}

const LiveFeedCard = ({ items, formatMeta, actions }: LiveFeedCardProps) => (
  <section className={CARD}>
    <h2 className={CARD_TITLE}>실시간 소감 피드</h2>

    {/* 모더레이션 큐와 같은 이유로 높이를 고정합니다(`ModerationQueue.tsx`). */}
    {items.length === 0 ? (
      <EmptyState
        className="h-80 justify-center"
        title="아직 들어온 소감이 없어요"
        description="참가자가 소감을 남기면 여기에 바로 올라와요"
      />
    ) : (
      <ul className="flex h-80 flex-col gap-2 overflow-y-auto">
        {items.map((feedback) => (
          <li key={feedback.id}>
            <FeedItem
              state="normal"
              sentiment={FEED_SENTIMENT[feedback.sentiment]}
              meta={formatMeta(feedback)}
              content={feedback.text}
              /*
               * 자동 판정이 잡는 건 욕설뿐이라, 인신공격처럼 판정을 빠져나간 소감은
               * 주최자가 여기서 직접 내려야 합니다(#170).
               *
               * 삭제는 달지 않습니다. `DELETED`는 되돌릴 수 없는 종단 상태라 실시간으로
               * 흘러가는 목록에서 바로 누르게 둘 자리가 아닙니다. 숨기면 모더레이션
               * 큐로 넘어가서, 거기서 다시 보고 삭제하거나 되돌립니다.
               */
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={actions.isItemPending(feedback.id)}
                  onClick={() => actions.toggleHidden(feedback)}
                >
                  숨기기
                </Button>
              }
            />
          </li>
        ))}
      </ul>
    )}
  </section>
);

export { LiveFeedCard };
