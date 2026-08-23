'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { fetchModerationQueue } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import { API_BASE_URL } from '@/lib/env';
import { feedbackListResponseSchema, isClientError, type Feedback } from '@/lib/schemas/api';

/**
 * 주최자 대시보드가 보는 소감 목록입니다. 갱신은 `GET /admin/feedbacks/stream`(SSE)이
 * 밀어줍니다(2026-08-21 명세).
 *
 * 참가자 화면의 `useFeedbackSnapshot`과 나란히 있지만 보는 엔드포인트가 다릅니다. 저쪽은
 * 서버가 집계해서 내려주는 공개 스냅샷이고, 이쪽은 `/admin/feedbacks`의 원본 목록입니다.
 * 대시보드가 원본을 받아야 하는 이유는 세 가지입니다.
 *
 * 1. 독성 플래그 개수 — 공개 스냅샷의 `FeedbackView`에는 `toxic`이 없습니다. 모더레이션
 *    신호를 공개 엔드포인트로 내보내지 않기로 한 계약이라 집계에도 안 실립니다.
 * 2. 시간대별 감정 추이 — 스냅샷은 "지금"만 알려줘서 시계열을 만들 수 없습니다. 원본의
 *    `createdAt`을 버킷으로 묶어야 나옵니다.
 * 3. 숨기기·삭제 — 액션 대상이 되려면 `id`와 `status`가 필요합니다.
 *
 * `includeHidden`을 켜서 받는 이유는 모더레이션 큐가 이미 숨긴 건도 보여줘야 하기
 * 때문입니다. 집계와 피드에서 빼는 일은 화면이 `status`로 거릅니다.
 *
 * CLAUDE.md의 "실시간(클라이언트): 폴링 → SSE 승급, 훅으로 격리" 원칙에 따라 갱신 방식을
 * 아는 코드는 이 파일에만 둡니다. 화면은 `EventSource`도 폴백 간격도 모릅니다.
 *
 * 스트림 3종 중 유일하게 인증이 붙습니다. 자격증명은 다른 요청과 같은 `accessToken` 쿠키인데,
 * `API_BASE_URL`이 `/api/proxy`라 동일 출처 요청이 되어서 브라우저가 알아서 싣습니다.
 * `EventSource`는 헤더를 못 달아서, 쿠키 인증이 아니었으면 아예 불가능했을 자리입니다.
 */

/** 서버가 스냅샷을 싣는 이벤트 이름입니다. 스트림 3종이 모두 이 이름을 씁니다(명세 고정값). */
const SNAPSHOT_EVENT = 'snapshot';

/**
 * 스트림이 죽었을 때 되살리는 폴링 간격입니다. SSE 전환 전에 쓰던 값 그대로입니다.
 *
 * 스트림이 정상인 동안에는 꺼져 있습니다. `refetchInterval`은 staleness를 보지 않아서
 * `staleTime: Infinity`와 함께 둬도 스위치처럼 동작합니다.
 */
const FALLBACK_INTERVAL_MS = 5_000;

/**
 * 연결한 뒤 첫 스냅샷을 이만큼 기다려보고, 안 오면 스트림이 죽은 것으로 봅니다.
 *
 * `onerror`로는 못 잡는 실패가 있어서 필요합니다. 압축 계층이 SSE를 막으면 응답이 200에
 * `text/event-stream`이라 브라우저는 정상 연결로 보고 `open`까지 띄우는데, 본문만 안 옵니다
 * (2026-08-21 실측, #261). 그때 관측할 수 있는 건 "아무 일도 안 일어난다"뿐이라 시간을 재는
 * 수밖에 없습니다.
 */
const STREAM_TIMEOUT_MS = 5_000;

/** 숨기기·삭제 뒤 목록을 다시 받을 때 쓰는 키 앞자리입니다. */
const DASHBOARD_FEED_KEY = 'dashboardFeed';

/**
 * 다시 물어봐도 같은 답이 오는 실패인지 봅니다. `QueryProvider`의 `retry`가 재시도를 거르는
 * 기준(4xx + `INVALID_RESPONSE`)과 같습니다. 재시도하지 않기로 한 실패는 폴백도 하지 않습니다.
 */
const isPermanentFailure = (error: Error | null): boolean =>
  error instanceof ApiError && (error.code === 'INVALID_RESPONSE' || isClientError(error.code));

/**
 * 스트림으로 들어온 한 건을 계약 스키마로 검사합니다.
 *
 * `EventSource`는 `apiClient`를 거치지 않아서 `endpoints.ts`의 응답 검증이 통째로 우회됩니다.
 * 여기서 다시 걸러주지 않으면 "계약과 다른 응답을 화면까지 흘리지 않는다"는 규칙이 실시간
 * 경로에서만 사라집니다. `JSON.parse`가 던지는 경우도 같이 받습니다.
 */
const parseQueue = (raw: string): Feedback[] | null => {
  try {
    const result = feedbackListResponseSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data.items : null;
  } catch {
    return null;
  }
};

interface UseDashboardFeedParams {
  eventCode: string;
  /** `null`이면 이벤트 전체입니다. 세션 필터의 "전체"가 이 값입니다. */
  sessionId: number | null;
}

interface UseDashboardFeedResult {
  feedbacks: Feedback[] | undefined;
  isPending: boolean;
  isError: boolean;
  /**
   * 스트림으로 데이터가 실제로 흐르고 있는지입니다. 화면은 이 값으로 "실시간" 안내를 그릴지
   * 정합니다.
   *
   * 폴링 시절의 `refreshIntervalMs`를 대신합니다. 밀어주는 방식에는 간격이라는 개념이 없어서
   * "N초마다"를 그릴 수 없고, 대신 붙었는지 끊겼는지가 사용자에게 의미 있는 정보가 됐습니다.
   *
   * "연결됐는지"가 아니라 "흐르는지"입니다. 둘은 다릅니다 — 압축 계층에 막힌 스트림은 연결까지는
   * 멀쩡히 되고 데이터만 안 옵니다(#261). 그래서 `open`이 아니라 첫 스냅샷에서 켭니다.
   */
  isLive: boolean;
}

const useDashboardFeed = ({
  eventCode,
  sessionId,
}: UseDashboardFeedParams): UseDashboardFeedResult => {
  /*
   * 인증 여부를 화면에서 받지 않고 여기서 직접 봅니다. "로그인이 없으면 붙지 않는다"는
   * 화면이 정할 일이 아니라 이 훅의 불변조건입니다. `['auth','me']` 캐시를 공유하므로 요청은
   * 늘지 않습니다 — 대시보드에는 `HostHeader`가 이미 같은 쿼리를 띄워둡니다.
   */
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [isLive, setIsLive] = useState(false);
  const [isStreamBroken, setIsStreamBroken] = useState(false);
  /* 스트림을 다시 열려고 두는 세대 번호입니다. 올라갈 때마다 아래 effect가 다시 돕니다. */
  const [reconnectToken, setReconnectToken] = useState(0);
  /*
   * 스트림이 죽은 시각입니다. 아래 재연결 effect가 "이 시각 이후에 성공한 폴백 조회가 있는가"를
   * 판정하는 기준점이라, 끊긴 사실만이 아니라 언제 끊겼는지를 남겨야 합니다.
   */
  const brokenSinceRef = useRef<number | null>(null);
  /*
   * 재연결을 한 차례로 묶어 두는 빗장입니다. 스냅샷을 한 건이라도 받으면 다시 열립니다.
   *
   * 없으면 무한히 깜빡입니다. 인증과 무관한 고장 — 압축 계층에 막힌 스트림 같은 것 — 에서는
   * 폴백 조회가 계속 성공하는데 스트림만 계속 죽어서, "열림 → 5초 뒤 워치독 → 폴백 성공 →
   * 다시 열림"이 영원히 돕니다.
   */
  const canRetryRef = useRef(true);

  const { data, isPending, isError, dataUpdatedAt } = useQuery({
    queryKey: [DASHBOARD_FEED_KEY, eventCode, sessionId],
    queryFn: () =>
      fetchModerationQueue({
        eventCode,
        sessionId: sessionId ?? undefined,
        includeHidden: true,
      }),
    /*
     * 로그인이 풀리면 요청 자체를 내보내지 않습니다. 아래 `isPermanentFailure`가 401을 받고
     * 폴백을 멈추긴 하지만 멈추기 전 한 번은 나가는데, `apiClient`의 401 인터셉터가 그 한 번으로
     * `/auth/refresh`까지 부릅니다. 방금 로그아웃한 사용자를 위해 재발급을 시도하다 다시 401을
     * 받고 로그아웃 처리가 한 번 더 도는 흐름이라, 요청을 아예 막는 편이 낫습니다.
     *
     * `isAuthenticated`는 `/auth/me` 응답 전에도 `false`라 진입 직후 한 박자 늦게 시작합니다.
     * 미들웨어가 비로그인 진입을 이미 막으므로 그 지연은 첫 왕복뿐이고, 한 번이라도 받아둔
     * 데이터가 있으면 `enabled`가 꺼져도 `isPending`으로 되돌아가지 않아 화면이 스켈레톤으로
     * 깜빡이지 않습니다.
     */
    enabled: isAuthenticated,
    /*
     * 갱신은 스트림이 맡으므로 주기적인 재요청 트리거를 끕니다. 이 쿼리에 남은 역할은 셋입니다 —
     * 스트림의 첫 스냅샷이 오기 전 화면을 채우는 것, 스트림이 죽었을 때의 폴백, 그리고
     * `useModerationActions`가 숨기기·삭제 뒤 이 키를 무효화할 때의 재조회입니다.
     * `invalidateQueries`는 staleness를 보지 않아서 `Infinity`와 함께 둬도 그 재조회는 돕니다.
     */
    staleTime: Infinity,
    /*
     * 5xx·끊김은 계속 돌립니다. 저쪽은 다음 번에 성공할 수 있는 실패라, 여기서 같이 멈추면
     * 순간 장애 한 번에 진행 중인 이벤트의 대시보드가 영영 멈춥니다. `refetchOnWindowFocus`도
     * 꺼져 있어서 탭을 다시 봐도 살아나지 않고, 남는 복구 수단이 새로고침뿐입니다.
     */
    refetchInterval: ({ state }) =>
      isStreamBroken && !isPermanentFailure(state.error) ? FALLBACK_INTERVAL_MS : false,
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    /*
     * `EventSource`는 Next도 React도 아닌 브라우저 API라 서버에는 없습니다. effect가 서버에서
     * 실행되지 않아서 SSR이 터지지 않는 것이고, 이 생성을 effect 밖으로 끌어내면 그때 깨집니다.
     *
     * `eventCode`는 명세상 필수입니다(소유권 검증 대상). 나머지 쿼리는 위 `queryFn`과 맞춰야
     * 스트림과 폴백이 같은 큐를 봅니다.
     */
    const query = new URLSearchParams({ eventCode, includeHidden: 'true' });
    if (sessionId !== null) query.set('sessionId', String(sessionId));

    /*
     * 동일 출처(`/api/proxy`)라 `withCredentials` 없이도 쿠키가 실립니다. 그래도 켜두는 건
     * `NEXT_PUBLIC_API_BASE_URL`을 백엔드 절대주소로 바꾸는 순간 필수가 되기 때문입니다.
     * 그때는 백엔드 CORS에 `Access-Control-Allow-Credentials`도 함께 필요합니다.
     */
    const source = new EventSource(`${API_BASE_URL}/admin/feedbacks/stream?${query.toString()}`, {
      withCredentials: true,
    });

    /* 끊긴 시각을 남깁니다. 이미 끊겨 있으면 처음 끊긴 시각을 유지합니다. */
    const markBroken = () => {
      brokenSinceRef.current ??= Date.now();
      setIsStreamBroken(true);
    };

    /*
     * 첫 스냅샷을 기다리는 타이머입니다. 연결할 때마다 새로 걸고 스냅샷이 오면 지웁니다.
     *
     * 스냅샷마다 다시 걸지 않는 게 중요합니다. 다시 걸면 소감이 한동안 안 들어오는 조용한
     * 구간을 고장으로 잘못 읽습니다. 서버가 밀어줄 게 없어서 조용한 것과 스트림이 죽어서
     * 조용한 것은 다르고, 구분점은 "연결 직후 1건"이라는 명세의 보장입니다.
     */
    let watchdog: ReturnType<typeof setTimeout>;
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        setIsLive(false);
        markBroken();
      }, STREAM_TIMEOUT_MS);
    };

    // 연결이 아예 안 뜨는 경우까지 덮으려고 여기서 한 번, 재연결마다 `open`에서 다시 겁니다.
    armWatchdog();
    source.addEventListener('open', armWatchdog);

    source.addEventListener(SNAPSHOT_EVENT, (message: MessageEvent<string>) => {
      const feedbacks = parseQueue(message.data);
      if (feedbacks === null) {
        markBroken();
        return;
      }

      clearTimeout(watchdog);
      brokenSinceRef.current = null;
      canRetryRef.current = true;
      setIsLive(true);
      setIsStreamBroken(false);
      queryClient.setQueryData([DASHBOARD_FEED_KEY, eventCode, sessionId], feedbacks);
    });

    /*
     * 끊겨서 다시 붙는 중(`CONNECTING`)이면 곧 돌아오므로 실패로 치지 않습니다. `CLOSED`는
     * 다릅니다 — 응답이 200이 아니거나 `text/event-stream`이 아니면 브라우저가 재연결을
     * 포기하고 여기로 옵니다. 스스로 살아나지 않으니 이때만 폴백을 켭니다.
     */
    source.onerror = () => {
      setIsLive(false);
      if (source.readyState === EventSource.CLOSED) markBroken();
    };

    return () => {
      clearTimeout(watchdog);
      source.close();
      setIsLive(false);
    };
  }, [eventCode, sessionId, isAuthenticated, queryClient, reconnectToken]);

  /*
   * 끊긴 스트림을 다시 엽니다. 방아쇠는 "끊긴 뒤에 성공한 폴백 조회"입니다.
   *
   * 재발급을 여기서 직접 하지 않는 이유입니다. 이 스트림은 인증이 붙어서 accessToken(1시간)이
   * 만료되면 `CLOSED`로 죽는데, `EventSource`는 상태 코드를 안 알려줘서 401인지 403인지 서버가
   * 재시작한 건지 구분할 수 없습니다. 반면 폴백 폴링은 `apiClient`를 타므로 401이면 그쪽
   * 인터셉터가 제 조건으로 재발급하고 재시도까지 끝냅니다. 그러니 "폴백이 성공했다"는 사실
   * 자체가 곧 "인증이 필요했다면 이미 되살아났다"는 신호입니다. 재발급 조건을 이 파일로
   * 복사해 오면 규칙이 두 군데로 갈라집니다.
   *
   * 이게 없으면 만료 한 번에 대시보드가 언마운트할 때까지 폴링으로 남습니다. 쿠키는 멀쩡하고
   * 화면도 갱신되니 눈치채기 어려운 종류의 퇴화입니다.
   */
  useEffect(() => {
    const brokenSince = brokenSinceRef.current;
    if (brokenSince === null || !canRetryRef.current) return;
    if (dataUpdatedAt <= brokenSince) return;

    brokenSinceRef.current = null;
    canRetryRef.current = false;
    setReconnectToken((token) => token + 1);
  }, [dataUpdatedAt]);

  return {
    feedbacks: data,
    isPending,
    isError,
    isLive,
  };
};

export { useDashboardFeed, DASHBOARD_FEED_KEY };
