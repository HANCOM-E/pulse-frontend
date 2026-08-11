'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Textarea } from '@/components/ui/Textarea';

import type { SessionView } from '@/lib/schemas/api';
import { submitFeedback } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';

/**
 * 제출 실패 사유별 문구입니다.
 *
 * 컴포넌트 밖에 두는 이유는 렌더할 때마다 객체를 새로 만들 필요가 없어서입니다.
 * 표로 두면 사유가 늘 때 한 곳만 고치면 됩니다.
 */
const ERROR_MESSAGE: Record<string, string> = {
  RATE_LIMIT_EXCEEDED: '너무 자주 보내셨어요. 잠시 후 다시 시도해주세요',
  EVENT_NOT_LIVE: '지금은 소감을 받지 않는 이벤트예요',
  SESSION_NOT_FOUND: '세션을 찾을 수 없어요. 새로고침 후 다시 시도해주세요',
  SESSION_CLOSED: '이 세션은 소감을 받지 않아요',
};

const FALLBACK_MESSAGE = '소감을 보내지 못했어요. 잠시 후 다시 시도해주세요';
interface FeedbackFormProps {
  eventCode: string;
  sessions: SessionView[];
}

const FeedbackForm = ({ eventCode, sessions }: FeedbackFormProps) => {
  // CLOSED 세션은 목록에 남지만 고를 수 없습니다.
  const openSessions = sessions.filter((session) => session.status === 'ACTIVE');

  const [selectedId, setSelectedId] = useState<number | null>(
    openSessions.length === 1 ? openSessions[0].id : null,
  );
  const [text, setText] = useState('');

  const router = useRouter();

  const { mutate, isPending, error } = useMutation({
    mutationFn: (sessionId: number) =>
      submitFeedback(eventCode, {
        sessionId,
        text: text.trim(),
        sentiment: 'UNKNOWN',
        toxic: false,
        keywords: [],
        taggerVersion: 'none',
      }),
    // 보낸 값을 그대로 돌려받습니다. 여기서 selectedId를 다시 읽으면
    // 응답을 기다리는 사이 선택이 바뀌었을 때 저장된 세션과 이동할 세션이 어긋납니다.
    onSuccess: (_data, sessionId) => {
      router.push(`/e/${eventCode}/live?sessionId=${sessionId}`);
    },
  });

  return (
    <>
      <section className="flex flex-col gap-1">
        <p className="text-xs font-normal leading-4 text-text-tertiary">세션 선택</p>
        <div className="flex flex-wrap gap-2">
          {sessions.map((session) => (
            <Chip
              key={session.id}
              selected={session.id === selectedId}
              disabled={session.status === 'CLOSED' || isPending}
              onClick={() => setSelectedId(session.id)}
            >
              {session.title}
            </Chip>
          ))}
        </div>
        {sessions.some((session) => session.status === 'CLOSED') ? (
          <p className="text-xs font-normal leading-4 text-text-tertiary">
            아직 열리지 않은 세션은 선택할 수 없어요
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-normal leading-4 text-text-tertiary">한줄 소감</p>
          <p className="text-xs font-normal leading-4 text-text-tertiary">{text.length}/200</p>
        </div>
        <Textarea
          placeholder="이번 세션은 어떠셨나요?"
          maxLength={200}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </section>
      {error ? (
        <Banner type="negative" className="w-full">
          {error instanceof ApiError
            ? (ERROR_MESSAGE[error.code] ?? FALLBACK_MESSAGE)
            : FALLBACK_MESSAGE}
        </Banner>
      ) : null}
      <Banner type="info" className="w-full">
        제출하면 브라우저에서 감정을 자동 분석해요
      </Banner>

      <Button
        size="lg"
        className="w-full"
        disabled={selectedId === null || text.trim() === '' || isPending}
        onClick={() => mutate(selectedId!)}
      >
        {isPending ? '보내는 중...' : '소감 남기기'}
      </Button>
    </>
  );
};

export { FeedbackForm };
