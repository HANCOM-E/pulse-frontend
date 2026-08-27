import Link from 'next/link';
import { type MouseEvent } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ChevronRightIcon, DuplicateIcon } from '@/components/ui/icons';
import { EVENT_STATUS_BADGE } from '@/components/events/eventStatusBadge';

import { PulseEvent } from '@/lib/schemas/api';
import formatEventDate from '@/lib/formatEventDate';
import { useRouter } from 'next/navigation';

export interface EventCardProps {
  event: PulseEvent;
}

const RIGHT_CONTENT_BY_STATUS = {
  LIVE: (event: PulseEvent) => ({
    label: `${window.location.origin}/e/${event.code}`,
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
  const router = useRouter();

  if (event.status === 'DELETED') {
    return;
  }

  const { tone, label } = EVENT_STATUS_BADGE[event.status];

  const datetime = formatEventDate(event.eventDate);
  const rightContent = RIGHT_CONTENT_BY_STATUS[event.status](event);
  const href = ROUTE_BY_STATUS[event.status](event);
  const eventCode = event.code;

  const handleDuplicateClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    router.push(`/events/new?duplicateFrom=${eventCode}`);
  };

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
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleDuplicateClick}
          aria-label="이벤트 복제"
          title="이벤트 복제"
          className="cursor-pointer text-text-tertiary transition-colors hover:text-text-primary"
        >
          <DuplicateIcon className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <p className={rightContent.className}>{rightContent.label}</p>
          <ChevronRightIcon className="h-4.5 w-4.5 text-text-primary" />
        </div>
      </div>
    </Link>
  );
};

export default EventCard;
