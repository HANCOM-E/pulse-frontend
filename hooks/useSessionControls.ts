'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { showToast } from '@/hooks/useToast';
import { updateSession } from '@/lib/api/endpoints';
import type { SessionStatus } from '@/lib/schemas/api';

/**
 * 세션의 소감 수신을 켜고 끕니다. 세션은 생성 시 `CLOSED`라, 발표가 시작될 때 주최자가 열어야
 * 소감이 들어옵니다(2026-08-07 명세).
 *
 * 뒤집는 일과 "이 화면에서 멈춘 세션인가"를 한 훅에 둡니다. 둘은 혼자서는 의미가 없습니다 —
 * 멈춘 목록은 이 뮤테이션의 성공 처리에서만 갱신되고, 그 목록을 읽는 곳은 판정 하나뿐입니다.
 *
 * 세션 목록 조회는 여기 들어오지 않습니다. 화면이 그 배열을 칩 말고도 세 군데(메타 문구의
 * 세션 제목, 고른 세션 찾기, 로딩·에러 분기)에서 쓰기 때문에, 가져오면 "조작"이 아니라
 * "세션에 관한 전부"가 됩니다.
 *
 * 이벤트 종료와 달리 확인 다이얼로그를 두지 않습니다. `ACTIVE ↔ CLOSED`는 되돌릴 수 있어서
 * 잘못 눌러도 다시 누르면 그만입니다.
 */

/** 뒤집을 수 있는 상태입니다. `DELETED`는 여기로 오지 않습니다. */
type ToggleableStatus = Extract<SessionStatus, 'ACTIVE' | 'CLOSED'>;

interface SessionControls {
  /**
   * 이 화면에서 멈춘 세션인지 봅니다. 같은 `CLOSED`라도 "아직 안 열었다"와 "열었다가 멈췄다"는
   * 버튼이 권하는 다음 행동이 달라서, 문구를 가르는 데 씁니다.
   *
   * `SessionView`에 열린 적이 있는지 알려주는 필드가 없어서 화면이 직접 기억합니다. 새로고침하면
   * 잊고 다른 기기에서 멈춘 것도 모릅니다 — 정확히 하려면 서버에 흔적이 필요합니다(#143).
   */
  isPaused: (sessionId: number) => boolean;
  toggle: (sessionId: number, status: ToggleableStatus) => void;
  isPending: boolean;
  isError: boolean;
}

const useSessionControls = (eventCode: string): SessionControls => {
  const queryClient = useQueryClient();

  const [pausedSessionIds, setPausedSessionIds] = useState<ReadonlySet<number>>(new Set());

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ToggleableStatus }) =>
      updateSession(eventCode, id, { status }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', eventCode] });
      /* 다시 열면 지웁니다. 남겨두면 멈췄다 연 세션을 또 멈출 때가 아니라 처음 열 때부터 "다시"가 됩니다. */
      setPausedSessionIds((previous) => {
        const next = new Set(previous);
        if (session.status === 'ACTIVE') next.delete(session.id);
        else next.add(session.id);
        return next;
      });
      showToast(session.status === 'ACTIVE' ? '이제 소감을 받아요' : '소감 받기를 멈췄어요');
    },
  });

  return {
    isPaused: (sessionId) => pausedSessionIds.has(sessionId),
    toggle: (id, status) => toggleMutation.mutate({ id, status }),
    isPending: toggleMutation.isPending,
    isError: toggleMutation.isError,
  };
};

export { useSessionControls, type SessionControls };
