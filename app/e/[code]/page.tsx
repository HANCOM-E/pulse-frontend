import { fetchEventByCode, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { notFound } from 'next/navigation';
import { ApiError } from '@/lib/apiClient';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';

export const dynamic = 'force-dynamic';

interface EventEntryPageProps {
  params: Promise<{ code: string }>;
}

const EventEntryPage = async ({ params }: EventEntryPageProps) => {
  const { code } = await params;

  // 서버에서 부릅니다. 두 요청이 서로를 안 기다리도록 병렬로 보냅니다.
  const [event, sessions] = await Promise.all([
    fetchEventByCode(code),
    fetchSessionsByEventCode(code),
  ]).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === 'EVENT_NOT_FOUND') notFound();
    throw error;
  });

  return (
    <main className="flex flex-col gap-6 p-5">
      <section className="flex flex-col gap-1">
        <p className="text-xs font-normal leading-4 text-text-tertiary">이벤트</p>
        <h1 className="text-xl font-semibold leading-7 text-text-primary">{event.title}</h1>
        <p className="text-sm font-normal leading-5 text-text-secondary">
          {event.description ?? '오늘 들은 세션에 한줄 소감을 남겨주세요'}
        </p>
      </section>
      <FeedbackForm eventCode={code} sessions={sessions} />
    </main>
  );
};

export default EventEntryPage;
