'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useId, useRef } from 'react';
import type { MouseEvent } from 'react';

import { Button } from '@/components/ui/Button';

/**
 * 참가자 진입 주소를 QR로 띄우는 모달입니다. 강연장 화면에 띄워두면 참가자가 찍고 들어옵니다.
 *
 * `ConfirmDialog`를 재사용하지 않았습니다. `<dialog>` + `showModal()`이라는 재료는 같지만
 * 그쪽은 되돌릴 수 없는 동작을 묻는 자리라 `role="alertdialog"`로 스크린리더가 하던 말을
 * 끊고 즉시 읽고, 실수로 닫히지 않게 배경 클릭을 막아뒀습니다. 이건 보여주기만 하는 창이라
 * 둘 다 반대여야 맞습니다(`<dialog>`의 기본 역할인 `dialog`, 배경 클릭으로 닫힘).
 *
 * 포커스 가두기·ESC·배경 차단·딤은 그대로 브라우저가 처리하고, 뒤 배경 스크롤 잠금은
 * `globals.css`의 `body:has(dialog[open])`가 함께 겁니다.
 */

interface QrCodeDialogProps {
  open: boolean;
  /** QR에 담기는 참가자 진입 주소입니다. 글자로도 같이 보여줍니다. */
  url: string;
  onClose: () => void;
}

const QrCodeDialog = ({ open, url, onClose }: QrCodeDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /*
   * 배경 클릭 판정입니다. 딤은 별도 요소가 아니라 `<dialog>` 자신의 `::backdrop`이라, 배경을
   * 눌러도 이벤트 대상은 `<dialog>`가 됩니다. 내용을 안쪽 `<div>`로 한 겹 싸고 padding도 그쪽에
   * 준 이유가 이것입니다. 다이얼로그에 직접 padding을 주면 그 여백을 눌렀을 때도 대상이
   * `<dialog>`라서, 창 안을 눌렀는데 닫힙니다.
   */
  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto w-90 max-w-[calc(100%_-_2rem)] rounded-xl bg-background-default p-0 shadow-dialog backdrop:bg-overlay"
      onCancel={(event) => {
        // 브라우저가 먼저 닫으면 React는 아직 열려 있다고 알고 있어서 둘이 어긋납니다.
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className="flex flex-col items-center gap-4 p-6">
        <h2 id={titleId} className="text-center text-lg font-medium leading-7 text-text-primary">
          QR 코드
        </h2>

        {/*
         * `size` 대신 클래스로 크기를 줍니다. 이 SVG는 `viewBox`가 있어서 CSS로 늘려도 깨지지
         * 않고, 좁은 화면에서 창 너비를 넘지 않게 `max-w-full`이 같이 걸립니다.
         */}
        <QRCodeSVG value={url} title="참가자 진입 주소 QR 코드" className="h-48 w-48 max-w-full" />

        {/* 주소가 길면 줄바꿈 지점이 없어 창을 밀어냅니다. */}
        <p className="text-center text-sm font-normal leading-5 break-all text-text-secondary">
          {url}
        </p>

        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      </div>
    </dialog>
  );
};

export { QrCodeDialog };
