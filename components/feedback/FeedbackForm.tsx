'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { CheckIcon } from '@/components/ui/icons';
import { Textarea } from '@/components/ui/Textarea';

import type { SessionView } from '@/lib/schemas/api';
import { submitFeedback } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import { listSubmitted, markSubmitted } from '@/lib/storage/submitted';

import { toSubmitPayload } from '@/lib/tagger';
import { useTagger } from '@/hooks/useTagger';

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
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [text, setText] = useState('');

  const router = useRouter();
  const { warmup, tag } = useTagger();

  /*
   * 제출 기록은 브라우저에만 있어서 서버 렌더에서는 항상 비어 있습니다. 렌더 중에 읽으면
   * 서버와 클라이언트 결과가 어긋나므로 마운트 후에 읽습니다.
   *
   * `null`은 "아직 안 읽음"입니다. 그동안은 아무 세션도 고를 수 없습니다 — 기록을 모르는
   * 채로 고르게 두면 이미 낸 세션이 그냥 선택되어 중복 제출이 열립니다(#232).
   */
  const [submitted, setSubmitted] = useState<Set<number> | null>(null);

  useEffect(() => {
    /*
     * `react-hooks/set-state-in-effect`를 끕니다. 마운트 직후 한 번으로 끝나고, 룰이 권하는
     * `useSyncExternalStore`로 바꾸면 구독하지 않는 스토어를 억지로 만들게 됩니다.
     * `LiveResult`가 같은 기록을 같은 이유로 같은 모양으로 읽습니다.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubmitted(listSubmitted(eventCode));
  }, [eventCode]);

  /*
   * 고를 수 있는 세션입니다. CLOSED는 목록에 남지만 못 고르고, 이미 낸 세션은 고르는 대신
   * 결과 화면으로 가는 길이 됩니다.
   */
  const selectableSessions =
    submitted === null
      ? []
      : sessions.filter((session) => session.status === 'ACTIVE' && !submitted.has(session.id));

  /*
   * 고를 게 하나뿐이면 미리 골라둡니다. `useState` 초기값으로 두지 않는 이유는 그 값이
   * 서버에서도 계산되기 때문입니다. 기록을 읽기 전에는 이미 낸 세션까지 후보에 들어가서,
   * 세션이 하나뿐인 이벤트를 다시 열면 이미 낸 세션이 선택된 채로 폼이 뜹니다.
   */
  const selectedId =
    pickedId ?? (selectableSessions.length === 1 ? selectableSessions[0].id : null);

  const handleSelect = (sessionId: number) => {
    /*
     * 이미 남긴 세션은 다시 받지 않고 그 세션의 결과 화면으로 보냅니다(#232). 여기서 막지
     * 않으면 결과 화면에서 뒤로가기로 돌아왔을 때 같은 세션에 또 낼 수 있고, 서버가 중복을
     * 막지 않아서 그대로 등록됩니다(#92).
     *
     * `submitted=1`은 붙이지 않습니다. 방금 낸 사람에게만 띄우는 등록 안내라, 결과를 보러
     * 다시 들어온 사람에게 뜨면 방금 낸 것처럼 읽힙니다.
     */
    if (submitted?.has(sessionId) === true) {
      router.push(`/e/${eventCode}/live?sessionId=${sessionId}`);
      return;
    }

    setPickedId(sessionId);
  };

  const { mutate, isPending, error } = useMutation({
    // 제출 직전에 태깅합니다. 실패하거나 3초를 넘기면 tag가 null을 주고,
    // toSubmitPayload가 sentiment=UNKNOWN으로 떨어뜨립니다. 제출은 그대로 진행됩니다.
    mutationFn: async (sessionId: number) => {
      const trimmed = text.trim();
      const logits = await tag(trimmed);

      return submitFeedback(eventCode, { sessionId, ...toSubmitPayload(trimmed, logits) });
    },

    // 보낸 값을 그대로 돌려받습니다. 여기서 selectedId를 다시 읽으면
    // 응답을 기다리는 사이 선택이 바뀌었을 때 저장된 세션과 이동할 세션이 어긋납니다.
    onSuccess: (_data, sessionId) => {
      // 서버가 중복 제출을 막지 않아 프론트가 기록해야 합니다(#92).
      // 이 줄이 없으면 /live가 읽을 기록이 영영 안 생겨서 접근 제어가
      // 전부 차단으로 떨어집니다 — 소감을 내고 넘어가도 못 봅니다.
      markSubmitted(eventCode, sessionId);

      // `submitted=1`은 결과 화면이 "소감이 등록되었어요" 배너를 띄우는 신호입니다.
      // 도착한 화면이 한 번 읽고 주소에서 지웁니다(#111).
      router.push(`/e/${eventCode}/live?sessionId=${sessionId}&submitted=1`);
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
              disabled={session.status === 'CLOSED' || isPending || submitted === null}
              onClick={() => handleSelect(session.id)}
            >
              {/* 아이콘은 prop이 아니라 children입니다(`components/ui/README.md`). ✓에
                  `aria-hidden`이 붙어 있어 sr-only 문구가 없으면 스크린리더에는 일반 칩과
                  똑같이 읽힙니다. */}
              {submitted?.has(session.id) === true ? (
                <>
                  <CheckIcon />
                  <span className="sr-only">소감을 남긴 세션, </span>
                </>
              ) : null}
              {session.title}
            </Chip>
          ))}
        </div>
        {sessions.some((session) => session.status === 'CLOSED') ? (
          <p className="text-xs font-normal leading-4 text-text-tertiary">
            지금 소감을 받는 세션만 선택할 수 있어요
          </p>
        ) : null}
        {sessions.some((session) => submitted?.has(session.id) === true) ? (
          <p className="text-xs font-normal leading-4 text-text-tertiary">
            ✓ 표시된 세션을 누르면 그 세션의 결과를 볼 수 있어요
          </p>
        ) : null}
      </section>

      {/* 세션을 고르기 전에는 입력란부터 버튼까지 내보내지 않습니다. 어느 세션에 남기는지
          모르는 채로 소감을 다 쓰고 나서야 버튼이 안 눌리는 걸 알게 되는 순서였습니다.

          기록을 읽기 전(`submitted === null`)에도 `selectedId`가 null이라 같이 가려집니다.
          세션이 하나뿐인 이벤트에서는 자동 선택이 걸리면서 입력란이 한 박자 늦게 나타나는데,
          기록을 안 읽고 그리면 이미 낸 세션에도 입력란이 열리므로 이쪽이 맞습니다. */}
      {selectedId !== null && (
        <>
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
              onFocus={warmup}
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
            disabled={text.trim() === '' || isPending}
            onClick={() => mutate(selectedId)}
          >
            {isPending ? '보내는 중...' : '소감 남기기'}
          </Button>
        </>
      )}
    </>
  );
};

export { FeedbackForm };
