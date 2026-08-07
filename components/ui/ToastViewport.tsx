'use client';

import { Toast } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

/**
 * 토스트가 뜨는 자리입니다. 앱 루트에 한 번만 둡니다.
 *
 * 토스트가 없어도 이 껍데기는 DOM에 남습니다. 스크린리더는 미리 존재하던 영역에
 * 내용이 들어와야 읽는데, 뷰포트째로 나타났다 사라지면 읽히지 않습니다.
 *
 * `aria-live`를 여기 걸지 않습니다. `Toast`가 이미 `role="status"`라서
 * 라이브 영역이 중첩되면 두 번 읽힐 수 있습니다.
 */
const ToastViewport = () => {
  const current = useToast();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-5">
      {current ? (
        <Toast
          key={current.id}
          className={current.isLeaving ? 'animate-toast-out' : 'motion-safe:animate-toast-in'}
        >
          {current.message}
        </Toast>
      ) : null}
    </div>
  );
};

export default ToastViewport;
