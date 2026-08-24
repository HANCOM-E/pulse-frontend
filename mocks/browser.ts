import { setupWorker } from 'msw/browser';
import { streamHandlers } from '@/mocks/handlers/stream';
import { createHandlers } from './handlers';

/**
 * Service Worker가 응답을 가로채는 환경이라 `httpOnly: true`로 두면 `accessToken`
 * 쿠키가 브라우저에 저장되지 않습니다(이슈 #128, `mocks/handlers/auth.ts`
 * `sessionCookies` 주석 참고). `httpOnly: false`로 이 제약을 우회합니다.
 *
 * SSE 핸들러는 `createHandlers`에 넣지 않고 여기서만 더합니다. `sse()`가 생성 시점에
 * `EventSource` 전역을 요구해서, 같이 묶으면 `mocks/server.ts`(SSR 목·계약 테스트)가
 * Node에서 모듈 로드 단계에 죽습니다(`mocks/handlers/stream.ts` 주석 참고).
 */
export const worker = setupWorker(...createHandlers({ httpOnly: false }), ...streamHandlers);
