'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/apiClient';
import { fetchSessionReport, generateSessionReport } from '@/lib/api/endpoints';
import type { ReportStatus, SessionStatus } from '@/lib/schemas/api';

/**
 * 세션 하나의 AI 리포트입니다. 조회(폴링 포함)와 생성을 함께 묶습니다.
 *
 * 소감 요약도 집계도 전부 BE가 만듭니다(pulse-backend#43). 프론트가 보태는 것은 발표 자료
 * 요약 하나뿐이고, 그건 `useDeckSummary`가 만들어 이 훅의 `generate`에 실려 나갑니다.
 *
 * 이벤트 리포트(`useEventReport`)와 같은 모양이지만 셋이 다릅니다.
 *
 * 1. 인증이 없습니다. 강연자에게 계정이 없어서 생성·조회가 둘 다 공개 경로입니다.
 * 2. 공개 전환(`isPublic`)이 없습니다. 세션 피드백 집계가 원래 공개입니다.
 * 3. 게이트가 이벤트 `ENDED`가 아니라 세션 `CLOSED`입니다.
 *
 * ── 한 번뿐이라는 점 ──
 * BE가 세션당 리포트를 하나만 허용합니다(`GENERATING`/`GENERATED`면 `REPORT_ALREADY_EXISTS`,
 * `FAILED`만 재시도). 그래서 자료 요약은 `generate`를 부르기 **전에** 준비돼 있어야 합니다.
 * 자료 없이 만들어버리면 나중에 덧붙일 방법이 계약에 없고, 되돌리는 길은 주최자의 리셋뿐입니다.
 */

/**
 * 리포트가 만들어지는 동안만 쓰는 간격입니다. `useEventReport`와 같은 값을 씁니다 — 버튼을 누른
 * 사람이 결과를 기다리며 보고 있는 화면이라는 사정이 같습니다. 끝나는 즉시 타이머를 멈춥니다.
 */
const REPORT_POLL_INTERVAL_MS = 1_500;

/** 화면이 안내 문구를 가르는 데 씁니다. 서버가 내려주는 코드와 같습니다. */
export type SessionReportErrorCode =
  /** 세션이 아직 `CLOSED`가 아닙니다. 주최자가 소감을 마감해야 합니다. */
  | 'SESSION_NOT_CLOSED'
  /** 누군가 이미 만들었습니다. 회수는 주최자만 할 수 있습니다. */
  | 'REPORT_ALREADY_EXISTS'
  /** 세션이 삭제됐거나 주소가 잘못됐습니다. */
  | 'SESSION_NOT_FOUND'
  /** 그 밖의 실패입니다. 다시 눌러볼 만합니다. */
  | 'GENERATE_FAILED';

const KNOWN_ERROR_CODES = new Set<string>([
  'SESSION_NOT_CLOSED',
  'REPORT_ALREADY_EXISTS',
  'SESSION_NOT_FOUND',
]);

const toErrorCode = (error: unknown): SessionReportErrorCode =>
  error instanceof ApiError && KNOWN_ERROR_CODES.has(error.code)
    ? (error.code as SessionReportErrorCode)
    : 'GENERATE_FAILED';

interface UseSessionReportParams {
  eventCode: string;
  sessionId: number;
  /** 세션 목록에서 온 값입니다. 첫 응답 전에는 `undefined`입니다. */
  sessionStatus: SessionStatus | undefined;
}

export interface SessionReportControls {
  /** `GENERATED`이고 본문이 실제로 있을 때만 채워집니다. */
  summaryText: string | null;
  /** 생성 때 실어 보낸 발표 자료 요약입니다. BE가 그대로 보존해 되돌려 줍니다. */
  materialSummary: string | null;
  /** 아직 만들지 않았으면 `null`입니다(BE에는 행이 없는 상태). */
  status: ReportStatus | null;
  /**
   * 리포트가 완성된 시각입니다. 생성 중·실패에는 `null`입니다.
   *
   * 화면에는 안 쓰고 PDF에만 싣습니다. 인쇄물은 나중에 열어 보는 사람이 있어서, 이 요약이
   * 언제까지의 소감을 본 것인지가 종이에 남아야 합니다.
   */
  generatedAt: string | null;
  /**
   * 요청을 보낸 순간부터 켜집니다. 202가 돌아오기를 기다리는 동안에도 버튼은 이미 눌렸으므로,
   * 서버 응답이 오기 전 빈 구간을 mutation의 대기 상태가 메웁니다.
   */
  isGenerating: boolean;
  isGenerated: boolean;
  /** 생성이 실패했습니다. BE가 같은 행을 재사용해 재시도를 받아줍니다. */
  isFailed: boolean;
  /**
   * 생성 버튼을 잠글지입니다. 세션이 `CLOSED`가 아니거나, 상태를 아직 모르거나, 이미 리포트가
   * 있으면 잠깁니다.
   *
   * 판정을 훅이 하는 이유는 눌러봐야 409만 받는 버튼을 열어두지 않기 위해서입니다. 특히 세션당
   * 한 번뿐이라, 잘못 눌린 한 번이 되돌릴 수 없는 결과를 만듭니다.
   */
  isGenerateDisabled: boolean;
  /** 발표 자료 요약을 실어 보냅니다. 자료가 없으면 `null`을 넘깁니다. */
  generate: (materialSummary: string | null) => void;
  errorCode: SessionReportErrorCode | null;
}

const useSessionReport = ({
  eventCode,
  sessionId,
  sessionStatus,
}: UseSessionReportParams): SessionReportControls => {
  const queryClient = useQueryClient();

  const reportQueryKey = ['sessionReport', eventCode, sessionId];

  /*
   * 리포트 행이 없는 상태는 404 `REPORT_NOT_FOUND`로 옵니다. 에러로 오지만 "아직 생성하지
   * 않았다"는 정상 상태라, 화면은 이걸 실패가 아니라 생성 전으로 읽습니다.
   * `QueryProvider`의 `retry`가 4xx를 이미 거르므로 없는 리포트를 두들기지도 않습니다.
   *
   * 생성이 비동기라 폴링이 필요합니다. `GENERATING` 동안에만 돌리고 나머지 상태에서는 멈춥니다.
   * 완료된 리포트를 계속 다시 받아봐야 같은 답이고, 여기서 멈추지 않으면 이 화면을 열어둔 내내
   * 1.5초마다 요청이 나갑니다.
   */
  const reportQuery = useQuery({
    queryKey: reportQueryKey,
    queryFn: () => fetchSessionReport(eventCode, sessionId),
    refetchInterval: ({ state }) =>
      state.data?.status === 'GENERATING' ? REPORT_POLL_INTERVAL_MS : false,
  });

  const generateMutation = useMutation({
    mutationFn: (materialSummary: string | null) =>
      generateSessionReport(eventCode, sessionId, { materialSummary }),
    /*
     * 202 응답이 이미 `GENERATING` 상태의 리포트입니다. 캐시에 바로 꽂아야 위 폴링이 그 자리에서
     * 시작합니다. `invalidateQueries`로도 되지만 방금 받은 답을 한 번 더 물어보게 됩니다.
     */
    onSuccess: (report) => {
      queryClient.setQueryData(reportQueryKey, report);
    },
  });

  const report = reportQuery.data ?? null;
  const isGenerating = generateMutation.isPending || report?.status === 'GENERATING';

  /*
   * 상태를 아직 모르는 구간입니다. 이때 버튼을 열어두면 이미 리포트가 있는 세션에서 눌려
   * `REPORT_ALREADY_EXISTS`만 받습니다.
   */
  const isUnknown = reportQuery.isPending || sessionStatus === undefined;

  /* `FAILED`는 BE가 같은 행을 재사용해 재시도를 받아줍니다. 나머지 상태에서만 잠급니다. */
  const isLockedByExisting = report !== null && report.status !== 'FAILED';

  return {
    summaryText: report?.status === 'GENERATED' ? report.summaryText : null,
    materialSummary: report?.materialSummary ?? null,
    status: report?.status ?? null,
    generatedAt: report?.generatedAt ?? null,
    isGenerating,
    isGenerated: report?.status === 'GENERATED',
    isFailed: report?.status === 'FAILED',
    isGenerateDisabled:
      sessionStatus !== 'CLOSED' || isUnknown || isGenerating || isLockedByExisting,
    generate: (materialSummary) => generateMutation.mutate(materialSummary),
    errorCode: generateMutation.isError ? toErrorCode(generateMutation.error) : null,
  };
};

export { useSessionReport };
