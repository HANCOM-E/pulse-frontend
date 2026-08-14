import { DashboardView } from '@/components/dashboard/DashboardView';

/**
 * 주최자 실시간 모니터링 대시보드입니다.
 *
 * 화면 전체가 클라이언트 아일랜드(`DashboardView`)입니다. CLAUDE.md가 대시보드를 CSR로
 * 정해뒀고, 숫자·차트·피드가 전부 폴링 결과에서 나와서 서버가 미리 그릴 게 없습니다.
 * `eventCode`도 아일랜드가 `useParams`로 직접 읽으므로 여기서 넘기지 않습니다.
 *
 * API: GET /admin/feedbacks?eventCode={eventCode}. 주최자 화면이라 공개 스냅샷
 * (GET /events/{eventCode}/feedbacks)이 아니라 관리자 목록을 봅니다. 이유는
 * `hooks/useDashboardFeed.ts`에 적어뒀습니다.
 *
 * 모더레이션 큐는 별도 라우트가 아니라 이 화면 위에 뜨는 모달입니다. 안쪽 구현과
 * "전체보기" 연결은 별도 이슈입니다.
 */
const DashboardPage = () => {
  return (
    <main className="flex flex-col gap-6 p-5 md:p-8">
      <DashboardView />
    </main>
  );
};

export default DashboardPage;
