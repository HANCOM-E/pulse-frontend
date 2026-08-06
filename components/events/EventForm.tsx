const EventForm = () => {
  // 이벤트 등록/수정 공용 폼. 제목·이벤트코드·시작일·세션 목록으로 구성됩니다.
  // 세션 추가·수정·삭제는 페이지 이동 없이 이 컴포넌트 내부 상태(인라인 편집)로
  // 처리하고, 이벤트 삭제는 이 폼 위에 뜨는 확인 모달로 처리합니다.
  // API(openapi v0.3): POST /events(등록), PATCH /events/{eventCode}(수정),
  // DELETE /events/{eventCode}(삭제), POST /events/{eventCode}/sessions(세션 추가),
  // DELETE /events/{eventCode}/sessions/{sessionId}(세션 삭제).
  // 세션 수정(PATCH)에 대응하는 엔드포인트가 v0.3 명세에 없습니다. BE 확인이 필요합니다.
  return <div>이벤트 정보 입력 폼 (준비 중)</div>;
};

export default EventForm;
