const ModerationQueueModal = () => {
  // 대시보드의 모더레이션 큐 위젯에서 "전체보기"를 눌렀을 때 여는 모달입니다.
  // 별도 라우트가 아니라 대시보드 화면 위에 뜨는 오버레이입니다.
  // 탭(전체/독성/신고)과 항목별 숨기기·삭제 액션을 포함합니다.
  // API(openapi v0.3): GET /admin/feedbacks?eventCode={eventCode}&toxic=true,
  // PATCH /admin/feedbacks/{feedbackId}/hide(숨기기),
  // PATCH /admin/feedbacks/{feedbackId}/show(숨김 해제),
  // PATCH /admin/feedbacks/{feedbackId}/delete(삭제, 소프트 삭제).
  // 삭제는 DELETE 메서드가 아니라 PATCH .../delete입니다.
  return <div>모더레이션 큐 (준비 중)</div>;
};

export default ModerationQueueModal;
