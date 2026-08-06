import EventForm from '@/components/events/EventForm';
import ReportPanel from '@/components/report/ReportPanel';

const EventEditPage = () => {
  // URL은 eventCode. openapi v0.3부터 수정·삭제(PATCH/DELETE /events/{eventCode})도
  // eventCode를 그대로 사용합니다. eventId를 먼저 조회할 필요가 없습니다.
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
