import ReportPanel from '@/components/report/ReportPanel';

const EventDetailPage = () => {
  // API: PATCH/DELETE /events/{eventId}. ENDED 상태일 때만 아래 ReportPanel을 보여줍니다.
  return (
    <div>
      <p>이벤트 상세 (준비 중)</p>
      <ReportPanel />
    </div>
  );
};

export default EventDetailPage;
