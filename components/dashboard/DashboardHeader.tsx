'use client';

import type { ReactNode } from 'react';

import { EVENT_STATUS_BADGE, type VisibleEventStatus } from '@/components/events/eventStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { EventReportControls } from '@/hooks/useEventReport';
import type { PulseEvent } from '@/lib/schemas/api';

/**
 * 대시보드 맨 위 줄입니다. 이벤트 제목·상태·참가자 주소를 왼쪽에, 이 화면에서 할 수 있는
 * 조치를 오른쪽에 둡니다.
 *
 * 조치가 상태별로 갈리는 게 이 컴포넌트가 아는 전부입니다. 실제로 무엇을 하는지는 전부
 * 밖에서 받습니다 — QR 모달을 여는 것도, 종료 확인을 띄우는 것도 이 화면의 다른 조각과
 * 얽혀 있어서 헤더 혼자 정할 문제가 아닙니다.
 */

interface DashboardHeaderProps {
  /**
   * `DELETED`가 빠진 이벤트입니다. 상태 배지 표(`EVENT_STATUS_BADGE`)에 그 키가 없어서,
   * 부르는 쪽이 `isVisibleEvent`로 좁힌 값을 넘겨야 합니다.
   */
  event: PulseEvent & { status: VisibleEventStatus };
  /** 참가자가 들어오는 주소입니다. `window`를 읽어 만들기 때문에 밖에서 받습니다. */
  publicUrl: string;
  report: EventReportControls;
  /**
   * 데스크톱에서 조치 버튼 아래 서는 세션 토글입니다. 모바일에서는 세션 칩 줄이 같은 것을
   * 그리므로, 두 자리 중 어디에 무엇을 둘지는 부르는 쪽이 정합니다.
   */
  sessionToggle?: ReactNode;
  onOpenQr: () => void;
  onCopyLink: () => void;
  /** 확인 다이얼로그를 엽니다. 되돌릴 수 없는 전이라 버튼이 바로 쏘지 않습니다. */
  onEndEvent: () => void;
  isEndEventPending: boolean;
}

const DashboardHeader = ({
  event,
  publicUrl,
  report,
  sessionToggle,
  onOpenQr,
  onCopyLink,
  onEndEvent,
  isEndEventPending,
}: DashboardHeaderProps) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    {/* 제목과 상태는 붙어 있어야 해서 바깥 `gap-4`에서 빼고 따로 묶습니다. */}
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold leading-7 text-text-primary">{event.title}</h1>
        {/* 이벤트 목록과 같은 표를 씁니다. 따로 쓰면 #192처럼 한쪽만 한글화되는 일이 반복됩니다. */}
        <Badge tone={EVENT_STATUS_BADGE[event.status].tone}>
          {EVENT_STATUS_BADGE[event.status].label}
        </Badge>
      </div>
      {/* 복사되는 값과 같은 것을 보여줍니다. 다르면 눈으로 옮겨 적는 사람이 틀립니다. */}
      <p className="text-xs font-normal leading-4 break-all text-primary-darker">{publicUrl}</p>
    </div>

    {/*
     * QR·링크 복사·이벤트 종료는 `LIVE`에서만 내놓습니다.
     *
     * 종료는 서버가 허용하는 전이가 `DRAFT → LIVE`와 `LIVE → ENDED` 둘뿐이라, 그 밖에서
     * 누르면 INVALID_EVENT_STATE_TRANSITION만 받습니다. QR과 참가자 링크는 소감을 받는
     * 동안에만 쓸모가 있습니다 — 시작 전이거나 끝난 이벤트의 주소를 건네봐야 받는 쪽은
     * 제출이 막힌 화면을 봅니다. 눌러보고 실패하게 두는 대신 아예 내놓지 않습니다.
     *
     * 리포트 공개 전환만 `ENDED` 쪽에 남습니다. 주소는 제목 아래에 늘 떠 있습니다.
     */}
    <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
      <div className="flex items-center justify-between gap-2 md:justify-end">
        {event.status === 'ENDED' && (
          /*
           * 모바일에서는 이 묶음이 줄을 다 차지하고(`flex-1`) 버튼만 오른쪽 끝으로
           * 밀립니다(`ml-auto`). 배지가 함께 서는 생성 중·완료 상태에서는 배지가 왼쪽에
           * 남아 양끝 정렬이 됩니다. 데스크톱은 `md:flex-none`으로 내용 폭인 원래
           * 배치로 돌아가고, 그때는 밀어낼 여백이 없어 `ml-auto`도 함께 죽습니다.
           */
          <div className="flex flex-1 items-center gap-2 md:flex-none">
            {report.isGenerating && <Badge tone="neutral">생성 중</Badge>}
            {report.isGenerated && <Badge tone="positive">생성 완료</Badge>}

            {/* 다 만든 리포트에는 다시 만들 길이 없습니다(재생성은 REPORT_ALREADY_EXISTS). */}
            {!report.isGenerated && (
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto"
                disabled={event.status !== 'ENDED' || report.isUnknown || report.isGenerating}
                onClick={report.generate}
              >
                요약 생성
              </Button>
            )}
          </div>
        )}
        {event.status === 'LIVE' && (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 md:flex-none"
              onClick={onOpenQr}
            >
              QR
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 md:flex-none"
              onClick={onCopyLink}
            >
              링크 복사
            </Button>
          </>
        )}

        {/*
         * 다 만든 리포트에만 붙습니다. 만들기 전이나 만드는 중에는 뒤집을 공개 여부 자체가
         * 없습니다(`GENERATED`가 아니면 공개해도 게스트는 404를 봅니다).
         */}
        {report.isGenerated && (
          <Button
            variant="secondary"
            size="sm"
            disabled={report.isTogglePublicPending}
            onClick={report.togglePublic}
          >
            {report.isPublic ? '리포트 비공개' : '리포트 공개'}
          </Button>
        )}
        {event.status === 'LIVE' && (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 md:flex-none"
            aria-label="이벤트 종료"
            disabled={isEndEventPending}
            onClick={onEndEvent}
          >
            <span className="md:hidden">종료</span>
            <span className="hidden md:inline">이벤트 종료</span>
          </Button>
        )}
      </div>

      {sessionToggle}
    </div>
  </div>
);

export { DashboardHeader };
