import type { BadgeTone } from '@/components/ui/Badge';
import type { EventStatus, PulseEvent } from '@/lib/schemas/api';

/**
 * 이벤트 상태 배지의 톤·한글 라벨 표입니다.
 *
 * 이벤트 목록(`EventCard`)과 대시보드 헤더(`DashboardView`)가 같은 상태를 다른 자리에서
 * 그립니다. 표가 한 곳에 있어야 라벨을 바꿀 때 두 화면이 갈라지지 않습니다 — #192가
 * 목록만 한글화하고 대시보드를 빠뜨린 것이 이 표를 만든 이유입니다.
 *
 * `DELETED`는 없습니다. 삭제된 이벤트는 목록 응답에서 빠지고 화면도 그리지 않습니다.
 */
type VisibleEventStatus = Exclude<EventStatus, 'DELETED'>;

const EVENT_STATUS_BADGE: Record<VisibleEventStatus, { tone: BadgeTone; label: string }> = {
  LIVE: { tone: 'positive', label: '● 진행 중' },
  DRAFT: { tone: 'neutral', label: '준비 중' },
  ENDED: { tone: 'info', label: '종료' },
};

/**
 * 화면에 그릴 수 있는 이벤트인지 봅니다.
 *
 * 위 표가 `DELETED` 키를 갖지 않아서, 상태를 좁히지 않은 이벤트로는 표를 인덱싱할 수
 * 없습니다. `event.status !== 'DELETED'` 비교만으로는 `event` 자체가 좁혀지지 않아
 * 타입 가드로 둡니다.
 */
const isVisibleEvent = (event: PulseEvent): event is PulseEvent & { status: VisibleEventStatus } =>
  event.status !== 'DELETED';

export { EVENT_STATUS_BADGE, isVisibleEvent, type VisibleEventStatus };
