/**
 * `LiveResult`의 로딩 자리표시자입니다.
 *
 * 첫 스냅샷이 오기 전에 실제 화면을 그리면 "0개 소감 · 긍정 0%"가 되는데, 집계 결과가
 * 진짜 0건인 상태와 화면상 구분이 안 됩니다. 그래서 수치 대신 회색 블록을 보여줍니다.
 *
 * `useSearchParams`는 프리렌더 시 가장 가까운 Suspense 경계까지 클라이언트 렌더로
 * 떨어지므로, 이 컴포넌트가 그 경계의 fallback도 겸합니다.
 */
const LiveSkeleton = () => {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden>
      <section className="flex flex-col gap-2">
        <div className="h-4 w-40 rounded bg-neutral-subtle" />
        {/* `h-4`는 Thermometer 막대와 같은 값입니다. 실제 화면으로 바뀔 때 자리가 흔들리지 않습니다. */}
        <div className="h-4 w-full rounded-full bg-neutral-subtle" />
        <div className="h-4 w-full rounded bg-neutral-subtle" />
      </section>
      <section className="flex flex-col gap-2">
        <div className="h-4 w-24 rounded bg-neutral-subtle" />
        <div className="min-h-32 rounded-lg bg-neutral-subtle" />
      </section>
    </div>
  );
};

export { LiveSkeleton };
