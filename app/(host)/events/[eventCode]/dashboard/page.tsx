import ModerationQueueModal from '@/components/moderation/ModerationQueueModal';

const DashboardPage = () => {
  // API: GET /events/{eventCode}/feedbacks. URL의 eventCode를 그대로 사용합니다.
  // /live 화면과 같은 useLiveFeedback 훅을 재사용할 예정입니다.
  // 모더레이션 큐는 별도 라우트가 아니라 "전체보기" 클릭 시 여는 모달입니다.
  return (
    <div>
      <p>실시간 모니터링 대시보드 (준비 중)</p>
      <ModerationQueueModal />
    </div>
  );
};

export default DashboardPage;
