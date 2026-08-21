import EventForm from '@/components/events/EventForm';

const NewEventPage = () => {
  // API: POST /events. events/page.tsx의 "새 이벤트 만들기" 버튼이 이 페이지로 이동합니다.
  return (
    <div className="w-full flex flex-col items-center gap-6 px-14 py-8 bg-background-default">
      <EventForm />
    </div>
  );
};

export default NewEventPage;
