'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * 강연자 화면 전용 AI 요약 훅입니다.
 *
 * 부르면 요약문을 만들어 state에 담고, 화면은 그 값을 그립니다. 요약을 만드는 곳은
 * `app/api/summary/route.ts`이고, 왜 주최자 리포트를 안 쓰는지는 그쪽 주석에 있습니다.
 *
 * 값은 state에만 둡니다. 저장해두면 소감이 계속 들어오는 동안 옛 요약이 최신인 척 남습니다.
 * 버튼 한 번이면 다시 만들어지므로 새로고침하면 사라지는 편이 낫습니다. 대신 만들어둔 요약은
 * 같은 세션에 머무는 동안 PDF에도 함께 실립니다.
 *
 * 키는 서버(Route Handler)에만 둡니다. 브라우저에서 OpenRouter를 직접 부르면 환경변수에
 * `NEXT_PUBLIC_` 접두사가 필요한데, 그 접두사가 키를 번들에 문자열로 박습니다. 이 화면은
 * 로그인 없는 공개 페이지라 주소만 알면 누구나 꺼낼 수 있습니다.
 */

/** 화면이 문구를 가르는 데 씁니다. 서버가 내려주는 코드와 같습니다. */
type SummaryErrorCode =
  /** 키가 설정되지 않았습니다. 개발자가 고칠 일이라 사용자에게 재시도를 권하지 않습니다. */
  | 'SUMMARY_NOT_CONFIGURED'
  /** 아직 소감이 없어 요약할 게 없습니다. */
  | 'NO_FEEDBACK'
  /** 모델 호출이 실패했습니다. 다시 눌러볼 만합니다. */
  | 'SUMMARY_FAILED';

interface UseSpeakerSummaryParams {
  eventCode: string;
  sessionId: number;
}

interface SpeakerSummary {
  /** 만들어진 요약문입니다. 아직 만들지 않았으면 `null`입니다. */
  text: string | null;
  isPending: boolean;
  /** 실패 사유입니다. 성공했거나 아직 안 눌렀으면 `null`입니다. */
  errorCode: SummaryErrorCode | null;
  generate: () => void;
}

const toErrorCode = (value: unknown): SummaryErrorCode =>
  value === 'SUMMARY_NOT_CONFIGURED' || value === 'NO_FEEDBACK' ? value : 'SUMMARY_FAILED';

const useSpeakerSummary = ({ eventCode, sessionId }: UseSpeakerSummaryParams): SpeakerSummary => {
  const [text, setText] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<SummaryErrorCode | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      /*
       * 소감 본문을 여기서 싣지 않습니다. 서버가 `eventCode`·`sessionId`로 직접 받아옵니다 —
       * 이유는 route handler 주석에 있습니다(무료 프록시 방지).
       */
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventCode, sessionId }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(toErrorCode((data as { code?: unknown })?.code));
      }

      const summaryText = (data as { text?: unknown })?.text;
      if (typeof summaryText !== 'string' || summaryText.trim() === '') {
        throw new Error('SUMMARY_FAILED');
      }

      return summaryText;
    },
    onSuccess: (summaryText) => {
      setText(summaryText);
      setErrorCode(null);
    },
    onError: (error: Error) => {
      setText(null);
      setErrorCode(toErrorCode(error.message));
    },
  });

  return {
    text,
    isPending: mutation.isPending,
    errorCode,
    generate: () => mutation.mutate(),
  };
};

export { useSpeakerSummary, type SpeakerSummary, type SummaryErrorCode };
