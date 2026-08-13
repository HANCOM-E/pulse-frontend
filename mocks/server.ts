import { setupServer } from 'msw/node';
import { createHandlers } from './handlers';

/**
 * Service Worker를 거치지 않는 환경(SSR 목·`mocks/handlers.test.ts` 계약 테스트)이라
 * `httpOnly: true`로 실제 명세를 그대로 지킵니다(이슈 #128, `mocks/handlers/auth.ts`
 * `sessionCookies` 주석 참고).
 */
export const server = setupServer(...createHandlers({ httpOnly: true }));
