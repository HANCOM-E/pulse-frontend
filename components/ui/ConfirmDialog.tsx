'use client';

import { useEffect, useId, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';

interface ConfirmDialogProps extends Omit<
  ComponentProps<'dialog'>,
  'children' | 'open' | 'role' | 'aria-labelledby' | 'aria-describedby' | 'onCancel' | 'onClose'
> {
  open: boolean;
  title: string;
  description: string;
  actions: ReactNode;
  onClose: () => void;
}

const BASE = [
  'm-auto w-90 max-w-[calc(100%_-_2rem)]',
  'open:flex flex-col items-center gap-4',
  'rounded-xl bg-background-default p-6',
  'shadow-dialog',
  'backdrop:bg-overlay',
].join(' ');

const ConfirmDialog = ({
  open,
  title,
  description,
  actions,
  onClose,
  className = '',
  ...props
}: ConfirmDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${BASE} ${className}`}
      {...props}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId} className="text-center text-lg font-medium leading-7 text-text-primary">
        {title}
      </h2>

      <p
        id={descriptionId}
        className="text-center text-sm font-normal leading-5 text-text-secondary"
      >
        {description}
      </p>

      <div className="flex gap-2">{actions}</div>
    </dialog>
  );
};

export { ConfirmDialog };
