import { http, HttpResponse } from 'msw';
import type { Game, GameResultEntry, GameStatus } from '@/lib/schemas/api';
import {
  gameCreateRequestSchema,
  gameJoinRequestSchema,
  gameResultsRequestSchema,
  gameUpdateRequestSchema,
} from '@/lib/schemas/api';
import type { MockGameParticipant } from '@/mocks/data/seed';
import {
  db,
  findCurrentGame,
  findEventByCode,
  findGameById,
  findParticipantByClientId,
  listGamesOfEvent,
  listParticipantsOfGame,
  nextGameId,
  nextGameParticipantId,
  toGameParticipantView,
  toGameView,
} from '@/mocks/data/store';
import type { RequestCookies } from '@/mocks/handlers/shared';
import {
  API_BASE_URL,
  errorResponse,
  parseBody,
  requireOwnedEvent,
  toNumericId,
} from '@/mocks/handlers/shared';

/**
 * 행사 시작용 미니게임 핸들러입니다(#243, 계약 논의 #246).
 *
 * 참가·조회는 공개 경로라 인증을 요구하지 않고, 생성·상태 전이·결과 확정은 주최자 전용입니다.
 * 참가자 식별은 소감 제출과 같은 `X-Client-Id` 헤더를 씁니다.
 */

/**
 * 상태는 한 방향으로만 갑니다. 결과가 나온 뒤 되돌리면 순위가 무의미해집니다.
 *
 * `RUNNING → FINISHED`가 여기 없는 건 결과 확정(`POST .../results`)이 그 전이를 맡기
 * 때문입니다. PATCH로도 넘길 수 있게 두면 `results`가 `null`인 채 `FINISHED`가 돼서
 * 화면이 결과를 못 그립니다.
 */
const NEXT_STATUS: Record<GameStatus, GameStatus | null> = {
  DRAFT: 'OPEN',
  OPEN: 'RUNNING',
  RUNNING: null,
  FINISHED: null,
};

/**
 * 공개 경로의 공통 앞단입니다. code → gameId 순으로 좁히고 **게임이 그 이벤트 것인지까지**
 * 봅니다. 남의 이벤트 gameId를 넣어도 `GAME_NOT_FOUND`가 나야 합니다.
 */
const findGameOfEvent = (
  eventCode: string | readonly string[] | undefined,
  rawGameId: string | readonly string[] | undefined,
): Game | Response => {
  const event = typeof eventCode === 'string' ? findEventByCode(eventCode) : undefined;
  if (!event) return errorResponse('EVENT_NOT_FOUND');

  const gameId = toNumericId(rawGameId);
  if (gameId === null) return errorResponse('GAME_NOT_FOUND');

  const game = findGameById(gameId);
  if (!game || game.eventId !== event.id) return errorResponse('GAME_NOT_FOUND');

  return game;
};

/** 주최자 전용 경로의 앞단입니다. 인증·소유권을 먼저 보고 게임을 좁힙니다. */
const requireOwnedGame = (
  request: Request,
  cookies: RequestCookies,
  eventCode: string | readonly string[] | undefined,
  rawGameId: string | readonly string[] | undefined,
): Game | Response => {
  const event = requireOwnedEvent(request, cookies, eventCode);
  if (event instanceof Response) return event;

  const gameId = toNumericId(rawGameId);
  if (gameId === null) return errorResponse('GAME_NOT_FOUND');

  const game = findGameById(gameId);
  if (!game || game.eventId !== event.id) return errorResponse('GAME_NOT_FOUND');

  return game;
};

export const gameHandlers = [
  http.post(`${API_BASE_URL}/events/:eventCode/games`, async ({ request, params, cookies }) => {
    const event = requireOwnedEvent(request, cookies, params.eventCode);
    if (event instanceof Response) return event;

    const body = await parseBody(request, gameCreateRequestSchema);
    if (!body.ok) return body.response;

    const game: Game = {
      id: nextGameId(),
      eventId: event.id,
      title: body.data.title,
      gameType: body.data.gameType,
      // 만들자마자 열지 않습니다. 주최자가 시점을 정합니다.
      status: 'DRAFT',
      results: null,
      createdAt: new Date().toISOString(),
    };
    db.games.push(game);

    return HttpResponse.json(toGameView(game), { status: 201 });
  }),

  http.get(`${API_BASE_URL}/events/:eventCode/games`, ({ request, params, cookies }) => {
    const event = requireOwnedEvent(request, cookies, params.eventCode);
    if (event instanceof Response) return event;

    return HttpResponse.json({ items: listGamesOfEvent(event.id).map(toGameView) });
  }),

  /*
   * ⚠️ `current`는 반드시 `:gameId`보다 위에 있어야 합니다. MSW는 배열 순서대로 매칭하는데,
   * `/games/:gameId`가 먼저면 `/games/current`를 gameId="current"로 잡아서 404가 납니다.
   */
  http.get(`${API_BASE_URL}/events/:eventCode/games/current`, ({ params }) => {
    const event = findEventByCode(String(params.eventCode));
    if (!event) return errorResponse('EVENT_NOT_FOUND');

    const game = findCurrentGame(event.id);
    // 열린 게임이 없으면 404입니다. 소감 화면 배너는 이 응답을 보고 자기를 감춥니다.
    if (!game) return errorResponse('GAME_NOT_FOUND');

    return HttpResponse.json(toGameView(game));
  }),

  http.get(`${API_BASE_URL}/events/:eventCode/games/:gameId`, ({ params }) => {
    const game = findGameOfEvent(params.eventCode, params.gameId);
    if (game instanceof Response) return game;

    return HttpResponse.json(toGameView(game));
  }),

  http.patch(
    `${API_BASE_URL}/events/:eventCode/games/:gameId`,
    async ({ request, params, cookies }) => {
      const game = requireOwnedGame(request, cookies, params.eventCode, params.gameId);
      if (game instanceof Response) return game;

      const body = await parseBody(request, gameUpdateRequestSchema);
      if (!body.ok) return body.response;

      if (game.status === 'FINISHED') return errorResponse('GAME_ALREADY_FINISHED');
      if (NEXT_STATUS[game.status] !== body.data.status) {
        return errorResponse('INVALID_GAME_STATE_TRANSITION');
      }

      game.status = body.data.status;

      return HttpResponse.json(toGameView(game));
    },
  ),

  http.post(
    `${API_BASE_URL}/events/:eventCode/games/:gameId/participants`,
    async ({ request, params }) => {
      const game = findGameOfEvent(params.eventCode, params.gameId);
      if (game instanceof Response) return game;

      // 모집 중이 아니면 막습니다. RUNNING이 되는 순간 참가가 닫히는 게 이 검사입니다.
      if (game.status !== 'OPEN') return errorResponse('GAME_NOT_OPEN');

      const body = await parseBody(request, gameJoinRequestSchema);
      if (!body.ok) return body.response;

      const clientId = request.headers.get('X-Client-Id') ?? 'anonymous';

      /*
       * 같은 브라우저가 다시 부르면 닉네임만 갈아끼웁니다. 새 참가자를 만들면 한 사람이
       * 새로고침만으로 인원을 부풀릴 수 있습니다. 별도 빈도 제한을 안 두는 근거가 이겁니다.
       */
      const existing = findParticipantByClientId(game.id, clientId);
      if (existing) {
        existing.nickname = body.data.nickname;
        return HttpResponse.json(toGameParticipantView(existing));
      }

      const participant: MockGameParticipant = {
        id: nextGameParticipantId(),
        gameId: game.id,
        nickname: body.data.nickname,
        clientId,
        joinedAt: new Date().toISOString(),
      };
      db.gameParticipants.push(participant);

      return HttpResponse.json(toGameParticipantView(participant), { status: 201 });
    },
  ),

  http.post(
    `${API_BASE_URL}/events/:eventCode/games/:gameId/results`,
    async ({ request, params, cookies }) => {
      const game = requireOwnedGame(request, cookies, params.eventCode, params.gameId);
      if (game instanceof Response) return game;

      if (game.status === 'FINISHED') return errorResponse('GAME_ALREADY_FINISHED');
      if (game.status !== 'RUNNING') return errorResponse('INVALID_GAME_STATE_TRANSITION');

      const body = await parseBody(request, gameResultsRequestSchema);
      if (!body.ok) return body.response;

      /*
       * 순위 자체는 검증하지 않습니다. 프로젝터가 물리 시뮬레이션으로 뽑은 결과라 서버가
       * 재현할 수 없습니다(#246에서 BE 동의). 소속과 중복만 봅니다 — 중복은 스키마가,
       * 소속은 여기서 막습니다.
       *
       * 전원이 다 들어와야 하는 건 아닙니다. 인원이 많으면 상위 N명만 올릴 수 있습니다.
       */
      const byId = new Map(listParticipantsOfGame(game.id).map((row) => [row.id, row]));
      const entries: GameResultEntry[] = [];

      for (let index = 0; index < body.data.ranking.length; index += 1) {
        const participantId = body.data.ranking[index];
        const participant = byId.get(participantId);
        if (!participant) {
          return errorResponse('VALIDATION_ERROR', `참가자 ${participantId}는 이 게임에 없습니다.`);
        }
        entries.push({ rank: index + 1, participantId, nickname: participant.nickname });
      }

      game.results = entries;
      game.status = 'FINISHED';

      return HttpResponse.json(toGameView(game));
    },
  ),
];
