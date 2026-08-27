'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { DeckExtractError, extractDeckText } from '@/lib/deck/extractDeckText';
import type { DeckExtractErrorCode } from '@/lib/deck/extractDeckText';
import { clearDeckSummary, readDeckSummary, writeDeckSummary } from '@/lib/storage/deckSummary';

/**
 * 발표 자료 파일 하나를 요약문으로 바꿉니다.
 *
 * 단계는 둘입니다. 브라우저가 파일에서 텍스트를 뽑고(`lib/deck/extractDeckText.ts`), 그 텍스트를
 * Route Handler(`app/api/deck-summary/route.ts`)가 모델에 넘겨 한 문단으로 줄입니다. 원본 파일은
 * 브라우저 밖으로 나가지 않습니다.
 *
 * 결과는 **읽기 전용**입니다. 강연자가 손으로 고칠 수 없습니다(2026-08-27 결정). 마음에 안 들면
 * 파일을 다시 고르는 것이 유일한 방법입니다.
 *
 * 이 값의 유일한 목적지는 세션 리포트 생성 요청의 `materialSummary`입니다. 여기서 서버에 저장하지
 * 않습니다 — 저장은 리포트를 만들 때 BE가 한 번에 합니다.
 *
 * 리포트가 `GENERATED`로 확정되면 스스로 비웁니다. 그 뒤로는 BE가 같은 문자열을
 * `SessionReport.materialSummary`로 들고 있어서, 화면은 그쪽을 그리면 됩니다. 남겨두면 로컬 값과
 * 서버 값 둘 중 어느 쪽을 그리고 있는지가 흐려집니다.
 */

/** 화면이 안내 문구를 가르는 데 씁니다. 추출 단계와 요약 단계의 사유가 섞여 있습니다. */
export type DeckSummaryErrorCode =
  | DeckExtractErrorCode
  /** 키가 설정되지 않았습니다. 강연자가 할 수 있는 일이 없습니다. */
  | 'SUMMARY_NOT_CONFIGURED'
  /** 이 세션의 리포트가 이미 있습니다. 요약을 만들어도 실어 보낼 곳이 없습니다. */
  | 'REPORT_ALREADY_EXISTS'
  /** 모델 호출이 실패했습니다. 다시 시도해볼 만합니다. */
  | 'SUMMARY_FAILED';

const SERVER_ERROR_CODES = new Set<string>([
  'SUMMARY_NOT_CONFIGURED',
  'REPORT_ALREADY_EXISTS',
  'SUMMARY_FAILED',
]);

const EXTRACT_ERROR_CODES = new Set<string>([
  'UNSUPPORTED_FILE_TYPE',
  'FILE_TOO_LARGE',
  'NO_TEXT_LAYER',
  'EXTRACT_FAILED',
]);

const toErrorCode = (value: unknown): DeckSummaryErrorCode =>
  typeof value === 'string' && (SERVER_ERROR_CODES.has(value) || EXTRACT_ERROR_CODES.has(value))
    ? (value as DeckSummaryErrorCode)
    : 'SUMMARY_FAILED';

interface UseDeckSummaryParams {
  eventCode: string;
  sessionId: number;
  /**
   * 리포트가 `GENERATED`로 확정됐는지입니다. 참이 되면 들고 있던 요약을 비웁니다.
   *
   * 훅 밖에서 넘기는 이유는 리포트 상태를 아는 곳이 `useSessionReport`이기 때문입니다. 두 훅을
   * 하나로 합치지 않는 건 자료 요약이 리포트 없이도 만들어질 수 있는 값이라서입니다.
   */
  isReportGenerated: boolean;
}

interface DeckSummary {
  /** 요약을 만든 파일 이름입니다. 새로고침 뒤에 어느 자료로 만든 요약인지 알려줍니다. */
  fileName: string | null;
  /** 만들어진 요약문입니다. 아직 없으면 `null`입니다. */
  text: string | null;
  isPending: boolean;
  errorCode: DeckSummaryErrorCode | null;
  /** 파일을 고르면 부릅니다. 이미 요약이 있어도 새로 만듭니다. */
  selectFile: (file: File) => void;
}

const useDeckSummary = ({
  eventCode,
  sessionId,
  isReportGenerated,
}: UseDeckSummaryParams): DeckSummary => {
  const [cached, setCached] = useState<{ fileName: string; text: string } | null>(null);
  const [errorCode, setErrorCode] = useState<DeckSummaryErrorCode | null>(null);

  useEffect(() => {
    /*
     * 저장된 요약은 브라우저에만 있어서 서버 렌더에서는 항상 없습니다. 렌더 중에 읽으면 서버와
     * 클라이언트 결과가 어긋나므로 마운트 후에 읽습니다(`useSessionArchive`와 같은 이유).
     */
    const stored = readDeckSummary(eventCode, sessionId);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCached(stored === null ? null : { fileName: stored.fileName, text: stored.summary });
  }, [eventCode, sessionId]);

  useEffect(() => {
    if (!isReportGenerated) return;

    /*
     * 리포트가 확정된 뒤로는 BE가 같은 문자열을 들고 있습니다. 로컬 사본을 남겨두면 화면이
     * 어느 쪽을 그리는지 흐려지고, 다음 세션에서 남의 자료 요약을 보게 될 여지도 생깁니다.
     */
    clearDeckSummary(eventCode, sessionId);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCached(null);
    setErrorCode(null);
  }, [eventCode, sessionId, isReportGenerated]);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      /* 추출은 브라우저에서 끝납니다. 서버로 가는 것은 아래 `text`뿐입니다. */
      const deckText = await extractDeckText(file);

      const response = await fetch('/api/deck-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventCode, sessionId, text: deckText }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(toErrorCode((data as { code?: unknown })?.code));
      }

      const summary = (data as { text?: unknown })?.text;
      if (typeof summary !== 'string' || summary.trim() === '') {
        throw new Error('SUMMARY_FAILED');
      }

      return { fileName: file.name, text: summary };
    },
    onSuccess: (result) => {
      setCached(result);
      setErrorCode(null);
      /* 재시도에서 다시 실어 보내야 해서 남깁니다. 이유는 `lib/storage/deckSummary.ts`에 있습니다. */
      writeDeckSummary(eventCode, sessionId, { fileName: result.fileName, summary: result.text });
    },
    onError: (error: Error) => {
      /*
       * 실패해도 들고 있던 요약은 버리지 않습니다. 새 파일이 안 읽혔다고 이미 만들어 둔 요약까지
       * 사라지면, 리포트를 만들 수 있었던 사람이 아무것도 못 실어 보내게 됩니다.
       */
      setErrorCode(
        error instanceof DeckExtractError ? error.code : toErrorCode(error.message),
      );
    },
  });

  return {
    fileName: cached?.fileName ?? null,
    text: cached?.text ?? null,
    isPending: mutation.isPending,
    errorCode,
    selectFile: (file: File) => mutation.mutate(file),
  };
};

export { useDeckSummary };
