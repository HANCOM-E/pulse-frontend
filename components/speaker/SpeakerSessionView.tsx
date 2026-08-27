'use client';

import { useState } from 'react';

import { KeywordCard } from '@/components/dashboard/KeywordCard';
import { QrCodeDialog } from '@/components/dashboard/QrCodeDialog';
import { buildTrend, toRelativeTime } from '@/components/dashboard/metrics';
import { SentimentTrendCard } from '@/components/dashboard/SentimentTrendCard';
import { Donut } from '@/components/feedback/Donut';
import { FEED_SENTIMENT, FeedItem } from '@/components/feedback/FeedItem';
import { Thermometer } from '@/components/feedback/Thermometer';
import { SessionReportCard } from '@/components/speaker/SessionReportCard';
import { SpeakerPrintDocument } from '@/components/speaker/SpeakerPrintDocument';
import {
  summarizeBreakdown,
  toKeywordCounts,
  toTotalCount,
} from '@/components/speaker/speakerMetrics';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Stat } from '@/components/ui/Stat';
import { useFeedbackSnapshot } from '@/hooks/useFeedbackSnapshot';
import { useSentimentAlerts } from '@/hooks/useSentimentAlerts';
import { useSessionArchive } from '@/hooks/useSessionArchive';
import { useCopyLink } from '@/hooks/useCopyLink';
import { useSpeakerPrint } from '@/hooks/useSpeakerPrint';
import { useSessionReport } from '@/hooks/useSessionReport';
import { useSpeakerSessionMeta } from '@/hooks/useSpeakerSessionMeta';
import { showToast } from '@/hooks/useToast';

/**
 * 강연자가 자기 세션 반응만 보는 화면입니다.
 *
 * 주최자 대시보드(`DashboardView`)와 카드 구성은 닮았지만 데이터 출처가 다릅니다. 저쪽은
 * `/admin/feedbacks`의 소감 원본을 받아 직접 세고, 이쪽은 공개 스냅샷이 서버에서 집계해 보낸
 * 값을 그립니다. 강연자는 계정이 없어서 `/admin` 계열에 닿을 수 없습니다.
 *
 * 그래서 못 그리는 게 셋입니다.
 *
 * 1. 독성 플래그 — 공개 뷰에 `toxic`이 없습니다(모더레이션 신호를 공개 경로로 내보내지 않는
 *    계약). 상단 타일이 넷이 아니라 셋인 이유입니다.
 * 2. 숨기기·삭제 — 조치 API가 전부 주최자 전용이라 피드가 읽기 전용입니다.
 * 3. 소감 받기 ON/OFF — 세션 수정도 주최자 전용입니다. 상태는 배지로 보여주기만 합니다.
 *
 * 시간대별 추이만 스냅샷 한 장으로 안 나옵니다. 소감마다 `createdAt`이 있어야 하는데 스냅샷은
 * 최근 50건만 싣기 때문입니다. 대신 스트림이 밀어주는 스냅샷을 `useSessionArchive`가 계속
 * 쌓아서 이 화면을 켜둔 구간의 추이를 만듭니다.
 *
 * 이 화면은 URL만 알면 누구나 열 수 있습니다. `eventCode`·`sessionId`가 둘 다 참가자에게
 * 공개된 값이라 접근 제어가 아니라 화면 분리입니다. 다만 여기 그리는 값은 전부 이미 공개
 * 엔드포인트로 나가는 것이라, 이 화면 때문에 새로 새는 정보는 없습니다.
 */

const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';
const CARD_TITLE = 'text-xs font-normal leading-4 text-text-tertiary';
/**
 * 주소 옆에 서는 조치의 모양입니다. `Button`을 쓰지 않는 건 BASE에 `text-base
 * font-semibold`와 `px-5`, 보더가 박혀 있어서 12px 주소 옆에 두면 크기가 겉돌기
 * 때문입니다. className으로 덮는 건 Tailwind가 속성 순서가 아니라 스타일시트 순서로
 * 이겨서 믿을 수 없습니다. 밑줄 텍스트 버튼은 `Header`의 로그아웃과 같은 모양입니다.
 */
const LINK_ACTION = [
  'cursor-pointer underline underline-offset-2',
  'transition-colors hover:text-text-primary',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker',
].join(' ');
/**
 * 첫 스냅샷이 오기 전 자리표시자입니다.
 *
 * 실제 화면을 먼저 그리면 집계가 전부 0으로 찍히는데, 소감이 진짜 0건인 세션과 구분이 안
 * 됩니다(`DashboardSkeleton`과 같은 이유). 그쪽을 그대로 쓰지 않는 건 타일 수가 다르고
 * 스크린리더가 읽는 문구도 이 화면 것이어야 하기 때문입니다.
 */
const SpeakerSkeleton = () => (
  <div className="flex flex-col gap-3" role="status" aria-live="polite">
    <span className="sr-only">세션 반응을 불러오고 있어요</span>
    <div aria-hidden="true" className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((slot) => (
        <div key={slot} className="h-20 animate-pulse rounded-lg bg-background-muted" />
      ))}
    </div>
    <div aria-hidden="true" className="h-48 animate-pulse rounded-xl bg-background-muted" />
  </div>
);

interface SpeakerSessionViewProps {
  eventCode: string;
  /** 페이지가 숫자로 바꿔서 넘깁니다. 숫자가 아닌 값은 여기까지 오지 않습니다. */
  sessionId: number;
}

const SpeakerSessionView = ({ eventCode, sessionId }: SpeakerSessionViewProps) => {
  const {
    event,
    session,
    isPending: isMetaPending,
    isError: isMetaError,
  } = useSpeakerSessionMeta({ eventCode, sessionId });

  const {
    snapshot,
    isPending: isSnapshotPending,
    isError: isSnapshotError,
    isLive,
  } = useFeedbackSnapshot({ eventCode, sessionId });

  const archive = useSessionArchive({ eventCode, sessionId, recent: snapshot?.recentFeedbacks });

  const [isQrOpen, setIsQrOpen] = useState(false);

  const { copy: copyLink, isFailed: isCopyFailed } = useCopyLink();

  const print = useSpeakerPrint();

  /*
   * 세션 AI 리포트입니다. 요약은 BE가 만듭니다(pulse-backend#43) — 프론트가 보태는 건 발표
   * 자료 요약 하나뿐이고, 그건 아래 `SessionReportCard`가 맡습니다.
   *
   * 훅을 카드가 아니라 여기서 부르는 이유는 PDF 문서(`SpeakerPrintDocument`)도 같은 요약 본문을
   * 실어야 하기 때문입니다. 카드 안에서 부르고 값을 위로 올리면 부모가 자식 렌더 중에 상태를
   * 바꾸게 됩니다.
   */
  const report = useSessionReport({ eventCode, sessionId, sessionStatus: session?.status });

  /*
   * 집계는 서버가 보낸 전량 기준입니다. 누적 기록으로 다시 세지 않습니다 — 그러면 화면 숫자가
   * 서버 집계와 미묘하게 어긋나고, 같은 세션을 주최자와 나란히 봤을 때 값이 달라집니다.
   */
  const summary =
    snapshot === undefined
      ? null
      : summarizeBreakdown(snapshot.sentimentBreakdown, snapshot.unclassifiedCount);

  /*
   * 급변 배너입니다. 부정 비율은 서버 전량 집계를 그대로 보고, 급증만 누적 기록을 봅니다.
   * 훅은 early return 뒤로 내려갈 수 없어서 화면 분기보다 위에 둡니다.
   */
  const alerts = useSentimentAlerts({
    eventStatus: event?.status,
    negativeRate: summary?.negativeRate ?? 0,
    classified: summary?.classified ?? 0,
    feedbacks: archive,
    scope: sessionId,
  });

  if (isMetaError) {
    return <Banner type="negative">세션 정보를 불러올 수 없어요</Banner>;
  }

  if (isMetaPending || event === undefined) {
    return <SpeakerSkeleton />;
  }

  /*
   * 목록에 없는 id는 버립니다. 삭제된 세션을 가리키는 옛 링크나 손으로 고친 주소로
   * "0개 소감 · 긍정 0%"라는 멀쩡해 보이는 빈 집계가 나오는 걸 막습니다(`LiveResult`와 같은 판정).
   * 훅이 목록에서 찾아주므로 여기서는 결과만 봅니다.
   */
  if (session === null) {
    return (
      <EmptyState
        title="세션을 찾을 수 없어요"
        description="주소가 바뀌었거나 삭제된 세션이에요. 주최자에게 링크를 다시 받아주세요"
      />
    );
  }

  /*
   * 참가자 진입 주소입니다. 배포 도메인을 환경 변수로 들고 있지 않아서 지금 출처를 알 방법은
   * 브라우저가 열고 있는 주소뿐입니다(`DashboardView`와 같은 사정).
   *
   * 여기서 `window`를 읽어도 되는 이유는 서버 렌더가 이 줄까지 오지 않기 때문입니다. 쿼리를
   * 미리 채워두는 곳이 없어서 서버에서는 위 `isMetaPending`이 항상 참이고 스켈레톤에서
   * 끊깁니다. 컴포넌트 맨 위로 올리면 그 보호가 사라지므로 옮기지 마세요.
   *
   * 세션이 아니라 이벤트 주소입니다 — `EventEntryView`에 세션을 미리 고르는 파라미터가 없어서
   * 찍고 들어온 참가자가 목록에서 직접 고릅니다.
   */
  const publicUrl = `${window.location.origin}/e/${eventCode}`;

  /* 성공을 확인했을 때만 알립니다. 실패는 아래 배너가 받습니다(`DashboardView`와 같은 처리). */
  const handleCopyLink = async () => {
    if (await copyLink(publicUrl)) showToast('링크가 복사되었어요');
  };

  const totalCount =
    snapshot === undefined
      ? 0
      : toTotalCount(snapshot.sentimentBreakdown, snapshot.unclassifiedCount);

  /* 누적 기록으로 그립니다. 위 집계와 모집단이 다른 유일한 값이라 아래 각주로 알립니다. */
  const trend = buildTrend(archive);
  const keywords = snapshot === undefined ? [] : toKeywordCounts(snapshot.topKeywords);
  const recent = snapshot?.recentFeedbacks ?? [];

  /*
   * PDF를 막는 사유입니다. 문구까지 한 곳에서 정해야 버튼의 `disabled`와 안내가 갈리지
   * 않습니다.
   *
   * 요약이 없으면 막는 건 문서에서 「AI 요약」 칸이 통째로 빠지기 때문입니다
   * (`SpeakerPrintDocument`의 `summaryText !== null`). 화면에서 본 것과 다른 문서가 나가고,
   * 받아 본 사람은 요약을 만들다 실패한 건지 원래 없는 칸인지 알 수 없습니다.
   */
  const pdfBlockedReason =
    summary === null
      ? '소감 집계를 불러오고 있어요'
      : report.summaryText === null
        ? 'AI 리포트를 먼저 만들어 주세요'
        : null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs leading-4 font-normal text-text-tertiary">{event.title}</span>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl leading-8 font-semibold text-text-primary">{session.title}</h1>

            {/*
             * 상태를 보여주기만 합니다. 뒤집는 버튼은 달지 않습니다 — 세션 수정 API가
             * 주최자 전용이라 눌러도 403입니다.
             *
             * 제목 옆이 자리인 건 이게 조치가 아니라 이 세션의 속성이라서입니다. 조치 쪽에
             * 섞어두면 눌러야 하는 것으로 읽힙니다. 주최자 헤더도 이벤트 상태 배지를 같은
             * 자리에 답니다(`DashboardHeader`).
             */}
            <Badge tone={session.status === 'ACTIVE' ? 'positive' : 'outline'}>
              {session.status === 'ACTIVE' ? '소감 받는 중' : '소감 받기 멈춤'}
            </Badge>
          </div>

          {/*
           * 링크 복사와 QR은 둘 다 이 주소에 거는 조치라 주소 옆에 둡니다. 헤더 오른쪽에
           * 넷을 모아두면 무엇에 대한 버튼인지가 위치로 드러나지 않고, 한 줄에 500px 가까이
           * 서서 답답합니다.
           */}
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-normal leading-4 break-all text-primary-darker">
              {publicUrl}
            </p>

            <span className="flex shrink-0 items-center gap-2 text-xs leading-4 font-normal text-text-secondary">
              <button type="button" className={LINK_ACTION} onClick={handleCopyLink}>
                링크 복사
              </button>

              {/* 강연장 화면에 띄워두면 참가자가 찍고 들어옵니다. */}
              <button
                type="button"
                className={LINK_ACTION}
                aria-label="참가자 QR 코드"
                onClick={() => setIsQrOpen(true)}
              >
                QR
              </button>
            </span>
          </div>
        </div>

        {/*
         * 화면 전체를 내보내는 조치라 특정 카드에 붙일 수 없어 헤더에 혼자 남습니다.
         *
         * 못 쓸 때 숨기지 않고 비활성으로 둡니다. 사라지면 원래 없는 기능인지 지금만 못 쓰는
         * 건지 구분이 안 됩니다. 주최자 헤더가 숨기는 쪽인 건 거기서는 이벤트 상태에 따라
         * 조치 묶음이 통째로 갈리기 때문입니다(`DashboardHeader`).
         *
         * 사유는 감싼 div에 답니다. 비활성 버튼은 포인터 이벤트를 받지 않아 자신에게 붙은
         * `title`을 띄우지 못합니다.
         */}
        <div className="flex justify-end" title={pdfBlockedReason ?? undefined}>
          <Button
            variant="secondary"
            size="sm"
            onClick={print.start}
            disabled={print.isPrinting || pdfBlockedReason !== null}
          >
            PDF 내보내기
          </Button>
        </div>
      </header>

      {isSnapshotError && <Banner type="negative">지금은 소감을 불러올 수 없어요</Banner>}
      {isCopyFailed && (
        <Banner type="negative">링크를 복사하지 못했어요. QR을 눌러 주소를 확인해주세요</Banner>
      )}

      {isSnapshotPending || summary === null ? (
        <SpeakerSkeleton />
      ) : (
        <>
          {/*
           * 실패 배너와 떨어뜨려 통계 바로 위에 둡니다. 이건 고장이 아니라 지금 화면이 보여주는
           * 숫자에 대한 경고라, 그 숫자 옆에 있어야 읽힙니다.
           *
           * 주최자 대시보드의 세 배너 중 둘입니다. 모더레이션 큐 배너는 `toxic`·`status`를
           * 봐야 하는데 공개 뷰에 둘 다 없어서 여기서는 판정할 수 없습니다.
           */}
          {alerts.isNegativeHeavy && (
            <Banner type="warning">부정 반응이 {summary.negativeRate}%까지 올라갔어요</Banner>
          )}
          {alerts.isPositiveSurge && <Banner type="info">긍정 반응이 늘고 있어요</Banner>}

          {/* 「독성 플래그」 자리가 빠져 셋입니다. 이유는 파일 맨 위 주석에 적어뒀습니다. */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="총 소감" value={`${totalCount}`} />
            <Stat label="긍정 비율" value={`${summary.positiveRate}%`} tone="positive" />
            <Stat label="미분류" value={`${summary.unclassified}`} tone="muted" />
          </div>

          <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
            <section className={CARD}>
              <h2 className={CARD_TITLE}>감정 분포</h2>
              <Donut
                positive={summary.positive}
                neutral={summary.neutral}
                negative={summary.negative}
                className="hidden py-2 md:flex"
              />
              <Thermometer
                positive={summary.positive}
                neutral={summary.neutral}
                negative={summary.negative}
                className="py-2 md:hidden"
              />
            </section>

            <SentimentTrendCard
              trend={trend}
              positive={summary.positive}
              neutral={summary.neutral}
              negative={summary.negative}
              isLive={isLive}
            />
          </div>

          {/*
           * 추이만 모집단이 다르다는 사실을 화면에도 남깁니다. 위 타일과 도넛은 서버 전량
           * 집계인데 추이는 이 화면을 켜둔 동안 모인 소감으로 그려서, 알려주지 않으면 둘이
           * 어긋난 것으로 읽힙니다.
           */}
          <p className="text-xs leading-4 font-normal text-text-tertiary">
            시간대별 추이는 이 화면을 열어둔 동안 모인 소감으로 그려요. 나머지 숫자는 전체 집계예요.
          </p>

          {/*
           * AI 리포트입니다. 자동으로 부르지 않고 버튼을 눌러야 만들어집니다 — 호출마다 비용이
           * 나가고, 무엇보다 세션당 한 번뿐이라 강연자가 자료를 붙일지 정한 다음에 눌러야 합니다.
           */}
          <SessionReportCard
            eventCode={eventCode}
            sessionId={sessionId}
            sessionStatus={session.status}
            report={report}
          />

          <KeywordCard keywords={keywords} />

          <section className={CARD}>
            <h2 className={CARD_TITLE}>최근 소감</h2>

            {recent.length === 0 ? (
              <EmptyState
                className="h-80 justify-center"
                title="아직 들어온 소감이 없어요"
                description="참가자가 소감을 남기면 여기에 바로 올라와요"
              />
            ) : (
              <ul className="flex h-80 flex-col gap-2 overflow-y-auto">
                {/*
                 * 서버가 내려주는 최근 50건입니다. 숨기기 버튼은 달지 않습니다 —
                 * 조치 API가 주최자 전용입니다.
                 */}
                {recent.map((feedback) => (
                  <li key={feedback.id}>
                    <FeedItem
                      state="normal"
                      sentiment={FEED_SENTIMENT[feedback.sentiment]}
                      meta={toRelativeTime(feedback.createdAt)}
                      content={feedback.text}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {print.isPrinting && (
            <SpeakerPrintDocument
              event={event}
              session={session}
              summary={summary}
              totalCount={totalCount}
              trend={trend}
              keywords={keywords}
              feedbacks={archive}
              summaryText={report.summaryText}
              materialSummary={report.materialSummary}
              generatedAt={report.generatedAt}
            />
          )}
        </>
      )}

      <QrCodeDialog open={isQrOpen} url={publicUrl} onClose={() => setIsQrOpen(false)} />
    </div>
  );
};

export { SpeakerSessionView };
