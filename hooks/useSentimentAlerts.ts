'use client';

import { useEffect, useRef, useState } from 'react';

import {
  isNegativeAlerting,
  isPositiveSurging,
  type TrendInput,
} from '@/components/dashboard/metrics';
import type { EventStatus } from '@/lib/schemas/api';

/**
 * 감정 급변 배너 두 개의 상태를 들고 있습니다(#253).
 *
 * 무엇이 알림감인지는 `metrics.ts`가 정합니다. 이 훅이 맡는 건 그 판정을 언제 다시 하고
 * 직전 상태를 어떻게 물려주는지, 즉 판정 규칙이 아니라 배선입니다.
 *
 * 주최자 대시보드에는 세 번째 배너(모더레이션 큐)가 더 있는데 여기서는 다루지 않습니다.
 * 큐 판정은 `toxic`·`status`를 봐야 하고 둘 다 공개 뷰에 없습니다.
 *
 * 지금은 강연자 화면만 씁니다. `DashboardView`에도 같은 배선이 인라인으로 들어 있어서 언젠가
 * 이쪽으로 모으는 게 맞지만, 판정 규칙 자체는 이미 `metrics.ts` 한 곳에 있으므로 갈라져 있는
 * 것은 상태 배선뿐입니다.
 */

/**
 * 급증 배너를 다시 판정하는 주기입니다.
 *
 * 둘 중 급증만 시간이 답을 바꿉니다. 소감이 들어오지 않아도 최근 창이 지나면 거짓이 되어야
 * 하는데, 새 소감이 없으면 스트림이 같은 배열을 돌려주고 화면은 다시 그려지지 않습니다.
 * 그러면 반응이 뚝 끊긴 상황 — 배너가 가장 내려가야 할 때 — 에 오히려 그대로 남습니다.
 */
const POSITIVE_SURGE_RECHECK_MS = 10_000;

interface UseSentimentAlertsParams {
  /** `LIVE`가 아니면 둘 다 끕니다. 끝난 이벤트에는 지금 대응할 일이 없습니다. */
  eventStatus: EventStatus | undefined;
  negativeRate: number;
  classified: number;
  /** 급증 판정 대상입니다. `createdAt`·`sentiment`만 봅니다. */
  feedbacks: TrendInput[];
  /**
   * 판정 모집단을 가리키는 값입니다. 바뀌면 직전 상태를 물려받지 않고 처음부터 판정합니다.
   * 세션을 오갈 때 다른 세션에서 켜둔 배너가 따라오는 것을 막습니다.
   */
  scope: number | null;
}

interface SentimentAlerts {
  isNegativeHeavy: boolean;
  isPositiveSurge: boolean;
}

const useSentimentAlerts = ({
  eventStatus,
  negativeRate,
  classified,
  feedbacks,
  scope,
}: UseSentimentAlertsParams): SentimentAlerts => {
  /* 켜지는 선과 꺼지는 선이 달라서 지금 떠 있는지를 알아야 다음 판정을 할 수 있습니다. */
  const [isNegativeHeavy, setIsNegativeHeavy] = useState(false);
  const [isPositiveSurge, setIsPositiveSurge] = useState(false);

  /** 지금 잡아둔 판정이 어느 모집단 것인지입니다. */
  const alertScopeRef = useRef(scope);

  useEffect(() => {
    const isScopeChanged = alertScopeRef.current !== scope;
    if (isScopeChanged) alertScopeRef.current = scope;

    if (eventStatus !== 'LIVE') {
      /*
       * `react-hooks/set-state-in-effect`를 끕니다. 룰이 막으려는 건 렌더가 꼬리를 무는
       * 상황인데, 여기서는 이벤트가 `LIVE`를 벗어나는 한 번뿐이고 그 뒤로는 조건이 계속
       * 거짓이라 다시 돌지 않습니다.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsNegativeHeavy(false);
      return;
    }

    setIsNegativeHeavy((wasAlerting) =>
      isNegativeAlerting({
        negativeRate,
        classified,
        wasAlerting: isScopeChanged ? false : wasAlerting,
      }),
    );
  }, [negativeRate, classified, eventStatus, scope]);

  useEffect(() => {
    if (eventStatus !== 'LIVE') {
      // 위 배너와 같은 이유입니다. `LIVE`를 벗어나는 한 번으로 끝납니다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPositiveSurge(false);
      return;
    }

    /* 목록이 바뀔 때 한 번 보고, 그 뒤로는 타이머가 같은 판정을 반복합니다. */
    const judge = () => setIsPositiveSurge(isPositiveSurging(feedbacks, Date.now()));

    judge();

    const timer = setInterval(judge, POSITIVE_SURGE_RECHECK_MS);
    return () => clearInterval(timer);
  }, [feedbacks, eventStatus]);

  return { isNegativeHeavy, isPositiveSurge };
};

export { useSentimentAlerts, type SentimentAlerts };
