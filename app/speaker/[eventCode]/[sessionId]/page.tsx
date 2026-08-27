import { notFound } from 'next/navigation';

import { SpeakerSessionView } from '@/components/speaker/SpeakerSessionView';

/**
 * 강연자가 자기 세션 반응만 보는 화면입니다.
 *
 * 화면 전체가 클라이언트 아일랜드(`SpeakerSessionView`)입니다. 주최자 대시보드와 같은 이유로
 * CSR입니다 — 숫자·차트·피드가 전부 스트림 결과에서 나와서 서버가 미리 그릴 게 없습니다.
 *
 * 로그인을 보지 않습니다. 여기 그리는 값은 전부 공개 엔드포인트
 * (`GET /events/{code}/feedbacks?sessionId=`)에서 오고, 그 엔드포인트가 인증을 요구하지 않습니다.
 * 그래서 이 화면은 접근 제어가 아니라 화면 분리입니다 — 주소를 아는 사람은 누구나 열 수
 * 있지만, 이 화면 때문에 새로 새는 정보는 없습니다.
 */
interface SpeakerSessionPageProps {
  params: Promise<{ eventCode: string; sessionId: string }>;
}

const SpeakerSessionPage = async ({ params }: SpeakerSessionPageProps) => {
  const { eventCode, sessionId } = await params;

  /*
   * 숫자가 아닌 `sessionId`는 렌더 전에 끊습니다. 그대로 넘기면 `Number()`가 `NaN`이 되어
   * 어떤 세션과도 매칭되지 않는데, 화면에는 "세션을 찾을 수 없어요"가 떠서 삭제된 세션과
   * 구분이 안 됩니다. 주소가 잘못된 것은 404가 맞습니다.
   *
   * 소수점·음수·0도 함께 거릅니다. 계약의 `id`가 양의 정수라 그 밖의 값은 존재할 수 없습니다.
   */
  const parsedSessionId = Number(sessionId);

  if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
    notFound();
  }

  return (
    <main className="flex flex-col gap-6 p-5 md:px-20">
      <SpeakerSessionView eventCode={eventCode} sessionId={parsedSessionId} />
    </main>
  );
};

export default SpeakerSessionPage;
