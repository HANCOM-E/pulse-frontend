import EventForm from '@/components/events/EventForm';
import ReportPanel from '@/components/report/ReportPanel';

const EventEditPage = () => {
  // URL은 eventCode. 수정·삭제·세션·리포트생성(PATCH/DELETE /events/{eventId} 등)은
  // eventId가 필요하므로, GET /events/{eventCode}로 먼저 id를 조회해야 합니다.
  // 진행 중(LIVE/DRAFT) 상태면 EventForm(수정 모드)을, ENDED 상태면 ReportPanel을
  // 보여줍니다.
  return (
    <div>
      <p>이벤트 수정 (준비 중)</p>
      <EventForm />
      <ReportPanel />
    </div>
  );
};

export default EventEditPage;
