const EventEntryPage = () => {
  // API: GET /events/{eventCode}, POST /events/{eventCode}/feedbacks.
  // 소감 제출에 성공하면 pulse_submitted_{sessionId}(제안값, 팀 확인 필요)를 저장해 /live 접근 제어에 씁니다.
  return <div>이벤트 진입 · 소감 제출 (준비 중)</div>;
};

export default EventEntryPage;
