'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useDeckSummary, type DeckSummaryErrorCode } from '@/hooks/useDeckSummary';
import type { SessionReportControls, SessionReportErrorCode } from '@/hooks/useSessionReport';
import type { SessionStatus } from '@/lib/schemas/api';

/**
 * 강연자가 자기 세션 리포트를 만들고 읽는 카드입니다.
 *
 * 순서가 강제됩니다 — 발표 자료를 먼저 붙이고 그다음 리포트를 만듭니다. 뒤집을 수 없는 이유는
 * BE가 세션당 리포트를 하나만 허용하기 때문입니다. 자료 없이 만들면 그 리포트가 그대로 잠기고,
 * 나중에 자료만 덧붙이는 경로가 계약에 없습니다(pulse-backend#43). 되돌리려면 주최자가 리포트를
 * 초기화해야 하는데 그 버튼은 이 화면에 없습니다.
 *
 * 그래서 자료 없이 만들려고 하면 한 번 더 확인을 받습니다. 되돌릴 수 없는 조치를 실수로 한 번
 * 눌러 끝내지 않게 하는 유일한 방어입니다.
 *
 * 자료 요약은 읽기 전용입니다(2026-08-27 결정). 마음에 안 들면 파일을 다시 고르면 됩니다.
 */

const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';
const CARD_TITLE = 'text-xs font-normal leading-4 text-text-tertiary';
const HINT = 'text-sm font-normal leading-5 text-text-tertiary';

/** 자료 요약과 리포트 본문이 같은 모양입니다. 둘 다 모델이 쓴 문단이라 줄바꿈을 살립니다. */
const PROSE = 'text-sm leading-6 font-normal whitespace-pre-line text-text-secondary';

/**
 * 고를 수 있는 확장자입니다. 여기 값과 `extractDeckText`가 아는 형식이 같아야 합니다 — 여기만
 * 넓히면 고를 수는 있는데 열지 못하는 파일이 생깁니다.
 */
const ACCEPT = '.pdf,.pptx';

/**
 * 자료 첨부 실패 문구입니다. 사유마다 다음 행동이 달라서 하나로 뭉치지 않습니다 — 형식이
 * 틀렸으면 다른 파일을 고르면 되고, 텍스트가 없으면 같은 파일로는 몇 번을 해도 같습니다.
 */
const DECK_ERROR_MESSAGE: Record<DeckSummaryErrorCode, string> = {
  UNSUPPORTED_FILE_TYPE: 'PDF나 PPTX 파일만 읽을 수 있어요',
  FILE_TOO_LARGE: '파일이 너무 커요. 20MB 이하로 올려주세요',
  NO_TEXT_LAYER: '자료에서 글자를 찾지 못했어요. 이미지로 만든 자료는 읽을 수 없어요',
  EXTRACT_FAILED: '자료를 여는 데 실패했어요. 파일이 손상됐거나 암호가 걸려 있을 수 있어요',
  SUMMARY_NOT_CONFIGURED: '요약 기능이 아직 설정되지 않았어요',
  REPORT_ALREADY_EXISTS: '이 세션의 리포트가 이미 있어요',
  SUMMARY_FAILED: '자료를 요약하지 못했어요. 잠시 후 다시 시도해 주세요',
};

const REPORT_ERROR_MESSAGE: Record<SessionReportErrorCode, string> = {
  SESSION_NOT_CLOSED: '소감을 마감한 뒤에 리포트를 만들 수 있어요',
  REPORT_ALREADY_EXISTS:
    '이미 만들어진 리포트가 있어요. 다시 만들려면 주최자에게 초기화를 요청해 주세요',
  SESSION_NOT_FOUND: '세션을 찾을 수 없어요',
  GENERATE_FAILED: '리포트를 만들지 못했어요. 잠시 후 다시 시도해 주세요',
};

interface SessionReportCardProps {
  eventCode: string;
  sessionId: number;
  sessionStatus: SessionStatus | undefined;
  /**
   * 리포트 훅을 이 카드가 아니라 화면(`SpeakerSessionView`)이 부릅니다.
   *
   * 요약 본문을 PDF 문서도 실어야 하는데, 여기서 훅을 부르고 값을 위로 올리면 부모가 자식의
   * 렌더 중에 상태를 바꾸게 됩니다. 저쪽에서 한 번 부르고 내려보내면 그 문제가 없고, 화면과
   * PDF가 같은 값을 본다는 것도 코드에서 바로 보입니다.
   */
  report: SessionReportControls;
}

const SessionReportCard = ({
  eventCode,
  sessionId,
  sessionStatus,
  report,
}: SessionReportCardProps) => {
  const deck = useDeckSummary({
    eventCode,
    sessionId,
    isReportGenerated: report.isGenerated,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isConfirmingWithoutDeck, setIsConfirmingWithoutDeck] = useState(false);

  /*
   * 리포트가 이미 있으면 자료를 더 붙일 수 없습니다. 만들어도 실어 보낼 곳이 없고, Route
   * Handler도 같은 이유로 모델을 부르지 않습니다.
   *
   * 세션 상태는 보지 않습니다. 리포트 생성은 `CLOSED`여야 하지만 자료는 그 전에 미리 붙여둘 수
   * 있어야 합니다 — 안 그러면 세션이 닫힌 뒤 좁은 시간에 자료 첨부와 리포트 생성을 몰아서
   * 해야 합니다.
   */
  const isDeckLocked = deck.isPending || (report.status !== null && !report.isFailed);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    /*
     * 같은 파일을 두 번 고르면 값이 그대로라 `change`가 아예 안 뜹니다. 비워두지 않으면
     * "다시 올리기"가 조용히 안 먹습니다.
     */
    event.target.value = '';

    if (file) deck.selectFile(file);
  };

  const handleGenerate = () => {
    /* 자료가 있으면 확인을 묻지 않습니다. 되돌릴 수 없다는 경고는 자료 없이 만들 때만 필요합니다. */
    if (deck.text !== null) {
      report.generate(deck.text);
      return;
    }

    if (!isConfirmingWithoutDeck) {
      setIsConfirmingWithoutDeck(true);
      return;
    }

    setIsConfirmingWithoutDeck(false);
    report.generate(null);
  };

  /* 확정된 리포트는 서버가 보존한 값을, 그 전에는 방금 만든 값을 보여줍니다. */
  const shownMaterialSummary = report.materialSummary ?? deck.text;

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={CARD_TITLE}>AI 리포트</h2>

        <div className="flex items-center gap-2">
          {isConfirmingWithoutDeck && (
            <Button variant="secondary" size="sm" onClick={() => setIsConfirmingWithoutDeck(false)}>
              취소
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerate}
            disabled={report.isGenerateDisabled}
          >
            {report.isGenerating
              ? '만드는 중…'
              : isConfirmingWithoutDeck
                ? '자료 없이 만들기'
                : report.isFailed
                  ? '다시 만들기'
                  : '리포트 만들기'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePickFile} disabled={isDeckLocked}>
            {deck.isPending ? '읽는 중…' : deck.text === null ? '자료 첨부' : '다른 자료 고르기'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {sessionStatus === 'ACTIVE' && (
        /* 자료는 지금도 붙일 수 있다는 걸 같이 알립니다. 안 그러면 카드 전체가 잠긴 줄로 읽힙니다. */
        <p className={HINT}>
          소감을 받는 동안에는 리포트를 만들 수 없어요. 발표 자료는 미리 붙여둘 수 있고, 주최자가 이
          세션을 마감하면 바로 만들 수 있어요
        </p>
      )}

      {isConfirmingWithoutDeck && (
        <p className="text-sm leading-5 font-normal text-warning-darker">
          발표 자료 없이 만들면 나중에 자료를 덧붙일 수 없어요. 세션마다 리포트는 한 번만 만들 수
          있어요
        </p>
      )}

      {/* ── 발표 자료 ── */}
      {shownMaterialSummary && (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          {
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={CARD_TITLE}>발표 자료 요약</span>
            </div>
          }

          {deck.errorCode !== null && <p className={HINT}>{DECK_ERROR_MESSAGE[deck.errorCode]}</p>}

          <>
            {deck.fileName !== null && report.materialSummary === null && (
              <p className="text-xs leading-4 font-normal text-text-tertiary">{deck.fileName}</p>
            )}

            {/* 읽기 전용입니다. 고치려면 파일을 다시 고릅니다. */}
            <p className={PROSE}>{shownMaterialSummary}</p>
          </>
        </div>
      )}

      {/* ── 리포트 본문 ── */}
      <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
        <span className={CARD_TITLE}>리포트</span>

        {report.errorCode !== null && (
          <p className={HINT}>{REPORT_ERROR_MESSAGE[report.errorCode]}</p>
        )}

        {report.isGenerating && (
          <p className={HINT} role="status" aria-live="polite">
            소감을 모아 리포트를 만들고 있어요
          </p>
        )}

        {report.isFailed && report.errorCode === null && (
          <p className={HINT}>리포트를 만들지 못했어요. 다시 시도해 주세요</p>
        )}

        {report.summaryText === null ? (
          !report.isGenerating &&
          !report.isFailed && (
            <p className={HINT}>세션이 끝나면 소감과 발표 자료를 묶어 정리해 드려요</p>
          )
        ) : (
          /* 모델이 문단을 나눠 오는 경우가 있어 줄바꿈을 살립니다(`ReportSection`과 같은 처리). */
          <p className={PROSE}>{report.summaryText}</p>
        )}
      </div>
    </section>
  );
};

export { SessionReportCard };
