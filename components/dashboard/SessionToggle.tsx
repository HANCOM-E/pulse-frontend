'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { SessionStatus, SessionView } from '@/lib/schemas/api';

/**
 * 고른 세션의 소감 수신을 켜고 끕니다. 지금 상태를 알리는 배지와 그걸 뒤집는 버튼 한 쌍입니다.
 *
 * 화면에 두 벌이 그려집니다. 데스크톱은 헤더의 조치 버튼 아래, 모바일은 세션 칩 줄 아래인데
 * 부모가 달라 CSS로는 옮길 수 없습니다. 그래서 자리마다 하나씩 두고 `className`으로 감춥니다 —
 * 붙이고 떼는 쪽은 부르는 쪽이고, 이 파일은 문구와 분기만 압니다.
 *
 * 문구가 세 갈래인 이유는 세션이 생성 시 `CLOSED`이기 때문입니다(2026-08-07 명세). 상태만으로는
 * "아직 열지 않았다"와 "열었다가 멈췄다"를 가를 수 없는데 권하는 다음 행동이 달라서,
 * 이 화면에서 멈춘 적이 있는지를 `isPaused`로 받습니다.
 */

interface SessionToggleProps {
  session: SessionView;
  /** 이 화면에서 멈춘 세션인지입니다. 같은 `CLOSED`라도 「다시 받기」와 「소감 받기」로 갈립니다. */
  isPaused: boolean;
  isPending: boolean;
  /** 뒤집을 다음 상태를 넘깁니다. 어느 세션인지는 부르는 쪽이 이미 압니다. */
  onToggle: (status: Extract<SessionStatus, 'ACTIVE' | 'CLOSED'>) => void;
  /** 자리마다 배치가 달라서 `display`까지 밖에서 정합니다(`hidden md:flex` / `flex md:hidden`). */
  className?: string;
}

const SessionToggle = ({
  session,
  isPaused,
  isPending,
  onToggle,
  className = '',
}: SessionToggleProps) => {
  const isActive = session.status === 'ACTIVE';

  return (
    <div className={`items-center gap-2 ${className}`}>
      <Badge tone={isActive ? 'positive' : 'neutral'}>
        {isActive ? '소감 받는 중' : isPaused ? '소감 멈춤' : '시작 전'}
      </Badge>
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => onToggle(isActive ? 'CLOSED' : 'ACTIVE')}
      >
        {isActive ? '멈추기' : isPaused ? '다시 받기' : '소감 받기'}
      </Button>
    </div>
  );
};

export { SessionToggle };
