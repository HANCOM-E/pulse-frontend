const ModerationPage = () => {
  // API: GET /admin/feedbacks?eventCode={eventCode}&toxic=true, PATCH /admin/feedbacks/{feedbackId}/hide.
  // URL의 eventCode를 그대로 쿼리 파라미터로 사용합니다(BE가 2026-08-05에 eventCode 필터를 추가함).
  return <div>모더레이션 큐 (준비 중)</div>;
};

export default ModerationPage;
