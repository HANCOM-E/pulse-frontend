'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchMyEvents } from '@/lib/api/endpoints';
import EventCard from '@/components/events/EventCard';
import { useMemo, useState } from 'react';
import EventStatusFilterTabs, {
  EventStatusFilter,
} from '@/components/events/EventStatusFilterTabs';
import Link from 'next/link';
import { Banner } from '@/components/ui/Banner';
import EventListEmptyState from '@/components/events/EventListEmptyState';
import { EventListSkeleton } from '@/components/events/EventListSkeleton';
import { buttonStyle } from '@/components/ui/Button';

const EventsListPage = () => {
  const [selectedTab, setSelectedTab] = useState<EventStatusFilter>('ALL');

  // API: GET/POST /events. "새 이벤트 만들기" 버튼은 /events/new로 이동합니다.
  const myEvents = useQuery({
    queryKey: ['events', 'my'],
    queryFn: fetchMyEvents,
  });

  const filteredEvents = useMemo(() => {
    if (selectedTab === 'ALL') {
      return myEvents.data ?? [];
    }

    return (myEvents.data ?? []).filter((event) => event.status === selectedTab);
  }, [myEvents.data, selectedTab]);

  let isEventsEmpty = false;
  let isFilterEmpty = false;
  let hasEvents = false;

  if (myEvents.isSuccess) {
    isEventsEmpty = myEvents.data.length === 0;
    isFilterEmpty = myEvents.data.length > 0 && filteredEvents.length === 0;
    hasEvents = filteredEvents.length > 0;
  }

  return (
    <div className="flex flex-col gap-6 px-20 py-8">
      <div className="flex items-center justify-between gap-6">
        <p className="text-xl font-semibold text-text-primary">내 이벤트</p>
        <Link href="/events/new" className={buttonStyle('primary', 'md')}>
          + 새 이벤트
        </Link>
      </div>
      {myEvents.isPending && <EventListSkeleton />}
      {myEvents.isError && <Banner type="negative">이벤트 목록을 불러오지 못했습니다.</Banner>}
      {isEventsEmpty && (
        <EventListEmptyState
          title="아직 만든 이벤트가 없어요"
          description="첫 이벤트를 만들고 참가자에게 링크를 공유해보세요"
        />
      )}
      {myEvents.isSuccess && !isEventsEmpty && (
        <EventStatusFilterTabs selectedStatus={selectedTab} onChange={setSelectedTab} />
      )}
      {isFilterEmpty && (
        <EventListEmptyState
          title="이 상태의 이벤트가 없어요"
          description="다른 탭을 선택해보세요"
        />
      )}
      {hasEvents && (
        <div className="flex flex-col gap-3">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsListPage;
