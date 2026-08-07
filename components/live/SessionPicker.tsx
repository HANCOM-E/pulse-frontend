'use client';

import { Chip } from '@/components/ui/Chip';
import type { SessionView } from '@/lib/schemas/api';

interface SessionPickerProps {
  sessions: SessionView[];
  onSelect: (sessionId: number) => void;
}

/**
 * 어느 세션의 집계를 볼지 고르는 화면입니다.
 *
 * 제출 화면(`/e/[code]`)이 아직 세션을 알려주지 않아서, 이 화면이 공개 세션 목록
 * (`GET /events/{eventCode}/sessions`)으로 직접 선택지를 만듭니다. 나중에 제출 화면이
 * `?sessionId=`를 붙여 보내주면 이 단계는 자동으로 건너뜁니다.
 *
 * 공개 응답인 `SessionView`에는 `status`가 없어서(스키마에서 omit) "지금 진행 중인 세션"을
 * 프론트가 알아낼 방법이 없습니다. 그래서 자동 선택 대신 사람이 고르게 합니다.
 */
const SessionPicker = ({ sessions, onSelect }: SessionPickerProps) => {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm text-text-secondary">어느 순서의 반응을 볼까요?</h2>

      {sessions.length === 0 ? (
        <p className="text-sm text-text-tertiary">아직 등록된 세션이 없어요</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <Chip onClick={() => onSelect(session.id)}>{session.title}</Chip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export { SessionPicker };
