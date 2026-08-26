import {
  buildTrend,
  countKeywords,
  summarizeSentiments,
  type KeywordCount,
  type SentimentSummary,
  type TrendPoint,
} from '@/components/dashboard/metrics';
import type { Feedback, SessionView } from '@/lib/schemas/api';

/**
 * PDF 한 장에 들어갈 숫자를 미리 뽑아둡니다(#268).
 *
 * 화면에서 떼어낸 이유는 `metrics.ts`와 같습니다 — 인쇄용 DOM은 눈으로 검산할 수 없는 데다
 * (버튼을 눌러야 나타나고, 인쇄창이 닫히면 사라집니다) `vitest`가 `environment: 'node'`라
 * 순수 함수로 있어야 테스트가 붙습니다.
 *
 * 세는 규칙은 대시보드가 하던 그대로입니다. 페이지마다 다시 조합하지 않고 여기 한 번만
 * 적어두는 게 이 파일의 존재 이유입니다 — 세션이 다섯이면 같은 규칙을 여섯 번 지켜야 하고,
 * 그중 한 장만 틀려도 화면과는 맞는 PDF가 나옵니다.
 */

/** "전체" 페이지의 제목입니다. 세션 칩 줄의 첫 칩과 같은 말을 씁니다. */
const ALL_SESSIONS_LABEL = '전체';

interface PrintPage {
  /** 세션 페이지면 세션 id, "전체"면 `null`입니다. 칩의 선택값과 같은 규칙입니다. */
  sessionId: number | null;
  /** 칩에 적힌 말 그대로입니다. */
  title: string;
  /** 스탯 「총 소감」입니다. 아래 `toxicCount`와 모집단이 다릅니다. */
  visibleCount: number;
  summary: SentimentSummary;
  /**
   * 스탯 「독성 플래그」입니다. 숨긴 건까지 셉니다.
   *
   * 여기만 모집단이 다릅니다. 독성 소감은 제출 시점에 이미 HIDDEN으로 저장돼서 `visible`에는
   * 한 건도 남지 않습니다. 감정 집계가 아니라 모더레이션 지표라 숨겼어도 몇 건 들어왔는지는
   * 보여야 합니다. `visible` 기준으로 되돌리면 전 페이지가 0으로 나갑니다.
   */
  toxicCount: number;
  trend: TrendPoint[];
  keywords: KeywordCount[];
}

const buildPage = (sessionId: number | null, title: string, feedbacks: Feedback[]): PrintPage => {
  /* 집계 모집단은 화면과 같이 VISIBLE만입니다(독성 건수만 위 주석대로 예외). */
  const visible = feedbacks.filter((feedback) => feedback.status === 'VISIBLE');

  return {
    sessionId,
    title,
    visibleCount: visible.length,
    summary: summarizeSentiments(visible),
    toxicCount: feedbacks.filter((feedback) => feedback.toxic).length,
    trend: buildTrend(visible),
    keywords: countKeywords(visible),
  };
};

/**
 * 칩 순서대로 페이지를 만듭니다 — "전체" 한 장, 그다음 세션마다 한 장씩입니다.
 * 마지막 요약 리포트 장은 여기서 만들지 않습니다. 소감에서 뽑는 숫자가 없어서입니다.
 *
 * 소감이 한 건도 없는 세션도 자기 장을 받습니다. 건너뛰면 PDF의 장 수가 화면의 칩 수와
 * 달라져서, 받아 본 사람이 어느 세션이 빠졌는지 세어봐야 합니다. 빈 장은 그 자체로
 * "이 세션에는 소감이 없었다"는 결과입니다.
 *
 * 소감은 세션별로 나눠 받지 않고 전량 한 벌을 받아 여기서 쪼갭니다. 세션마다 요청하면
 * 다섯 세션에 요청 여섯 번인데, 위 집계 셋이 전부 `Feedback[]` 하나만 받는 순수 함수라
 * 나눌 이유가 없습니다.
 */
const buildPrintPages = (feedbacks: Feedback[], sessions: SessionView[]): PrintPage[] => [
  buildPage(null, ALL_SESSIONS_LABEL, feedbacks),
  ...sessions.map((session) =>
    buildPage(
      session.id,
      session.title,
      feedbacks.filter((feedback) => feedback.sessionId === session.id),
    ),
  ),
];

export { buildPrintPages, type PrintPage };
