'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { DASHBOARD_FEED_KEY } from '@/hooks/useDashboardFeed';
import { fetchModerationQueue } from '@/lib/api/endpoints';
import type { Feedback } from '@/lib/schemas/api';

/**
 * 대시보드를 PDF로 내보냅니다(#268). 소감 전량을 받아 인쇄용 문서를 띄우고 브라우저
 * 인쇄창을 여는 데까지가 이 훅의 일입니다. 무엇을 그리는지는 `DashboardPrintDocument`가 압니다.
 *
 * 라이브러리를 쓰지 않고 `window.print()`로 가는 이유는 이슈에 적어둔 그대로입니다 —
 * 의존성이 0개라 Vercel 비용 0 원칙을 건드리지 않고, 한글 폰트가 그대로 나가며,
 * recharts SVG가 벡터로 인쇄돼 확대해도 선명하고 텍스트 선택·검색이 됩니다.
 *
 * 화면이 보고 있는 `useDashboardFeed`를 그대로 쓸 수 없습니다. 저쪽은 `sessionId`를 서버로
 * 넘겨 거른 목록이라, 주최자가 세션 칩 하나를 눌러둔 채로 내보내면 나머지 세션 장을 그릴
 * 원본이 메모리에 없습니다. 그래서 "전체"(`sessionId: null`) 한 벌을 따로 받습니다.
 */

/**
 * 인쇄창을 열기 전에 기다리는 프레임 수입니다.
 *
 * 인쇄용 문서를 상시 마운트해두지 않아서(세션 10개면 recharts 차트가 11개 더 붙습니다)
 * 버튼을 누른 뒤에야 DOM이 생깁니다. 그런데 `SentimentTrendChart`의 `ResponsiveContainer`는
 * ResizeObserver로 부모의 실제 픽셀 크기를 재서 SVG 크기를 정하고, 그 콜백은 레이아웃이
 * 끝난 다음에 옵니다. `window.print()`는 동기로 블로킹해서 그 사이에 끼어들 틈을 주지
 * 않으므로, 붙이자마자 부르면 차트가 통째로 빈칸인 종이가 나갑니다.
 *
 * 두 프레임을 세는 건 첫 프레임에서 레이아웃이 잡히고 다음 프레임에 관측 결과가 반영되기
 * 때문입니다. 같은 이유로 인쇄용 문서를 `display: none`으로 숨기면 안 됩니다 — 부모가
 * 0×0이라 잴 크기 자체가 없습니다. 화면 밖으로 미는 쪽(`DashboardPrintDocument`)을 보세요.
 *
 * 종이에 선이 안 나오는 문제를 여기서 고치려 들지 마세요. 그건 크기가 아니라 등장
 * 애니메이션 때문이고(선을 1.5초에 걸쳐 늘려 그립니다), 프레임 수를 늘리는 대신
 * `SentimentTrendChart`의 `isAnimated`를 끄는 것으로 해결했습니다.
 */
const SETTLE_FRAMES = 2;

/** 프레임을 세는 일만 합니다. 되돌려주는 함수를 부르면 아직 남은 예약을 취소합니다. */
const afterFrames = (count: number, run: () => void) => {
  let handle = 0;

  const tick = (remaining: number) => {
    if (remaining === 0) {
      run();
      return;
    }

    handle = requestAnimationFrame(() => tick(remaining - 1));
  };

  tick(count);

  return () => cancelAnimationFrame(handle);
};

type PrintState =
  /** 소감을 받는 중입니다. 캐시에 이미 있으면 이 구간을 통과만 합니다. */
  | { phase: 'loading' }
  /** 인쇄용 문서가 붙어 있는 동안입니다. 인쇄창이 닫히면 끝납니다. */
  | { phase: 'printing'; feedbacks: Feedback[] }
  | { phase: 'idle' };

interface DashboardPrintControls {
  /**
   * 인쇄용 문서에 넘길 소감 전량입니다. `null`이면 아직 그릴 때가 아니라는 뜻이라,
   * 화면은 이 값이 있을 때만 문서를 마운트합니다.
   */
  feedbacks: Feedback[] | null;
  /** 버튼을 잠그는 데 씁니다. 소감을 받는 동안과 인쇄창이 떠 있는 동안 참입니다. */
  isPreparing: boolean;
  isError: boolean;
  start: () => void;
}

const useDashboardPrint = (eventCode: string): DashboardPrintControls => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PrintState>({ phase: 'idle' });
  const [isError, setIsError] = useState(false);

  const feedbacks = state.phase === 'printing' ? state.feedbacks : null;

  useEffect(() => {
    if (feedbacks === null) return;

    return afterFrames(SETTLE_FRAMES, () => {
      /*
       * 지금 브라우저들은 인쇄창이 닫힐 때까지 이 줄에서 멈춥니다. 그래서 바로 다음 줄에서
       * 문서를 걷어내도 인쇄에 들어간 내용이 사라지지 않습니다. `afterprint`를 기다리는
       * 방법도 있지만, 그 이벤트가 오지 않는 경우에는 화면 밖 문서와 잠긴 버튼이 영영
       * 남습니다.
       */
      window.print();
      setState({ phase: 'idle' });
    });
  }, [feedbacks]);

  /*
   * 화면이 보고 있는 것과 같은 캐시 칸(`sessionId`가 `null`인 자리)을 씁니다. "전체" 칩을
   * 눌러둔 상태였다면 이미 채워져 있어서 요청이 나가지 않고, `staleTime`이 그 판단을 합니다.
   *
   * 훅이 아니라 눌렀을 때 한 번 부르는 이유는, 관찰자로 붙여두면 이 화면이 쓰지도 않는
   * 목록을 이벤트가 끝날 때까지 들고 있게 되기 때문입니다.
   */
  const start = () => {
    if (state.phase !== 'idle') return;

    setIsError(false);
    setState({ phase: 'loading' });

    queryClient
      .fetchQuery({
        queryKey: [DASHBOARD_FEED_KEY, eventCode, null],
        queryFn: () => fetchModerationQueue({ eventCode, includeHidden: true }),
        staleTime: Infinity,
      })
      .then((items) => setState({ phase: 'printing', feedbacks: items }))
      .catch(() => {
        setIsError(true);
        setState({ phase: 'idle' });
      });
  };

  return {
    feedbacks,
    isPreparing: state.phase !== 'idle',
    isError,
    start,
  };
};

export { useDashboardPrint, type DashboardPrintControls };
