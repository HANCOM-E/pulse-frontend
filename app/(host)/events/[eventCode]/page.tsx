import ReportPanel from '@/components/report/ReportPanel';

const EventDetailPage = () => {
  // URL은 eventCode. 수정·삭제·세션·리포트생성(PATCH/DELETE /events/{eventId} 등)은
  // eventId가 필요하므로, GET /events/{eventCode}로 먼저 id를 조회해야 합니다.
  // ENDED 상태일 때만 아래 ReportPanel을 보여줍니다.
  return (
    <div>
      <p>이벤트 상세 (준비 중)</p>
      <ReportPanel />
    </div>
  );
};

export default EventDetailPage;
