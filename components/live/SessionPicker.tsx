'use client';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import type { SessionView } from '@/lib/schemas/api';

interface SessionPickerProps {
  sessions: SessionView[];
  /** 소감을 남긴 세션의 id입니다. 여기 없는 세션은 회색으로 눌리지 않게 둡니다. */
  submitted: Set<number>;
  onSelect: (sessionId: number) => void;
  onWrite: () => void;
}

/**
 * 어느 세션의 집계를 볼지 고르는 화면입니다.
 *
 * 제출 화면(`/e/[code]`)이 아직 세션을 알려주지 않아서, 이 화면이 공개 세션 목록
 * (`GET /events/{eventCode}/sessions`)으로 직접 선택지를 만듭니다. 나중에 제출 화면이
 * `?sessionId=`를 붙여 보내주면 이 단계는 자동으로 건너뜁니다.
 *
 * 소감을 남기지 않은 세션도 목록에 남깁니다. 걸러내면 1부만 낸 사람에게 칩이 하나만 보여서
 * 2·3부가 있다는 사실 자체가 가려집니다. 아무것도 안 낸 사람에게 제일 심해서, 그 경우에만
 * 쓰러 가는 버튼을 함께 띄웁니다. 회색 칩만 남으면 고장난 화면처럼 보이기도 합니다.
 *
 * 왜 회색인지는 페이지 제목 아래(`app/e/[code]/live/page.tsx`)에서 한 번만 안내합니다.
 *
 * `SessionView`에 `status`가 있지만(2026-08-07 명세부터 공개뷰에도 담깁니다) 여기서는 보지
 * 않습니다. 열람 가능 여부를 가르는 건 진행 상태가 아니라 소감을 남겼는지입니다. 끝난 세션도
 * 남겼으면 결과가 그대로 보여야 하고, 진행 중이어도 안 남겼으면 못 봅니다.
 *
 * 자동 선택도 하지 않습니다. `ACTIVE`인 세션을 알 수 있게 됐지만 그게 남긴 세션이라는 보장이
 * 없고, 칩을 다 보여주는 편이 "아직 안 남긴 순서가 있다"를 알려줍니다.
 */
const SessionPicker = ({ sessions, submitted, onSelect, onWrite }: SessionPickerProps) => {
  // `submitted.size`가 아니라 이 이벤트의 세션과 대조합니다. 기록에 남은 옛 이벤트의 id는 셈에서 빠집니다.
  const hasAnySubmitted = sessions.some((session) => submitted.has(session.id));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm text-text-secondary">어느 순서의 반응을 볼까요?</h2>

      {sessions.length === 0 ? (
        <p className="text-sm text-text-tertiary">아직 등록된 세션이 없어요</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2">
            {sessions.map((session) => (
              <li key={session.id}>
                {/* `cursor-pointer`는 `Chip`에 없어서 여기서 붙입니다. 공용 컴포넌트를 고치면
                    이 화면 밖 커서까지 바뀌어서 실시간 결과 화면 안에서만 처리했습니다. */}
                <Chip
                  className="cursor-pointer"
                  disabled={!submitted.has(session.id)}
                  onClick={() => onSelect(session.id)}
                >
                  {session.title}
                </Chip>
              </li>
            ))}
          </ul>

          {!hasAnySubmitted && (
            <Button
              variant="primary"
              size="lg"
              className="mt-1 w-full cursor-pointer"
              onClick={onWrite}
            >
              반응 남기러 가기
            </Button>
          )}
        </>
      )}
    </section>
  );
};

export { SessionPicker };
