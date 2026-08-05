import { adminHandlers } from '@/mocks/handlers/admin';
import { authHandlers } from '@/mocks/handlers/auth';
import { eventHandlers } from '@/mocks/handlers/event';
import { feedbackHandlers } from '@/mocks/handlers/feedback';
import { proposedHandlers } from '@/mocks/handlers/proposed';
import { reportHandlers } from '@/mocks/handlers/report';

/**
 * MSW 목 서버의 핸들러 모음입니다. 계약 원본은 openapi.yaml v0.2입니다.
 * https://app.notion.com/p/3b25f62e868481dbbf3efcb698ecb072
 *
 * `proposedHandlers`만 성격이 다릅니다. 명세에 없는데 화면에 필요한 엔드포인트를
 * 목에서만 먼저 연 것이라, 김효인 님 확인 전까지는 여기 있는 응답이 곧 제안서입니다.
 * 배경과 목록은 mocks/README.md의 "proposed.ts — 아직 계약이 아닌 것" 절에 있습니다.
 *
 * 제안이 앞에 오는 이유: 확정 핸들러와 경로가 겹치는 건이 있는데(모더레이션 큐의 status 필터),
 * 겹치는 쪽은 자기 조건이 아니면 다음 핸들러로 넘깁니다. 뒤에 두면 확정 쪽이 먼저 잡습니다.
 *
 * 제안이 확정되거나 폐기되면 아래 한 줄과 mocks/handlers/proposed.ts만 지우면 됩니다.
 */
const confirmedHandlers = [
  ...authHandlers,
  ...eventHandlers,
  ...feedbackHandlers,
  ...adminHandlers,
  ...reportHandlers,
];

export const handlers = [...proposedHandlers, ...confirmedHandlers];
