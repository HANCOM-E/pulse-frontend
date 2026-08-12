import { notFound } from 'next/navigation';

import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { buttonStyle } from '@/components/ui/Button';
import { fetchEventByCode, fetchPublicReport, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
interface EventEntryPageProps {
  params: Promise<{ code: string }>;
}

const EventEntryPage = async ({ params }: EventEntryPageProps) => {
  const { code } = await params;

  // 서버에서 부릅니다. 두 요청이 서로를 안 기다리도록 병렬로 보냅니다.
  // DRAFT·ENDED에서는 sessions를 안 쓰지만, 상태를 먼저 받고 결정하면
  // 가장 흔한 LIVE 경로가 왕복 하나만큼 느려집니다. 응답 하나 버리는 게 낫습니다.
  const [event, sessions] = await Promise.all([
    fetchEventByCode(code),
    fetchSessionsByEventCode(code),
  ]).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === 'EVENT_NOT_FOUND') notFound();
    throw error;
  });

  // 참가자는 DRAFT와 "세션이 아직 안 열림"을 구분할 수 없습니다. 둘 다 기다려야
  // 하는 상태라 같은 화면을 보여줍니다. DRAFT는 세션이 미리 만들어져 있어도
  // 막아야 합니다 — 폼이 뜨면 소감을 다 쓴 뒤에 EVENT_NOT_LIVE로 실패합니다.
  //
  // 세션 0개는 지금 API로는 나올 수 없습니다(DRAFT → LIVE 전환에 1개 이상 검사가
  // 있고 삭제 API가 없음). 다만 그 검사가 목에만 있어서, 실제 서버가 빠뜨리면
  // 칩 없는 폼이 뜨고 제출 버튼이 영원히 비활성이 됩니다. 조건 한 항목으로 막습니다.
  const canSubmit = event.status === 'LIVE' && sessions.length > 0;
  const isEnded = event.status === 'ENDED';

  // 리포트는 ENDED일 때만 봅니다. 없거나 비공개면 똑같이 404가 오는데,
  // 게스트에게 둘을 구분해 알리지 않기로 했습니다(#84).
  // 404만 삼키고 나머지 오류는 그대로 던집니다 — 통신 실패까지 "리포트 없음"으로
  // 읽으면 주최자가 공개해둔 리포트를 못 본 채로 화면이 멀쩡해 보입니다.
  const hasReport =
    isEnded &&
    (await fetchPublicReport(code)
      .then(() => true)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'REPORT_NOT_FOUND') return false;
        throw error;
      }));

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-4">
      <section className="flex flex-col gap-1">
        <p className="text-xs font-normal leading-4 text-text-tertiary">이벤트</p>
        <h1 className="text-xl font-semibold leading-7 text-text-primary">{event.title}</h1>
        {canSubmit ? (
          <p className="text-sm font-normal leading-5 text-text-secondary">
            {event.description ?? '오늘 들은 세션에 한줄 소감을 남겨주세요'}
          </p>
        ) : null}
      </section>

      {canSubmit ? (
        <FeedbackForm eventCode={code} sessions={sessions} />
      ) : isEnded ? (
        <EmptyState
          title="종료된 이벤트예요"
          description={
            hasReport
              ? '소감 제출은 마감되었어요'
              : '소감 제출은 마감되었어요\n주최자가 리포트를 준비하면 여기에 표시돼요'
          }
        >
          {hasReport ? (
            <Link href={`/e/${code}/report`} className={buttonStyle('primary', 'lg')}>
              결과 리포트 보기
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <EmptyState
          title="지금은 소감을 받는 세션이 없어요"
          description="세션이 열리면 여기서 남길 수 있어요"
        />
      )}
    </main>
  );
};

export default EventEntryPage;
