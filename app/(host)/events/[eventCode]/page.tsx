import EventForm from '@/components/events/EventForm';

interface EventEditPageProps {
  params: Promise<{ eventCode: string }>;
}

const EventEditPage = async ({ params }: EventEditPageProps) => {
  // URL은 eventCode. openapi v0.3부터 수정·삭제(PATCH/DELETE /events/{eventCode})도
  // eventCode를 그대로 사용합니다. eventId를 먼저 조회할 필요가 없습니다.
  const { eventCode } = await params;

  return (
    <div className="min-h-dvh w-full flex flex-col justify-center items-center gap-6 p-14 bg-background-default">
      <EventForm eventCode={eventCode} />
    </div>
  );
};

export default EventEditPage;
