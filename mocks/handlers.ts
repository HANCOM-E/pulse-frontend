import { adminHandlers } from '@/mocks/handlers/admin';
import { createAuthHandlers } from '@/mocks/handlers/auth';
import { eventHandlers } from '@/mocks/handlers/event';
import { feedbackHandlers } from '@/mocks/handlers/feedback';
import { gameHandlers } from '@/mocks/handlers/game';
import { reportHandlers } from '@/mocks/handlers/report';

/**
 * MSW 목 서버의 핸들러 모음입니다. 계약 원본은 Notion API 명세서(2026-08-06 갱신본)입니다.
 * https://app.notion.com/p/f3f5f62e868482ee9faf816de775057c
 *
 * 미확정 엔드포인트를 모아두던 `proposed.ts`는 2026-08-06에 다섯 건이 전부 명세로
 * 확정되면서 사라졌습니다. 지금은 전 핸들러가 확정 계약입니다.
 *
 * 게임(`game.ts`)은 예외입니다. 명세서에 아직 없고 #246에서 BE와 방향만 맞춘 상태라,
 * 이 목 스키마가 확정본이 되는 구조입니다(계약 우선 개발).
 *
 * `httpOnly`는 인증 핸들러의 `accessToken` 쿠키에만 영향을 줍니다(이슈 #128). 값을 어떻게
 * 넘겨야 하는지는 `mocks/handlers/auth.ts`의 `sessionCookies` 주석을 참고해야 합니다.
 * 이 파일을 직접 쓰는 `mocks/server.ts`·`mocks/browser.ts` 각각의 값도 그쪽에서 정합니다.
 */
export const createHandlers = ({ httpOnly }: { httpOnly: boolean }) => [
  ...createAuthHandlers({ httpOnly }),
  ...eventHandlers,
  ...feedbackHandlers,
  ...adminHandlers,
  ...reportHandlers,
  ...gameHandlers,
];
