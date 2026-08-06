const EventEntryPage = () => {
  // API(openapi v0.3): GET /events/{eventCode}(이벤트 상세), GET /events/{eventCode}/sessions(세션 목록),
  // POST /events/{eventCode}/feedbacks(소감 제출, X-Client-Id 헤더 포함).
  // lib/api/endpoints.ts의 fetchSessions·submitFeedback이 이미 구현·테스트돼 있습니다(PR #12).
  // submitFeedback은 getClientId()로 X-Client-Id 헤더를 이미 붙여서 보냅니다.
  // 소감 제출에 성공하면 pulse_submitted_{sessionId}(제안값, 팀 확인 필요)를 저장해 /live 접근 제어에 씁니다.
  return <div>이벤트 진입 · 소감 제출 (준비 중)</div>;
};

export default EventEntryPage;
