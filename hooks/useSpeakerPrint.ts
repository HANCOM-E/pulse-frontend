'use client';

import { useEffect, useState } from 'react';

/**
 * 강연자 화면을 PDF로 내보냅니다. 인쇄용 문서를 붙이고 브라우저 인쇄창을 여는 데까지가
 * 이 훅의 일입니다. 무엇을 그리는지는 `SpeakerPrintDocument`가 압니다.
 *
 * `useDashboardPrint`와 같은 일을 하지만 소감을 받아오는 단계가 없습니다. 그쪽은 화면이 보고
 * 있는 목록이 세션으로 걸러져 있어서 "전체" 한 벌을 따로 받아야 하는데, 이 화면은 애초에 세션
 * 하나만 봐서 그릴 값이 이미 전부 메모리에 있습니다.
 */

/**
 * 인쇄창을 열기 전에 기다리는 프레임 수입니다. 값의 근거는 `useDashboardPrint`의 같은 이름
 * 상수에 적혀 있습니다 — 요약하면 추이 차트가 부모 크기를 재는 콜백이 레이아웃 다음에 와서,
 * 붙이자마자 인쇄하면 차트가 빈칸으로 나갑니다.
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

interface SpeakerPrintControls {
  /** 참이면 화면이 인쇄용 문서를 마운트합니다. */
  isPrinting: boolean;
  start: () => void;
}

const useSpeakerPrint = (): SpeakerPrintControls => {
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (!isPrinting) return;

    return afterFrames(SETTLE_FRAMES, () => {
      /*
       * 지금 브라우저들은 인쇄창이 닫힐 때까지 이 줄에서 멈춥니다. 그래서 바로 다음 줄에서
       * 문서를 걷어내도 인쇄에 들어간 내용이 사라지지 않습니다. `afterprint`를 기다리면
       * 그 이벤트가 오지 않는 경우에 화면 밖 문서와 잠긴 버튼이 영영 남습니다.
       */
      window.print();
      setIsPrinting(false);
    });
  }, [isPrinting]);

  return {
    isPrinting,
    start: () => setIsPrinting(true),
  };
};

export { useSpeakerPrint, type SpeakerPrintControls };
