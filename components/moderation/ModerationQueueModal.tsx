const ModerationQueueModal = () => {
  // 대시보드의 모더레이션 큐 위젯에서 "전체보기"를 눌렀을 때 여는 모달입니다.
  // 별도 라우트가 아니라 대시보드 화면 위에 뜨는 오버레이입니다.
  // 탭(전체/독성/신고)과 항목별 숨기기·삭제 액션을 포함합니다.
  // API: GET /admin/feedbacks?eventCode={eventCode}&toxic=true,
  // PATCH /admin/feedbacks/{feedbackId}/hide, DELETE /admin/feedbacks/{feedbackId}.
  return <div>모더레이션 큐 (준비 중)</div>;
};

export default ModerationQueueModal;
