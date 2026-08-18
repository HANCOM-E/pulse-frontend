import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { EventReportControls } from '@/hooks/useEventReport';

/**
 * AI 요약 리포트 카드입니다. 생성 전·생성 중·완료 세 상태를 한 자리에서 갈아입습니다.
 *
 * 카드 아래 한 줄이 상태에 따라 다른 일을 합니다. 생성 전에는 왜 눌러야 하는지 알리는 안내문이고,
 * 끝나면 요약 본문이 그 자리에 들어옵니다. 자리를 나누지 않는 이유는 안내문이 요약이 없을 때만
 * 필요한 문장이라서입니다.
 *
 * 생성이 끝났는데 본문이 비어 있는 경우를 따로 받습니다. 여기서 "생성하시면…"으로 되돌리면
 * 오른쪽 버튼은 이미 빠진 뒤라(`isGenerated`) 시키는 대로 할 수단이 없습니다. `GENERATING`
 * 문구로 묶지 않는 것도 같은 이유입니다 — 폴링이 `GENERATED`에서 멈춰서 기다려도 아무것도
 * 다시 오지 않습니다.
 */

/* 카드 모양이 대시보드의 다른 섹션과 같습니다. `components/ui/`에 카드 프리미티브가 아직 없습니다. */
const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';

interface ReportSectionProps {
  report: EventReportControls;
}

const ReportSection = ({ report }: ReportSectionProps) => {
  /*
   * 상태 배지입니다. 모바일에선 제목 옆, 데스크톱에선 오른쪽 조치 자리에 서는데 부모가 달라
   * CSS로는 옮길 수 없습니다. 두 자리에 같은 것을 두고 감싸는 span으로 하나씩 감추므로,
   * 본문은 여기서 한 번만 만듭니다.
   */
  const badge = report.isGenerating ? (
    <Badge tone="neutral">생성 중</Badge>
  ) : report.isGenerated ? (
    <Badge tone="positive">생성 완료</Badge>
  ) : null;

  return (
    <section
      className={`${CARD} flex-col items-start justify-between gap-4 bg-background-muted md:flex-row`}
    >
      <div className="flex w-full flex-col gap-1 md:w-auto">
        {/* 배지를 오른쪽 끝에 붙이려면 이 열이 폭을 다 써야 합니다(`w-full`). */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold leading-6 text-text-primary">AI 요약 리포트</h2>
          {badge && <span className="md:hidden">{badge}</span>}
        </div>

        {report.summaryText !== null ? (
          <p className="text-sm font-normal leading-5 text-text-secondary">{report.summaryText}</p>
        ) : (
          <p className="text-xs font-normal leading-4 text-text-tertiary">
            {report.isGenerating
              ? '요약을 만들고 있어요. 끝나면 여기에 올라와요'
              : report.isGenerated
                ? '요약 본문을 받지 못했어요. 잠시 후 다시 열어봐 주세요'
                : '생성하시면 읽어보고 공개할 수 있어요'}
          </p>
        )}
      </div>

      {/*
       * 오른쪽은 이 카드의 상태와 조치가 함께 서는 자리입니다. 상태 배지를 제목이 아니라
       * 여기 두는 이유는, 다 만들고 나면 버튼이 빠져서 이 자리가 비기 때문입니다.
       *
       * 모바일에서는 카드가 세로로 서면서 이 자리가 제목에서 멀어지므로, 배지만 제목 옆으로
       * 올립니다(`badge`). 그러면 생성 완료 상태의 모바일에서는 배지도 버튼도 없어
       * 이 자리가 통째로 비므로 아예 감춥니다 — 안 그러면 section의 `gap-4`만 남습니다.
       */}
      <div
        className={`flex w-full shrink-0 items-center gap-2 md:w-auto ${
          report.isGenerated ? 'hidden md:flex' : ''
        }`}
      >
        {badge && <span className="hidden md:contents">{badge}</span>}

        {/* 다 만든 리포트에는 다시 만들 길이 없습니다(재생성은 REPORT_ALREADY_EXISTS). */}
        {!report.isGenerated && (
          <Button
            className="flex-1 md:flex-none"
            variant="primary"
            disabled={report.isGenerateDisabled}
            onClick={report.generate}
          >
            요약 생성
          </Button>
        )}
      </div>
    </section>
  );
};

export { ReportSection };
