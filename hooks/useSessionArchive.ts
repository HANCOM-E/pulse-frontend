'use client';

import { useEffect, useState } from 'react';

import type { FeedbackView } from '@/lib/schemas/api';
import { mergeArchive, readArchive, writeArchive } from '@/lib/storage/sessionArchive';

/**
 * 스냅샷으로 들어오는 소감을 쌓아 시간대별 추이의 재료를 만듭니다.
 *
 * 왜 쌓아야 하는지는 `lib/storage/sessionArchive.ts`에 적어뒀습니다. 요약하면, 스냅샷이
 * 실어주는 소감은 최근 50건뿐인데 추이 차트는 소감마다 `createdAt`이 있어야 그릴 수 있어서
 * 한 장으로는 그 너머를 복원할 수 없습니다.
 *
 * 이 훅이 돌려주는 값은 **추이 차트에만** 씁니다. 총 소감 수·감정 비율·상위 키워드는 서버가
 * 전량으로 집계해 스냅샷에 실어주므로 그쪽을 그대로 쓰세요. 여기 모인 것으로 비율까지
 * 계산하면 화면 숫자가 서버 집계와 미묘하게 어긋납니다.
 */

interface UseSessionArchiveParams {
  eventCode: string;
  sessionId: number;
  /** 방금 도착한 스냅샷의 최근 50건입니다. 첫 스냅샷 전에는 `undefined`입니다. */
  recent: FeedbackView[] | undefined;
}

const useSessionArchive = ({
  eventCode,
  sessionId,
  recent,
}: UseSessionArchiveParams): FeedbackView[] => {
  const [archive, setArchive] = useState<FeedbackView[]>([]);

  useEffect(() => {
    /*
     * 저장된 기록은 브라우저에만 있어서 서버 렌더에서는 항상 비어 있습니다. 렌더 중에 읽으면
     * 서버와 클라이언트 결과가 어긋나므로 마운트 후에 읽습니다(`LiveResult`와 같은 이유).
     *
     * `react-hooks/set-state-in-effect`는 effect의 setState가 렌더를 연쇄시키는 걸 막는
     * 룰인데, 여기서는 세션이 바뀔 때 한 번으로 끝납니다.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setArchive(readArchive(eventCode, sessionId));
  }, [eventCode, sessionId]);

  useEffect(() => {
    if (recent === undefined) return;

    /*
     * 새 건이 없으면 `mergeArchive`가 받은 배열을 그대로 돌려주고, React는 같은 참조를 보고
     * 다시 그리지 않습니다. 스트림이 2초마다 오는데 이 보장이 없으면 소감이 안 들어오는
     * 동안에도 화면이 계속 다시 그려집니다.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setArchive((previous) => mergeArchive(previous, recent));
  }, [recent]);

  useEffect(() => {
    /*
     * 저장은 병합과 나눠 둡니다. `setArchive` 안에서 저장하면 React가 업데이터를 두 번 부르는
     * 개발 모드에서 같은 값을 두 번 쓰게 됩니다.
     *
     * 빈 배열은 쓰지 않습니다. 마운트 직후 읽기 전 상태가 빈 배열이라, 그대로 저장하면
     * 새로고침할 때마다 지금까지 모은 기록을 스스로 지웁니다.
     */
    if (archive.length === 0) return;

    writeArchive(eventCode, sessionId, archive);
  }, [archive, eventCode, sessionId]);

  return archive;
};

export { useSessionArchive };
