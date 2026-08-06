import { adminHandlers } from '@/mocks/handlers/admin';
import { authHandlers } from '@/mocks/handlers/auth';
import { eventHandlers } from '@/mocks/handlers/event';
import { feedbackHandlers } from '@/mocks/handlers/feedback';
import { reportHandlers } from '@/mocks/handlers/report';

/**
 * MSW 목 서버의 핸들러 모음입니다. 계약 원본은 Notion API 명세서(2026-08-06 갱신본)입니다.
 * https://app.notion.com/p/f3f5f62e868482ee9faf816de775057c
 *
 * 미확정 엔드포인트를 모아두던 `proposed.ts`는 2026-08-06에 다섯 건이 전부 명세로
 * 확정되면서 사라졌습니다. 지금은 전 핸들러가 확정 계약입니다.
 */
export const handlers = [
  ...authHandlers,
  ...eventHandlers,
  ...feedbackHandlers,
  ...adminHandlers,
  ...reportHandlers,
];
