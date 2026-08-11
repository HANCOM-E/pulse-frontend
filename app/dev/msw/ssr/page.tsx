import { notFound } from 'next/navigation';
import { fetchEventByCode, fetchPublicReport } from '@/lib/api/endpoints';
import { isMockingEnabled } from '@/mocks/config';

/**
 * 서버 쪽 목 가로채기 확인용 페이지입니다. `/dev/msw/ssr`
 *
 * 브라우저 워커는 서버 컴포넌트의 fetch를 가로채지 못합니다.
 * 이 페이지가 데이터를 보여준다면 `instrumentation.ts`의 `msw/node`가 살아 있다는 뜻이고,
 * 공개 페이지(`app/e/[code]/report`)를 SSR로 만들어도 목이 붙는다는 뜻입니다.
 */

// 목 데이터가 매 요청 반영되도록 캐시하지 않습니다.
export const dynamic = 'force-dynamic';

const ENDED_EVENT_CODE = 'kd7m2p';

const DevMswSsrPage = async () => {
  if (!isMockingEnabled) {
    notFound();
  }

  const event = await fetchEventByCode(ENDED_EVENT_CODE);
  const report = await fetchPublicReport(ENDED_EVENT_CODE);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8 text-sm">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">SSR 목 확인</h1>
        <p className="text-zinc-500">
          이 문단이 보이면 서버 컴포넌트 fetch도 목에 걸린 것입니다. 코드 {ENDED_EVENT_CODE}
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          {event.title} · {event.status}
        </h2>
        <p>{report.summaryText}</p>
        <p className="text-zinc-500">
          상위 키워드: {report.topKeywords.map((k) => `${k.keyword}(${k.count})`).join(', ')}
        </p>
        <p className="text-zinc-500">미분류 {report.unclassifiedCount}건</p>
      </section>
    </main>
  );
};

export default DevMswSsrPage;
