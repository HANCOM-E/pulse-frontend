const EventNotFound = () => {
  return (
    <main className="flex flex-col gap-6 px-5 py-4">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border-subtle px-5 py-10">
        <div className="flex flex-col items-center gap-1">
          <p className="text-base font-medium leading-6 text-text-primary">
            이벤트를 찾을 수 없어요
          </p>
          <p className="text-sm dont-normal lading-5 text-text-secondary">
            링크가 올바른지 다시 확인해 주세요
          </p>
        </div>
      </div>
    </main>
  );
};

export default EventNotFound;
