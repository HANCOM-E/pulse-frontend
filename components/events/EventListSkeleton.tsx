/**
 * `EventsListPage`의 로딩 자리표시자입니다.
 *
 * `EventCard`와 같은 크기의 회색 블록을 3개 반복해서, 목록 자리가 갑자기
 * 비었다가 채워지는 대신 카드가 놓일 자리를 먼저 잡아둡니다.
 */
const EventCardSkeleton = () => (
  <div className="flex items-center justify-between rounded-xl border border-border-subtle p-4">
    <div className="flex flex-col gap-2">
      <div className="h-4 w-24 rounded bg-neutral-subtle" />
      <div className="h-5 w-40 rounded bg-neutral-subtle" />
    </div>
    <div className="h-4 w-16 rounded bg-neutral-subtle" />
  </div>
);

const EventListSkeleton = () => (
  <div className="flex animate-pulse flex-col gap-3" aria-hidden>
    {[0, 1, 2].map((slot) => (
      <EventCardSkeleton key={slot} />
    ))}
  </div>
);

export { EventListSkeleton };
