import { ApiError } from '@/lib/apiClient';
import { isClientError } from '@/lib/schemas/api';

/**
 * 다시 물어봐도 같은 답이 오는 실패인지 봅니다.
 *
 * 두 곳이 이 판정을 씁니다.
 *
 *   재시도  `QueryProvider`의 `retry` — 실패한 요청을 다시 보낼지
 *   폴링    각 훅의 `refetchInterval` — 주기적 갱신을 멈출지
 *
 * 둘이 같은 기준을 봐야 합니다. 재시도하지 않기로 한 실패는 폴링도 할 이유가 없고,
 * 어긋나면 "재시도는 포기했는데 폴링은 계속 도는" 상태가 됩니다.
 *
 * 원래 네 훅과 `QueryProvider`에 같은 코드가 다섯 벌 있었습니다(#299). 이 판정이
 * 폴링을 멈출지 정하는 자리라, 한 곳만 고치면 그 화면만 조용히 굳습니다 — 에러도
 * 안 나고 갱신만 멈춰서 찾기가 아주 어렵습니다.
 */

/**
 * `INVALID_RESPONSE`는 응답이 계약과 다른 경우입니다. 같은 요청에 같은 응답이 오므로
 * 다시 물어볼 이유가 없습니다.
 *
 * 4xx도 같습니다. 없는 이벤트를 다시 물어봐도 없고, 권한이 없으면 계속 없습니다.
 *
 * 5xx와 네트워크 실패는 **여기 안 들어갑니다.** 다음번에 성공할 수 있어서, 순간 장애
 * 한 번에 화면이 영영 굳으면 안 됩니다.
 */
const isPermanentFailure = (error: Error | null): boolean =>
  error instanceof ApiError && (error.code === 'INVALID_RESPONSE' || isClientError(error.code));

export { isPermanentFailure };
