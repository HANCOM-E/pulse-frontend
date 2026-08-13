import { FeedItem } from '@/components/feedback/FeedItem';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ModerationActions } from '@/hooks/useModerationActions';
import type { Feedback } from '@/lib/schemas/api';

/**
 * 대시보드의 모더레이션 큐 위젯입니다. 독성으로 표시된 소감을 몇 건만 미리 보여주고
 * 항목마다 숨기기·삭제를 답니다.
 *
 * 조치 자체는 `useModerationActions`가 알고 이 컴포넌트는 그리기만 합니다. 그래서
 * "처리 실패" 배너를 화면 상단에 둘지 카드 안에 둘지도 이 파일이 정하지 않습니다.
 *
 * 숨긴 항목은 목록에서 빼지 않습니다. 되돌릴 수 있는 상태라 같은 자리에서 해제해야 합니다.
 */

/*
 * 카드 모양이 대시보드의 다른 섹션과 같습니다. `components/ui/`에 카드 프리미티브가 아직
 * 없어서 두 줄이 겹치는데, 이 위젯 하나 때문에 공용 컴포넌트를 새로 만들지는 않았습니다.
 */
const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';
const CARD_TITLE = 'text-xs font-normal leading-4 text-text-tertiary';

interface ModerationQueueProps {
  /** 독성으로 표시된 소감입니다. 이미 숨긴 건도 들어옵니다. */
  items: Feedback[];
  /** "N건 대기"에 쓰는 값입니다. 처리를 끝낸 건은 빠진 숫자여야 합니다. */
  waitingCount: number;
  /** 소감 하나의 메타 문구를 만듭니다. 세션 제목을 아는 건 화면 쪽이라 밖에서 받습니다. */
  formatMeta: (feedback: Feedback) => string;
  actions: ModerationActions;
}

const ModerationQueue = ({ items, waitingCount, formatMeta, actions }: ModerationQueueProps) => (
  <section className={CARD}>
    <div className="flex items-center justify-between gap-2">
      <h2 className={CARD_TITLE}>모더레이션 큐</h2>
      <div className="flex items-center gap-2">
        <Badge tone="toxic">{waitingCount}건 대기</Badge>
        {/* 전체보기 모달은 별도 이슈입니다. 지금은 자리만 잡습니다. */}
        <span className="text-xs font-normal leading-4 text-text-tertiary">전체보기</span>
      </div>
    </div>

    {/*
     * 목록 높이를 내용에 맡기지 않고 고정합니다. 조치할 때마다 건수가 줄어서, 늘어난 만큼만
     * 잡아두면 숨기기 한 번에 카드가 주저앉고 옆 카드까지 따라 올라옵니다.
     */}
    {items.length === 0 ? (
      <EmptyState className="h-80 justify-center" title="검토할 소감이 없어요" />
    ) : (
      <ul className="flex h-80 flex-col gap-2 overflow-y-auto">
        {items.map((feedback) => {
          const isHidden = feedback.status === 'HIDDEN';

          /*
           * 두 버튼이 같은 판정을 씁니다. 조치별로 나누면 숨기기가 도는 동안 삭제가 열려 있어서
           * 같은 소감의 상태 전이가 경쟁합니다.
           */
          const isPending = actions.isItemPending(feedback.id);

          return (
            <li key={feedback.id}>
              <FeedItem
                state={isHidden ? 'hidden' : 'flagged'}
                sentiment="toxic"
                meta={formatMeta(feedback)}
                content={feedback.text}
                actions={
                  <>
                    {/*
                     * 두 문구의 글자 수를 맞춰뒀습니다. 「숨김 해제」처럼 길이가 다르면 숨긴 줄만
                     * 버튼이 넓어져서 옆의 `삭제`가 줄마다 다른 자리에 놓입니다. 눌러야 할 버튼이
                     * 행마다 움직이면 연달아 처리할 때 잘못 누릅니다.
                     */}
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isPending}
                      onClick={() => actions.toggleHidden(feedback)}
                    >
                      {isHidden ? '보이기' : '숨기기'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isPending}
                      onClick={() => actions.remove(feedback.id)}
                    >
                      삭제
                    </Button>
                  </>
                }
              />
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

export { ModerationQueue };
