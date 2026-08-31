import { describe, expect, it } from 'vitest';

import { isPermanentFailure } from '@/lib/api/retryPolicy';
import { ApiError } from '@/lib/apiClient';

/**
 * 이 판정이 폴링을 멈출지 정합니다. 잘못 판정하면 화면이 조용히 굳습니다 — 에러도 안 나고
 * 갱신만 멈춰서, 사용자는 낡은 값을 최신인 줄 알고 봅니다.
 */

describe('isPermanentFailure', () => {
  /*
   * 계약과 다른 응답입니다. 같은 요청에 같은 응답이 오므로 다시 물어볼 이유가 없습니다.
   */
  it('INVALID_RESPONSE는 영구 실패다', () => {
    expect(isPermanentFailure(new ApiError('INVALID_RESPONSE', '계약과 다릅니다'))).toBe(true);
  });

  it('4xx는 영구 실패다', () => {
    expect(isPermanentFailure(new ApiError('EVENT_NOT_FOUND', '없습니다'))).toBe(true);
    expect(isPermanentFailure(new ApiError('UNAUTHORIZED', '로그인이 필요합니다'))).toBe(true);
    expect(isPermanentFailure(new ApiError('GAME_NOT_OPEN', '모집 중이 아닙니다'))).toBe(true);
  });

  /*
   * 5xx는 다음번에 성공할 수 있습니다. 여기서 멈추면 순간 장애 한 번에 화면이 영영
   * 굳습니다 — 실제로 게임 목록 API가 500을 낸 적이 있고, 그때도 폴링은 살아 있어야
   * 서버가 고쳐지는 순간 화면이 따라옵니다.
   */
  it('5xx는 영구 실패가 아니다', () => {
    expect(isPermanentFailure(new ApiError('INTERNAL_ERROR', '서버 오류'))).toBe(false);
    expect(isPermanentFailure(new ApiError('REPORT_GENERATION_FAILED', '요약 실패'))).toBe(false);
  });

  /*
   * 네트워크가 끊긴 경우입니다. `ApiError`가 아니라 그냥 `Error`로 옵니다.
   */
  it('ApiError가 아니면 영구 실패가 아니다', () => {
    expect(isPermanentFailure(new Error('Failed to fetch'))).toBe(false);
    expect(isPermanentFailure(new TypeError('NetworkError'))).toBe(false);
  });

  it('에러가 없으면 영구 실패가 아니다', () => {
    expect(isPermanentFailure(null)).toBe(false);
  });
});
