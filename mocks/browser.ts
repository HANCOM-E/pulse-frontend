import { setupWorker } from 'msw/browser';
import { createHandlers } from './handlers';

/**
 * Service Worker가 응답을 가로채는 환경이라 `httpOnly: true`로 두면 `accessToken`
 * 쿠키가 브라우저에 저장되지 않습니다(이슈 #128, `mocks/handlers/auth.ts`
 * `sessionCookies` 주석 참고). `httpOnly: false`로 이 제약을 우회합니다.
 */
export const worker = setupWorker(...createHandlers({ httpOnly: false }));
