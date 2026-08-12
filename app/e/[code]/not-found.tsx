import { EmptyState } from '@/components/ui/EmptyState';

const EventNotFound = () => {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-4">
      <EmptyState
        title="이벤트를 찾을 수 없어요"
        description="링크가 올바른지 다시 확인해 주세요"
      />
    </main>
  );
};

export default EventNotFound;
