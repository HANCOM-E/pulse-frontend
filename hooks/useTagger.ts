'use client';

import { useCallback, useEffect, useRef } from 'react';

/** 축 2 정의: 3초 안에 판정이 안 끝나면 UNKNOWN으로 넘기고 제출은 진행합니다. */
const TAG_TIMEOUT_MS = 3000;

type Outgoing =
  | { type: 'ready' }
  | { type: 'result'; id: number; logits: number[] }
  | { type: 'error'; id: number; message: string };

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
  const unsupportedRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const getWorker = useCallback((): Worker | null => {
    if (unsupportedRef.current) return null;
    if (workerRef.current !== null) return workerRef.current;

    try {
      workerRef.current = new Worker(new URL('@/lib/tagger/tagger.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      unsupportedRef.current = true;
    }

    return workerRef.current;
  }, []);

  /** 모델을 미리 받아둡니다. 여러 번 불러도 워커가 같은 로딩을 재사용합니다. */
  const warmup = useCallback(() => {
    try {
      getWorker()?.postMessage({ type: 'warmup' });
    } catch {
      // textarea 포커스에서 부르는 자리라 던지면 입력이 막힙니다.
    }
  }, [getWorker]);

  const tag = useCallback(
    (text: string): Promise<number[] | null> => {
      const worker = getWorker();
      if (worker === null) return Promise.resolve(null);

      // 타임아웃 뒤 늦게 온 이전 요청의 결과가 다음 요청에 붙는 걸 막습니다.
      const id = (requestIdRef.current += 1);

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
          if (data.type === 'ready') return;
          if (data.id !== id) return;

          finish(data.type === 'result' ? data.logits : null);
        };

        // 타임아웃이 지나도 워커는 계속 돕니다. 다음 제출 때 모델이 이미 올라와 있게
        // 두는 편이 낫습니다 — 중간에 끊으면 매번 처음부터 받습니다.
        const timer = setTimeout(() => finish(null), TAG_TIMEOUT_MS);

        try {
          worker.addEventListener('message', onMessage);
          worker.postMessage({ type: 'tag', id, text });
        } catch {
          finish(null);
        }
      });
    },
    [getWorker],
  );

  return { warmup, tag };
};

export { useTagger };
