/**
 * `LiveResult`의 로딩 자리표시자입니다.
 *
 * 첫 스냅샷이 오기 전에 실제 화면을 그리면 "0개 소감 · 긍정 0%"가 되는데, 집계 결과가
 * 진짜 0건인 상태와 화면상 구분이 안 됩니다. 그래서 수치 대신 회색 블록을 보여줍니다.
 *
 * `useSearchParams`는 프리렌더 시 가장 가까운 Suspense 경계까지 클라이언트 렌더로
 * 떨어지므로, 이 컴포넌트가 그 경계의 fallback도 겸합니다.
 */
interface LiveSkeletonProps {
  /**
   * 제목 자리까지 대신 그릴지 여부입니다.
   *
   * 이 컴포넌트는 성격이 다른 두 자리에서 쓰입니다. `LiveResult` 안에서는 제목이 이미
   * 위에 그려진 뒤라 켜면 제목이 두 번 나옵니다. 반대로 `LiveResult` 통째를 기다리는
   * Suspense fallback에서는 켜야 합니다 — 끄면 이름이 도착할 때 아래가 통째로 밀립니다.
   */
  withHeading?: boolean;
}

const LiveSkeleton = ({ withHeading = false }: LiveSkeletonProps) => {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden>
      {/*
       * 실제 제목 블록과 높이를 맞춥니다. `h-4`·`h-7`은 각각 이벤트명 `leading-4`,
       * 세션명 `leading-7`의 줄 높이이고 `gap-1`도 같은 값입니다(`LiveResult`의 제목 묶음).
       */}
      {withHeading && (
        <div className="flex flex-col gap-1">
          <div className="h-4 w-28 rounded bg-neutral-subtle" />
          <div className="h-7 w-48 rounded bg-neutral-subtle" />
        </div>
      )}

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
