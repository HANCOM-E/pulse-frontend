import { PulseEvent } from '@/lib/schemas/api';
import { Badge } from '@/components/ui/Badge';
import { ChevronRightIcon } from '@/components/ui/icons';
import Link from 'next/link';
import formatEventDate from '@/lib/formatEventDate';

export interface EventCardProps {
  event: PulseEvent;
}

const TONE_BY_STATUS: Record<
  'LIVE' | 'DRAFT' | 'ENDED',
  { tone: 'positive' | 'neutral' | 'info'; label: string }
> = {
  LIVE: { tone: 'positive', label: '● 진행 중' },
  DRAFT: { tone: 'neutral', label: '준비 중' },
  ENDED: { tone: 'info', label: '종료' },
};

const RIGHT_CONTENT_BY_STATUS = {
  LIVE: (event: PulseEvent) => ({
    label: `pulse.app/e/${event.code}`,
    className: 'text-xs text-primary-darker',
  }),
  ENDED: () => ({
    label: '리포트 공개됨',
    className: 'text-xs text-text-secondary',
  }),
  DRAFT: () => ({ label: '', className: '' }),
};

const ROUTE_BY_STATUS = {
  DRAFT: (event: PulseEvent) => `/events/${event.code}`,
  LIVE: (event: PulseEvent) => `/events/${event.code}/dashboard`,
  ENDED: (event: PulseEvent) => `/events/${event.code}/dashboard`,
};

const EventCard = ({ event }: EventCardProps) => {
  if (event.status === 'DELETED') return;

  const { tone, label } = TONE_BY_STATUS[event.status];

  // TODO : 현재는 이벤트 생성 날짜(createdAt)으로 작업했으나, 백엔드 ERD에 '실제 이벤트 일자'가 추가되면 해당 날짜로 사용해야 함.
  const datetime = formatEventDate(event.createdAt);
  const rightContent = RIGHT_CONTENT_BY_STATUS[event.status](event);
  const href = ROUTE_BY_STATUS[event.status](event);

  return (
    <Link
      href={href}
      className="flex items-center justify-between p-4 rounded-xl border border-border-subtle"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{label}</Badge>
          <span className="text-xs text-text-tertiary">
            {event.status === 'DRAFT' ? '미공개' : datetime}
          </span>
        </div>
        <p className="text-lg text-text-primary">{event.title}</p>
      </div>
      <div className="flex items-center gap-2">
        <p className={rightContent.className}>{rightContent.label}</p>
        <ChevronRightIcon className="h-4.5 w-4.5 text-text-primary" />
      </div>
    </Link>
  );
};

export default EventCard;
