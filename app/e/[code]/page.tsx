import { notFound } from 'next/navigation';

import { fetchEventByCode, fetchPublicReport, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import { EventEntryView } from '@/components/feedback/EventEntryView';

export const dynamic = 'force-dynamic';
interface EventEntryPageProps {
  params: Promise<{ code: string }>;
}

/**
 * 첫 데이터만 서버에서 받아 `EventEntryView`에 넘깁니다. 화면 분기는 그쪽이 폴링 결과로 다시
 * 계산합니다(#237).
 *
 * fetch를 서버에 남겨두는 이유는 SSR HTML에 완성된 첫 화면을 실어 보내기 위해서입니다. 셋 다
 * 클라이언트로 내리면 게스트가 빈 화면을 먼저 받고 나서 요청 세 개를 새로 쏘게 됩니다.
 */
const EventEntryPage = async ({ params }: EventEntryPageProps) => {
  const { code } = await params;

  // 서버에서 부릅니다. 두 요청이 서로를 안 기다리도록 병렬로 보냅니다.
  // DRAFT·ENDED에서는 sessions를 쓸 일이 없지만, 상태를 먼저 받고 결정하면
  // 가장 흔한 LIVE 경로가 왕복 하나만큼 느려집니다. 안 쓰는 응답 하나가 낫습니다.
  const [event, sessions] = await Promise.all([
    fetchEventByCode(code),
    fetchSessionsByEventCode(code),
  ]).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === 'EVENT_NOT_FOUND') notFound();
    throw error;
  });

  // ENDED가 아니면 리포트가 있을 수 없어 부르지 않습니다. 훅의 `enabled: isEnded`와 같은 판단입니다.
  // 없거나 비공개면 똑같이 404가 오는데, 게스트에게 둘을 구분해 알리지 않기로 했습니다(#84).
  // 404만 삼키고 나머지 오류는 그대로 던집니다 — 통신 실패까지 "리포트 없음"으로 읽으면
  // 주최자가 공개해둔 리포트를 못 본 채로 화면이 멀쩡해 보입니다.
  const hasReport =
    event.status === 'ENDED' &&
    (await fetchPublicReport(code)
      .then(() => true)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'REPORT_NOT_FOUND') return false;
        throw error;
      }));

  return (
    <EventEntryView
      eventCode={code}
      initialEvent={event}
      initialSessions={sessions}
      initialHasReport={hasReport}
    />
  );
};

export default EventEntryPage;
