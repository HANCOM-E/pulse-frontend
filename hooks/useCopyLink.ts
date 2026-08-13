'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 클립보드 복사와 그 결과입니다. 참가자 링크를 대시보드 헤더와 QR 모달 두 곳에서 복사합니다.
 *
 * 성공 표시는 이 훅이 하지 않고 호출부에 맡깁니다. 두 곳의 표시 방법이 다르기 때문입니다 —
 * 헤더는 토스트를 띄우지만, 모달은 토스트를 쓸 수 없습니다. `showModal()`로 연 `<dialog>`는
 * 브라우저 최상위 레이어에 그려져서 토스트가 그 뒤에 가리고 `z-index`로도 못 넘습니다
 * (`components/ui/README.md`). 그래서 모달은 버튼 문구를 바꿔서 알립니다.
 *
 * 대신 "복사가 됐는지"의 판정은 여기 한 곳에 둡니다. 실패를 삼키지 않는 게 핵심입니다 —
 * `navigator.clipboard`는 보안 컨텍스트(HTTPS·localhost)에서만 동작해서 강연장에서 사내 IP로
 * 열면 실제로 실패하는데, 잡지 않으면 복사가 안 됐는데 성공 표시가 뜹니다.
 */

/** 「복사됨」 표시가 원래 문구로 돌아가기까지의 시간입니다. */
const COPIED_RESET_MS = 2_000;

interface UseCopyLinkResult {
  /** 복사를 시도하고 성공 여부를 돌려줍니다. 던지지 않습니다. */
  copy: (text: string) => Promise<boolean>;
  /** 방금 복사에 성공했는지. 잠시 뒤 저절로 꺼집니다. */
  isCopied: boolean;
  /** 마지막 시도가 실패했는지. 다음 성공까지 켜져 있습니다. */
  isFailed: boolean;
}

const useCopyLink = (): UseCopyLinkResult => {
  const [isCopied, setIsCopied] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 복사 직후 화면을 벗어나면 타이머가 남아 사라진 컴포넌트의 상태를 건드립니다.
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setIsFailed(true);
      return false;
    }

    setIsFailed(false);
    setIsCopied(true);
    // 연타하면 타이머를 다시 겁니다. 안 지우면 먼저 건 쪽이 표시를 일찍 끕니다.
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsCopied(false), COPIED_RESET_MS);

    return true;
  };

  return { copy, isCopied, isFailed };
};

export { useCopyLink };
