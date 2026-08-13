/**
 * `DashboardView`의 로딩 자리표시자입니다.
 *
 * 첫 응답이 오기 전에 실제 화면을 그리면 집계가 전부 0으로 찍히는데, 소감이 진짜 0건인
 * 이벤트와 화면상 구분이 안 됩니다. 그래서 수치 대신 회색 블록을 보여줍니다.
 *
 * 블록은 `aria-hidden`이지만 바깥 `role="status"`가 로딩 중이라는 사실을 알립니다.
 * 전체를 가려버리면 스크린리더에서는 화면이 그냥 빈 것처럼 읽힙니다.
 */
const DashboardSkeleton = () => (
  <div className="flex flex-col gap-4" role="status" aria-live="polite">
    <span className="sr-only">대시보드를 불러오고 있어요</span>
    <div aria-hidden="true" className="h-8 w-64 animate-pulse rounded-lg bg-background-muted" />
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {[0, 1, 2, 3].map((slot) => (
        <div key={slot} className="h-20 animate-pulse rounded-lg bg-background-muted" />
      ))}
    </div>
    <div aria-hidden="true" className="h-48 animate-pulse rounded-xl bg-background-muted" />
  </div>
);

export { DashboardSkeleton };
