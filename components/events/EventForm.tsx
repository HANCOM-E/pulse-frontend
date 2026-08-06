const EventForm = () => {
  // 이벤트 등록/수정 공용 폼. 제목·이벤트코드·시작일·세션 목록으로 구성됩니다.
  // 세션 추가·수정·삭제는 페이지 이동 없이 이 컴포넌트 내부 상태(인라인 편집)로
  // 처리하고, 이벤트 삭제는 이 폼 위에 뜨는 확인 모달로 처리합니다.
  // API: POST /events(등록), PATCH /events/{eventId}(수정), DELETE /events/{eventId}.
  return <div>이벤트 정보 입력 폼 (준비 중)</div>;
};

export default EventForm;
