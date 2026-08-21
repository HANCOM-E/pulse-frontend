import { sse } from 'msw';

import type { FeedbackSnapshot, SessionView } from '@/lib/schemas/api';
import {
  buildSnapshot,
  findEventByCode,
  listSessionsOfEvent,
  toSessionView,
} from '@/mocks/data/store';
import { API_BASE_URL, toNumericId } from '@/mocks/handlers/shared';

/**
 * SSE 스트림 목입니다. 계약 원본은 Notion API 명세서(2026-08-21 갱신본)입니다.
 *
 * ⚠️ 이 파일은 **브라우저에서만** 등록해야 합니다(`mocks/browser.ts`). `sse()`는 생성 시점에
 * `EventSource` 전역을 요구하는데(msw `core/sse.mjs`의 invariant) Node에는 플래그 없이 그
 * 전역이 없습니다. `mocks/handlers.ts`의 `createHandlers`에 넣으면 `mocks/server.ts`를 쓰는
 * SSR 목과 `mocks/handlers.test.ts`가 SSE와 무관하게 모듈 로드 단계에서 통째로 죽습니다.
 *
 * 실제 서버는 소감 제출·모더레이션·세션 토글이 일어난 시점에 밀어줍니다. 목에는 그 변경을
 * 알려줄 장치가 없어서(`mocks/data/store.ts`의 `db`가 그냥 배열입니다) 주기적으로 다시
 * 만들어 보냅니다. 계약과 배선을 확인하는 데는 충분하지만, "변경 시점에 즉시 온다"까지
 * 재현하지는 못합니다.
 */

/** 목이 스냅샷을 다시 밀어주는 간격입니다. */
const PUSH_INTERVAL_MS = 2_000;

/**
 * 연결이 끊기면 타이머를 정리합니다. 안 걸어두면 탭을 옮기거나 세션을 바꿀 때마다 타이머가
 * 쌓여서, 목이 죽은 커넥션에 계속 쓰다가 콘솔이 에러로 뒤덮입니다.
 */
const stopOnDisconnect = (request: Request, timer: ReturnType<typeof setInterval>): void => {
  request.signal.addEventListener('abort', () => clearInterval(timer));
};

export const streamHandlers = [
  /** 집계 스냅샷 구독. `data`는 `GET .../feedbacks`와 같은 `FeedbackSnapshot`입니다. */
  sse<{ snapshot: FeedbackSnapshot }>(
    `${API_BASE_URL}/events/:eventCode/feedbacks/stream`,
    ({ client, params, request }) => {
      const event = findEventByCode(String(params.eventCode));
      if (!event) {
        client.error();
        return;
      }

      /*
       * 폴링 핸들러와 달리 잘못된 `sessionId`를 에러로 돌려줄 방법이 없습니다. SSE는 이미 200으로
       * 열린 스트림이라 상태 코드를 바꿀 수 없어서, 값이 이상하면 세션 필터 없이 이벤트 전체를
       * 집계해 보냅니다.
       */
      const rawSessionId = new URL(request.url).searchParams.get('sessionId') ?? undefined;
      const sessionId = toNumericId(rawSessionId) ?? undefined;

      const push = () => {
        client.send({ event: 'snapshot', data: buildSnapshot(event.id, sessionId) });
      };

      // 명세대로 연결 직후 현재 스냅샷을 1건 보냅니다.
      push();
      stopOnDisconnect(request, setInterval(push, PUSH_INTERVAL_MS));
    },
  ),

  /** 세션 목록 구독. `data`는 `GET .../sessions`와 같은 `{ items }` 봉투입니다. */
  sse<{ snapshot: { items: SessionView[] } }>(
    `${API_BASE_URL}/events/:eventCode/sessions/stream`,
    ({ client, params, request }) => {
      const event = findEventByCode(String(params.eventCode));
      if (!event) {
        client.error();
        return;
      }

      const push = () => {
        client.send({
          event: 'snapshot',
          data: { items: listSessionsOfEvent(event.id).map(toSessionView) },
        });
      };

      push();
      stopOnDisconnect(request, setInterval(push, PUSH_INTERVAL_MS));
    },
  ),
];
