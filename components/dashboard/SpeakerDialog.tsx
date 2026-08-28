'use client';

import { useEffect, useId, useRef } from 'react';
import type { MouseEvent } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { DuplicateIcon, XIcon } from '@/components/ui/icons';
import { useCopyLink } from '@/hooks/useCopyLink';
import { useSessionReport, type SessionReportResetErrorCode } from '@/hooks/useSessionReport';
import formatEventDate from '@/lib/formatEventDate';
import type { ReportStatus, SessionView } from '@/lib/schemas/api';

/**
 * 강연자에게 건넬 링크와 그 세션의 리포트를 다루는 모달입니다. 주최자 대시보드에서만 엽니다.
 *
 * `ConfirmDialog`를 재사용하지 않았습니다. `<dialog>` + `showModal()`이라는 재료는 같지만
 * 그쪽은 되돌릴 수 없는 동작을 묻는 자리라 `role="alertdialog"`로 스크린리더가 하던 말을
 * 끊고 즉시 읽고, 실수로 닫히지 않게 배경 클릭을 막아뒀습니다. 이 창도 되돌릴 수 없는 버튼을
 * 하나 품고 있지만(리포트 초기화) 창을 여는 것도 닫는 것도 아무것도 실행하지 않아서, 하던 말을
 * 끊을 이유도 배경 클릭을 막을 이유도 없습니다(`<dialog>`의 기본 역할인 `dialog`, 배경 클릭으로
 * 닫힘).
 *
 * 포커스 가두기·ESC·배경 차단·딤은 그대로 브라우저가 처리하고, 뒤 배경 스크롤 잠금은
 * `globals.css`의 `body:has(dialog[open])`가 함께 겁니다.
 */

/**
 * 리포트 칸에 세우는 두 줄입니다. 주최자가 여기서 알아야 하는 것은 "강연자가 만들었는지"뿐이라,
 * 상태 이름을 그대로 보여주지 않고 그 한 가지로 옮겨 적습니다.
 */
interface ReportState {
  title: string;
  /** 비면 줄 자체가 빠집니다. */
  hint: string;
}

const REPORT_STATE: Record<ReportStatus, ReportState> = {
  GENERATING: {
    title: '강연자가 리포트를 만들고 있어요',
    hint: '다 만들어지면 강연자 화면에 나타나요',
  },
  GENERATED: {
    title: '강연자가 리포트를 만들었어요',
    hint: '초기화하면 강연자가 발표 자료부터 다시 붙여 만들어야 해요',
  },
  FAILED: {
    title: '리포트를 만들다가 실패했어요',
    hint: '강연자가 같은 자리에서 다시 시도할 수 있어요',
  },
};

const REPORT_STATE_NONE: ReportState = {
  title: '아직 리포트가 없어요',
  hint: '세션을 마감하면 강연자가 만들 수 있어요',
};

/** 조회가 끝나기 전입니다. 없다고 단정하면 리포트가 있는 세션에서 잠깐 틀린 말이 스칩니다. */
const REPORT_STATE_UNKNOWN: ReportState = { title: '리포트 상태를 확인하고 있어요', hint: '' };

/**
 * 초기화 실패 문구입니다. 사유마다 다음 행동이 달라 하나로 뭉치지 않습니다 — 로그인이 풀린
 * 것은 다시 로그인하면 되고, 이미 초기화된 리포트는 몇 번을 눌러도 같습니다
 * (`SessionReportCard`의 생성 실패 문구와 같은 방식).
 */
const RESET_ERROR_MESSAGE: Record<SessionReportResetErrorCode, string> = {
  REPORT_NOT_FOUND: '이미 초기화된 리포트예요',
  UNAUTHORIZED: '로그인이 풀렸어요. 다시 로그인한 뒤 시도해주세요',
  NOT_OWNER: '이 이벤트의 주최자만 초기화할 수 있어요',
  RESET_FAILED: '초기화하지 못했어요. 잠시 후 다시 시도해주세요',
};

interface SpeakerDialogProps {
  open: boolean;
  eventCode: string;
  /** 행사 당일 날짜(`YYYY-MM-DD`)입니다. 세션에는 시각이 없어 날짜만 답니다. */
  eventDate: string;
  session: SessionView;
  /** 이 화면에서 멈춘 세션인지입니다. 배지 문구를 대시보드와 맞추는 데만 씁니다. */
  isPaused: boolean;
  /** 강연자가 열 진입 주소입니다. 복사 버튼과 화면의 글자가 같은 값을 씁니다. */
  url: string;
  onClose: () => void;
}

const SpeakerDialog = ({
  open,
  eventCode,
  eventDate,
  session,
  isPaused,
  url,
  onClose,
}: SpeakerDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const { copy, isCopied, isFailed } = useCopyLink();
  const report = useSessionReport({
    eventCode,
    sessionId: session.id,
    sessionStatus: session.status,
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /*
   * 복사해도 창을 닫지 않습니다. 주소를 넘긴 뒤에도 리포트 상태를 보러 남는 자리라, 복사했다고
   * 닫히면 다시 열어야 합니다. 대신 성공을 토스트로 알릴 수 없어서(모달에 가립니다 —
   * `hooks/useCopyLink.ts`) 버튼 문구를 바꿉니다.
   */
  const handleCopyLink = async () => {
    await copy(url);
  };

  const handleReset = () => {
    report.reset();
  };

  const isActive = session.status === 'ACTIVE';

  /*
   * 대시보드 헤더의 배지와 같은 문구를 씁니다. 세션은 생성 시 `CLOSED`라 상태만으로는 "아직 열지
   * 않았다"와 "열었다가 멈췄다"가 갈리지 않아서, 그 판정을 쥔 대시보드가 `isPaused`를 같이
   * 넘깁니다(`SessionToggle`과 같은 이유).
   */
  const statusLabel = isActive ? '소감 받는 중' : isPaused ? '소감 멈춤' : '시작 전';

  const reportState = report.isUnknown
    ? REPORT_STATE_UNKNOWN
    : report.status === null
      ? REPORT_STATE_NONE
      : REPORT_STATE[report.status];

  /*
   * 성공하면 리포트가 사라져 버튼이 그대로 잠깁니다. 잠긴 버튼에 남는 이 문구가 결과 표시입니다.
   * 복사 쪽처럼 2초 뒤 되돌리지 않는 이유는, 초기화는 성공한 세션에서 다시 누를 일이 없어서
   * 원래 문구로 돌아갈 자리가 없기 때문입니다.
   */
  const resetLabel = report.isResetting
    ? '초기화하는 중'
    : report.isResetSuccess
      ? '초기화 완료'
      : '리포트 초기화';

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
      className="m-auto w-90 max-w-[calc(100%-2rem)] md:w-128 rounded-xl bg-background-default p-0 shadow-dialog backdrop:bg-overlay"
      onCancel={(event) => {
        // 브라우저가 먼저 닫으면 React는 아직 열려 있다고 알고 있어서 둘이 어긋납니다.
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
    >
      {/*
       * `QrCodeDialog`와 달리 `items-center`를 걸지 않습니다. 저쪽은 QR 이미지가 주인공이라
       * 가운데가 맞지만, 이 창은 제목·주소·상태가 줄줄이 서는 자리라 왼쪽에 붙어야 읽힙니다.
       */}
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-lg leading-7 font-medium text-text-primary">
                {session.title}
              </h2>
              <Badge tone={isActive ? 'positive' : 'neutral'}>{statusLabel}</Badge>
            </div>

            <p className="text-xs leading-4 font-normal text-text-tertiary">
              {formatEventDate(eventDate)}
            </p>
          </div>

          {/*
           * 닫기가 아이콘 하나뿐이라 이름을 따로 답니다. 아이콘 자체는 `aria-hidden`이어서
           * 이게 없으면 스크린리더에 이름 없는 버튼으로 읽힙니다.
           */}
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="-m-1 cursor-pointer rounded-lg p-1 text-text-tertiary transition-colors hover:bg-background-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm leading-5 font-medium text-text-primary">강연자 링크</p>
          <p className="text-xs leading-4 font-normal break-keep text-text-tertiary">
            로그인 없이 열리는 주소예요. 강연자에게만 보내주세요
          </p>

          <div className="flex items-center gap-2">
            {/*
             * 주소를 잘라내지 않습니다. 복사가 막힌 환경에서는 이 글자가 주소를 가져가는 유일한
             * 길이라(`hooks/useCopyLink.ts`), 줄이 늘더라도 다 보이는 편이 맞습니다.
             */}
            <p className="min-w-0 flex-1 rounded-lg border border-border-default bg-background-surface px-3 py-2 text-sm leading-5 font-normal break-all text-text-secondary">
              {url}
            </p>

            <Button variant="primary" size="sm" onClick={handleCopyLink}>
              <DuplicateIcon />
              {isCopied ? '복사 완료' : '복사'}
            </Button>
          </div>

          {/*
           * 복사가 막힌 상황이라 다시 눌러도 소용없습니다. 위 주소를 직접 가져가야 합니다.
           *
           * `break-keep`이 없으면 좁은 창에서 「복사해주세 / 요」처럼 낱말 중간이 끊깁니다.
           * CSS 기본값이 한글을 글자 단위로 끊기 때문입니다.
           */}
          {isFailed && (
            <Banner type="negative" className="w-full break-keep">
              복사하지 못했어요. 위 주소를 직접 복사해주세요
            </Banner>
          )}

          {/*
           * 버튼 문구가 바뀌는 것은 눈으로만 전달됩니다. 포커스가 그대로 머무는 버튼의 이름이
           * 바뀌는 걸 읽어주는 스크린리더도 있지만 보장되지 않아서 따로 알립니다. 빈 상태로도
           * 남겨두는 이유는 미리 존재하던 영역에 내용이 들어와야 읽히기 때문입니다
           * (`ToastViewport`와 같은 이유).
           */}
          <p role="status" className="sr-only">
            {isCopied ? '링크가 복사되었어요' : ''}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm leading-5 font-medium text-text-primary">AI 리포트</p>

          {/*
           * 점선 칸입니다. 만드는 쪽은 강연자고 주최자가 여기서 할 수 있는 일은 초기화뿐이라,
           * 채워진 카드로 그리면 이 창이 리포트를 다루는 자리처럼 읽힙니다.
           */}
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border-default px-4 py-6">
            <p className="text-sm leading-5 font-medium break-keep text-text-primary">
              {reportState.title}
            </p>

            {reportState.hint !== '' && (
              <p className="text-center text-xs leading-4 font-normal break-keep text-text-tertiary">
                {reportState.hint}
              </p>
            )}

            <Button
              variant="danger"
              size="sm"
              className="mt-2"
              disabled={report.isResetDisabled}
              onClick={handleReset}
            >
              {resetLabel}
            </Button>
          </div>

          {/* 위 복사 버튼과 같은 이유로 따로 알립니다. 두 메시지가 한 영역을 쓰면 서로를 덮습니다. */}
          <p role="status" className="sr-only">
            {report.isResetSuccess ? '리포트를 초기화했어요' : ''}
          </p>

          {report.resetErrorCode !== null && (
            <Banner type="negative" className="w-full break-keep">
              {RESET_ERROR_MESSAGE[report.resetErrorCode]}
            </Banner>
          )}
        </div>
      </div>
    </dialog>
  );
};

export { SpeakerDialog };
