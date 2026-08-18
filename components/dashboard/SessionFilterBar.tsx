import type { ReactNode } from 'react';

import { Chip } from '@/components/ui/Chip';
import type { SessionView } from '@/lib/schemas/api';

/**
 * 세션 칩 줄입니다. 고른 세션으로 아래 숫자와 목록을 모두 거릅니다.
 *
 * 열림 개수를 밖에서 받지 않고 여기서 셉니다. 목록과 숫자를 따로 받으면 폴링으로 세션이
 * 늘었을 때 둘이 어긋날 수 있습니다(`ModerationQueue`와 같은 이유).
 */

interface SessionFilterBarProps {
  sessions: SessionView[];
  /** `null`이 "전체"입니다. 시안의 기본 선택값입니다. */
  selectedSessionId: number | null;
  onSelectSession: (sessionId: number | null) => void;
  /** 모바일에서 칩 아래 줄에 서는 세션 토글입니다. 데스크톱은 헤더가 같은 것을 그립니다. */
  sessionToggle?: ReactNode;
}

const SessionFilterBar = ({
  sessions,
  selectedSessionId,
  onSelectSession,
  sessionToggle,
}: SessionFilterBarProps) => {
  const openSessionCount = sessions.filter((session) => session.status === 'ACTIVE').length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip selected={selectedSessionId === null} onClick={() => onSelectSession(null)}>
        전체
      </Chip>
      {sessions.map((session) => (
        <Chip
          key={session.id}
          selected={selectedSessionId === session.id}
          onClick={() => onSelectSession(session.id)}
        >
          {session.title}
        </Chip>
      ))}
      <span className="ml-auto text-xs font-normal leading-4 text-text-tertiary">
        총 {sessions.length}개 중 {openSessionCount}개 열림
      </span>
      {sessionToggle}
    </div>
  );
};

export { SessionFilterBar };
