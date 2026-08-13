'use client';

import { useCallback, useEffect, useRef } from 'react';

/** 축 2 정의: 3초 안에 판정이 안 끝나면 UNKNOWN으로 넘기고 제출은 진행합니다. */
const TAG_TIMEOUT_MS = 3000;

type Outgoing =
  { type: 'ready' } | { type: 'result'; logits: number[] } | { type: 'error'; message: string };

/**
 * 감정 태깅 워커를 다룹니다.
 *
 * 모델이 13.9MB라 제출 버튼을 누른 뒤 받기 시작하면 늦습니다. `warmup`을 입력이
 * 시작될 때 부르면 참가자가 타이핑하는 동안 받아둘 수 있습니다.
 *
 * `tag`는 실패해도 던지지 않고 `null`을 돌려줍니다. **태깅 때문에 소감을 못 남기면
 * 안 됩니다**(#82). 호출부는 `null`을 `toSubmitPayload`에 그대로 넘기면 됩니다.
 */
const useTagger = () => {
  const workerRef = useRef<Worker | null>(null);

  const getWorker = useCallback(() => {
    if (workerRef.current === null) {
      workerRef.current = new Worker(new URL('@/lib/tagger/tagger.worker.ts', import.meta.url), {
        type: 'module',
      });
    }
    return workerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  /** 모델을 미리 받아둡니다. 여러 번 불러도 워커가 같은 로딩을 재사용합니다. */
  const warmup = useCallback(() => {
    getWorker().postMessage({ type: 'warmup' });
  }, [getWorker]);

  const tag = useCallback(
    (text: string): Promise<number[] | null> => {
      const worker = getWorker();

      return new Promise((resolve) => {
        let settled = false;

        const finish = (logits: number[] | null) => {
          if (settled) return;
          settled = true;
          worker.removeEventListener('message', onMessage);
          clearTimeout(timer);
          resolve(logits);
        };

        const onMessage = ({ data }: MessageEvent<Outgoing>) => {
          if (data.type === 'result') finish(data.logits);
          if (data.type === 'error') finish(null);
        };

        // 타임아웃이 지나도 워커는 계속 돕니다. 다음 제출 때 모델이 이미 올라와 있게
        // 두는 편이 낫습니다 — 중간에 끊으면 매번 처음부터 받습니다.
        const timer = setTimeout(() => finish(null), TAG_TIMEOUT_MS);

        worker.addEventListener('message', onMessage);
        worker.postMessage({ type: 'tag', text });
      });
    },
    [getWorker],
  );

  return { warmup, tag };
};

export { useTagger };
