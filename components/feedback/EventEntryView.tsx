'use client';

import Link from 'next/link';

import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { buttonStyle } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useEventEntryFeed } from '@/hooks/useEventEntryFeed';
import type { EventView, SessionView } from '@/lib/schemas/api';

/**
 * 게스트 진입 화면의 클라이언트 경계입니다.
 *
 * `app/e/[code]/page.tsx`가 서버에서 첫 데이터를 받아 넘기고, 그다음부터는 `useEventEntryFeed`의
 * 폴링이 갱신을 맡습니다. 분기를 서버에 두면 주최자가 세션을 열거나 이벤트를 끝내도 게스트
 * 화면이 새로고침 전까지 모릅니다 — 서버 컴포넌트는 요청이 올 때 한 번 그려지고 끝이라서입니다.
 * `force-dynamic`은 그 한 번을 캐시하지 말라는 뜻일 뿐 다시 그려주지는 않습니다(#237).
 *
 * `main` 안쪽을 통째로 가져온 이유는 제목 아래 설명 문구까지 `canSubmit`에 걸려 있어서입니다.
 * 세 분기 중 하나만 클라로 올리면 나머지가 서버에 남아 같은 문제를 그대로 반복합니다.
 */

interface EventEntryViewProps {
  eventCode: string;
  initialEvent: EventView;
  initialSessions: SessionView[];
  initialHasReport: boolean;
}

const EventEntryView = ({
  eventCode,
  initialEvent,
  initialSessions,
  initialHasReport,
}: EventEntryViewProps) => {
  const { event, sessions, canSubmit, isEnded, hasReport } = useEventEntryFeed({
    eventCode,
    initialEvent,
    initialSessions,
    initialHasReport,
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-4">
      <section className="flex flex-col gap-1">
        <p className="text-xs font-normal leading-4 text-text-tertiary">이벤트</p>
        <h1 className="text-xl font-semibold leading-7 text-text-primary">{event.title}</h1>
        {canSubmit ? (
          <p className="text-sm font-normal leading-5 text-text-secondary">
            {event.description ?? '오늘 들은 세션에 한줄 소감을 남겨주세요'}
          </p>
        ) : null}
      </section>

      {canSubmit ? (
        <FeedbackForm eventCode={eventCode} sessions={sessions} />
      ) : isEnded ? (
        <EmptyState
          title="종료된 이벤트예요"
          description={
            hasReport
              ? '소감 제출은 마감되었어요'
              : '소감 제출은 마감되었어요\n주최자가 리포트를 준비하면 여기에 표시돼요'
          }
        >
          {hasReport ? (
            <Link href={`/e/${eventCode}/report`} className={buttonStyle('primary', 'lg')}>
              결과 리포트 보기
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <EmptyState
          title="지금은 소감을 받는 세션이 없어요"
          description="세션이 열리면 여기서 남길 수 있어요"
        />
      )}
    </main>
  );
};

export { EventEntryView };
