'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchMyEvents } from '@/lib/api/endpoints';
import EventCard from '@/components/events/EventCard';
import useAuth from '@/hooks/useAuth';
import { useMemo, useState } from 'react';
import EventStatusFilterTabs, {
  EventStatusFilter,
} from '@/components/events/EventStatusFilterTabs';
import { Header } from '@/components/layout/Header';
import Link from 'next/link';
import { Banner } from '@/components/ui/Banner';
import EventListEmptyState from '@/components/events/EventListEmptyState';

const EventsListPage = () => {
  const [selectedTab, setSelectedTab] = useState<EventStatusFilter>('ALL');

  // API: GET/POST /events. "새 이벤트 만들기" 버튼은 /events/new로 이동합니다.
  const { user, logout } = useAuth();

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
    <>
      <Header email={user?.email ?? ''} onLogout={logout} />
      <div className="px-20 py-8">
        <div className="flex items-center justify-between gap-6">
          <p className="text-xl font-semibold text-text-primary">내 이벤트</p>
          <Link
            href="/events/new"
            className="inline-flex items-center justify-center gap-2.5 rounded-lg px-5 h-12 text-base font-semibold leading-6 bg-primary-darker text-text-inverse transition-colors hover:bg-primary-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker"
          >
            + 새 이벤트
          </Link>
        </div>
        {myEvents.isPending && <p>불러오는 중...</p>}
        {myEvents.isError && <Banner type="negative">이벤트 목록을 불러오지 못했습니다.</Banner>}
        {isEventsEmpty && (
          <EventListEmptyState
            title="아직 만든 이벤트가 없어요"
            description="첫 이벤트를 만들고 참가자에게 링크를 공유해보세요"
          />
        )}
        {isFilterEmpty && (
          <EventListEmptyState
            title="이 상태의 이벤트가 없어요"
            description="다른 탭을 선택해보세요"
          />
        )}
        {hasEvents && (
          <>
            <EventStatusFilterTabs selectedStatus={selectedTab} onChange={setSelectedTab} />
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </>
        )}
      </div>
    </>
  );
};

export default EventsListPage;
