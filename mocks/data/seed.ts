import type {
  Feedback,
  Game,
  GameParticipant,
  PulseEvent,
  Report,
  Session,
} from '@/lib/schemas/api';

/**
 * MSW 목 서버의 시드 데이터입니다.
 *
 * 화면별로 필요한 상태를 한 번에 만질 수 있도록 이벤트를 세 가지 상태로 준비했습니다.
 *   - LIVE  (ab3f9x) 대시보드·실시간·모더레이션 확인용. 독성/미분류 소감이 섞여 있습니다.
 *   - ENDED (kd7m2p) 공개 리포트 확인용. 리포트가 GENERATED·isPublic=true 상태입니다.
 *   - DRAFT (zq1v8t) 세션 0개. LIVE 전이 시 409를 확인하는 용도입니다.
 *   - 게임은 LIVE 이벤트(ab3f9x)에만 깔려 있습니다. OPEN 1개 + FINISHED 1개입니다.
 */

export const HOST_USER = {
  id: 1,
  email: 'host@example.com',
  password: 'pulse1234',
  createdAt: '2026-07-15T00:00:00.000Z',
} as const;

export const TAGGER_VERSION = 'koelectra-small-v3-nsmc-q8+tau-1.2';

export const seedEvents: PulseEvent[] = [
  {
    id: 42,
    code: 'ab3f9x',
    title: '2026 프론트엔드 세미나',
    description: '리액트 서버 컴포넌트와 실시간 UI를 주제로 한 사내 세미나입니다.',
    // 소감 시드가 2026-08-05 기준으로 깔려 있어서 행사 날짜도 같은 날에 맞췄습니다.
    eventDate: '2026-08-05',
    ownerId: HOST_USER.id,
    status: 'LIVE',
    createdAt: '2026-08-01T09:00:00.000Z',
  },
  {
    id: 43,
    code: 'kd7m2p',
    title: '한컴 신입 온보딩 데이',
    description: '신입 개발자 대상 온보딩 세션입니다.',
    // 이미 끝난 행사. 목록에서 "지난 행사"를 확인하는 용도입니다.
    eventDate: '2026-07-20',
    ownerId: HOST_USER.id,
    status: 'ENDED',
    createdAt: '2026-07-20T01:00:00.000Z',
  },
  {
    id: 44,
    code: 'zq1v8t',
    title: '사내 해커톤 리허설',
    description: null,
    // 아직 열지 않은 행사. createdAt보다 미래라 두 필드가 다른 값임이 드러납니다.
    eventDate: '2026-09-01',
    ownerId: HOST_USER.id,
    status: 'DRAFT',
    createdAt: '2026-08-04T05:00:00.000Z',
  },
];

/**
 * 게임 시드입니다. LIVE 이벤트(42)에만 깔았습니다.
 *
 * `OPEN` 하나와 `FINISHED` 하나를 둡니다. 소감 화면 배너가 상태별로 문구를 바꾸는데,
 * 둘 다 있어야 `current`가 무엇을 고르는지(가장 최근 것)를 화면에서 확인할 수 있습니다.
 *
 * 소감 시드와 달리 id 를 직접 씁니다. 배열 순번으로 정하면 중간에 끼워 넣을 때
 * 참가자의 gameId 가 통째로 어긋납니다.
 */
export const seedGames: Game[] = [
  {
    id: 1,
    eventId: 42,
    title: '쉬는 시간 몸풀기',
    gameType: 'PINBALL',
    status: 'FINISHED',
    /** 1등부터 담습니다. 값은 `participantId`고 닉네임은 명단에서 찾습니다. */
    ranking: [2, 1, 3],
    createdAt: '2026-08-05T01:00:00.000Z',
  },
  {
    id: 2,
    eventId: 42,
    title: '오후 세션 시작 전',
    gameType: 'PINBALL',
    status: 'OPEN',
    ranking: [],
    createdAt: '2026-08-05T04:00:00.000Z',
  },
];

/**
 * 게임 참가자입니다. 저장소 행이라 공개 응답에 안 나가는 `gameId`·`clientId`가 붙습니다.
 *
 * 타입을 store가 아니라 여기 두는 이유는 순환 임포트 때문입니다 — store가 seed를 임포트하고
 * 있어서 반대 방향으로 타입을 가져올 수 없습니다. 공개 `GameParticipant`에서 파생시켰으므로
 * 필드 목록이 두 벌로 갈라지지는 않습니다.
 */
export interface MockGameParticipant extends GameParticipant {
  gameId: number;
  /** 브라우저 UUID입니다. 공개 응답에 절대 나가면 안 됩니다. */
  clientId: string;
}

export const seedGameParticipants: MockGameParticipant[] = [
  {
    id: 1,
    gameId: 1,
    nickname: '초코송이',
    clientId: 'seed-client-1',
    joinedAt: '2026-08-05T01:02:00.000Z',
  },
  {
    id: 2,
    gameId: 1,
    nickname: '감자',
    clientId: 'seed-client-2',
    joinedAt: '2026-08-05T01:02:30.000Z',
  },
  {
    id: 3,
    gameId: 1,
    nickname: '눈사람',
    clientId: 'seed-client-3',
    joinedAt: '2026-08-05T01:03:00.000Z',
  },
  // 같은 clientId(seed-client-2)가 다른 게임에도 있습니다. 재참가 판정이 게임 단위인지 확인용입니다.
  {
    id: 4,
    gameId: 2,
    nickname: '라면',
    clientId: 'seed-client-4',
    joinedAt: '2026-08-05T04:01:00.000Z',
  },
  {
    id: 5,
    gameId: 2,
    nickname: '커피',
    clientId: 'seed-client-2',
    joinedAt: '2026-08-05T04:01:20.000Z',
  },
  {
    id: 6,
    gameId: 2,
    nickname: '붕어빵',
    clientId: 'seed-client-6',
    joinedAt: '2026-08-05T04:01:40.000Z',
  },
  {
    id: 7,
    gameId: 2,
    nickname: '군고구마',
    clientId: 'seed-client-7',
    joinedAt: '2026-08-05T04:02:00.000Z',
  },
  {
    id: 8,
    gameId: 2,
    nickname: '호빵',
    clientId: 'seed-client-8',
    joinedAt: '2026-08-05T04:02:20.000Z',
  },
  {
    id: 9,
    gameId: 2,
    nickname: '떡볶이',
    clientId: 'seed-client-9',
    joinedAt: '2026-08-05T04:02:40.000Z',
  },
  {
    id: 10,
    gameId: 2,
    nickname: '오뎅',
    clientId: 'seed-client-10',
    joinedAt: '2026-08-05T04:03:00.000Z',
  },
  {
    id: 11,
    gameId: 2,
    nickname: '순대',
    clientId: 'seed-client-11',
    joinedAt: '2026-08-05T04:03:20.000Z',
  },
  {
    id: 12,
    gameId: 2,
    nickname: '핫도그',
    clientId: 'seed-client-12',
    joinedAt: '2026-08-05T04:03:40.000Z',
  },
  {
    id: 13,
    gameId: 2,
    nickname: '와플',
    clientId: 'seed-client-13',
    joinedAt: '2026-08-05T04:04:00.000Z',
  },
];

export const seedSessions: Session[] = [
  { id: 101, eventId: 42, title: '1부: 키노트', order: 1, status: 'ACTIVE' },
  { id: 102, eventId: 42, title: '2부: 패널 토론', order: 2, status: 'ACTIVE' },
  // 마감된 순서. 목록에는 남지만 제출은 SESSION_CLOSED(409)로 막혀야 합니다.
  { id: 103, eventId: 42, title: '3부: Q&A', order: 3, status: 'CLOSED' },
  { id: 104, eventId: 42, title: '취소된 세션', order: 4, status: 'DELETED' },
  { id: 201, eventId: 43, title: '오전: 조직 소개', order: 1, status: 'ACTIVE' },
  { id: 202, eventId: 43, title: '오후: 코드 리뷰 문화', order: 2, status: 'ACTIVE' },
];

interface SeedFeedbackInput {
  sessionId: number;
  text: string;
  sentiment: Feedback['sentiment'];
  keywords: string[];
  toxic?: boolean;
  status?: Feedback['status'];
  /** 이벤트 시작 시각(2026-08-05T00:00:00Z) 기준 경과 분 */
  minute: number;
}

const EVENT_START_MS = Date.parse('2026-08-05T00:00:00.000Z');

const buildFeedbacks = (inputs: SeedFeedbackInput[]): Feedback[] =>
  inputs.map((input, index) => ({
    id: 900 + index,
    sessionId: input.sessionId,
    text: input.text,
    sentiment: input.sentiment,
    toxic: input.toxic ?? false,
    keywords: input.keywords,
    taggerVersion: TAGGER_VERSION,
    status: input.status ?? 'VISIBLE',
    createdAt: new Date(EVENT_START_MS + input.minute * 60_000).toISOString(),
  }));

/*
 * ⚠️ id 는 배열 순번으로 정해집니다(900 + index). 중간에 끼워 넣으면 뒤 항목의 id 가
 * 전부 밀리고, mocks/handlers.test.ts 의 HIDDEN_FEEDBACK_ID·DELETED_FEEDBACK_ID 가
 * 엉뚱한 소감을 가리킵니다. 새 소감은 배열 끝에 추가하세요. 화면 정렬은 minute 이 합니다.
 */
export const seedFeedbacks: Feedback[] = buildFeedbacks([
  // ── 이벤트 42 / 1부: 키노트 ────────────────────────────────
  {
    sessionId: 101,
    text: '도입부 사례가 실무랑 딱 맞아서 좋았어요',
    sentiment: 'POS',
    keywords: ['사례', '실무'],
    minute: 3,
  },
  {
    sessionId: 101,
    text: '슬라이드 글씨가 조금 작아서 뒷자리에서 안 보입니다',
    sentiment: 'NEG',
    keywords: ['슬라이드', '가독성'],
    minute: 5,
  },
  {
    sessionId: 101,
    text: '발표 속도가 조금 빨랐어요',
    sentiment: 'NEU',
    keywords: ['발표속도'],
    minute: 7,
  },
  {
    sessionId: 101,
    text: '데모가 실제로 동작하는 걸 보여줘서 이해가 빨랐습니다',
    sentiment: 'POS',
    keywords: ['데모', '이해'],
    minute: 9,
  },
  {
    sessionId: 101,
    text: '마이크 볼륨이 너무 큽니다',
    sentiment: 'NEG',
    keywords: ['음향'],
    minute: 11,
  },
  {
    sessionId: 101,
    text: '준비를 하나도 안 한 게 티가 나네 시간 아깝다',
    sentiment: 'NEG',
    keywords: ['준비'],
    toxic: false,
    minute: 12,
  },
  {
    sessionId: 101,
    text: '감정 분석이 안 켜진 것 같은데 그냥 남깁니다',
    sentiment: 'UNKNOWN',
    keywords: [],
    minute: 13,
  },
  {
    sessionId: 101,
    text: '전반적으로 무난했습니다',
    sentiment: 'NEU',
    keywords: ['무난'],
    minute: 15,
  },

  // ── 이벤트 42 / 2부: 패널 토론 ─────────────────────────────
  {
    sessionId: 102,
    text: '패널들 의견이 갈리는 지점이 제일 재밌었어요',
    sentiment: 'POS',
    keywords: ['패널', '토론'],
    minute: 32,
  },
  {
    sessionId: 102,
    text: '질문 받는 시간이 너무 짧았습니다',
    sentiment: 'NEG',
    keywords: ['질문시간'],
    minute: 35,
  },
  {
    sessionId: 102,
    text: '사회자가 정리를 잘 해주셔서 흐름을 놓치지 않았어요',
    sentiment: 'POS',
    keywords: ['사회자', '진행'],
    minute: 37,
  },
  {
    sessionId: 102,
    text: '모델 로딩이 안 돼서 그냥 제출합니다',
    sentiment: 'UNKNOWN',
    keywords: [],
    minute: 38,
  },
  {
    sessionId: 102,
    text: '이딴 걸 토론이라고 앉아서 듣고 있는 내가 한심하다',
    sentiment: 'NEG',
    keywords: ['토론'],
    toxic: false,
    minute: 40,
  },
  {
    sessionId: 102,
    text: '발표속도는 이번이 딱 좋았어요',
    sentiment: 'POS',
    keywords: ['발표속도'],
    minute: 42,
  },
  {
    sessionId: 102,
    text: '중간에 소리가 끊겼습니다',
    sentiment: 'NEG',
    keywords: ['음향'],
    minute: 44,
  },
  {
    sessionId: 102,
    text: '앞에 나온 사람 얼굴부터가 마음에 안 드는데',
    sentiment: 'NEG',
    keywords: ['외모'],
    toxic: false,
    status: 'HIDDEN',
    minute: 45,
  },
  {
    sessionId: 102,
    text: '실무 적용 사례를 하나만 더 들어주셨으면',
    sentiment: 'NEU',
    keywords: ['사례', '실무'],
    minute: 47,
  },

  // ── 이벤트 42 / 3부: Q&A ───────────────────────────────────
  {
    sessionId: 103,
    text: '질문 하나하나 성실하게 답해주셔서 좋았습니다',
    sentiment: 'POS',
    keywords: ['질의응답'],
    minute: 62,
  },
  {
    sessionId: 103,
    text: '시간이 부족해서 제 질문은 못 했어요',
    sentiment: 'NEG',
    keywords: ['질문시간'],
    minute: 64,
  },
  {
    sessionId: 103,
    text: '다음에도 같은 포맷으로 해주세요',
    sentiment: 'POS',
    keywords: ['재참여'],
    minute: 66,
  },
  {
    sessionId: 103,
    text: '개나 소나 발표하는구나 진짜',
    sentiment: 'NEG',
    keywords: [],
    toxic: false,
    minute: 67,
  },
  {
    sessionId: 103,
    text: '자료 공유해주시면 감사하겠습니다',
    sentiment: 'NEU',
    keywords: ['자료공유'],
    minute: 69,
  },
  {
    sessionId: 103,
    text: '이미 삭제 처리된 소감입니다',
    sentiment: 'NEU',
    keywords: [],
    status: 'DELETED',
    minute: 70,
  },
  {
    sessionId: 103,
    text: '실무에서 바로 써먹을 수 있을 것 같아요',
    sentiment: 'POS',
    keywords: ['실무'],
    minute: 72,
  },

  // ── 이벤트 43 (ENDED) ──────────────────────────────────────
  {
    sessionId: 201,
    text: '조직도 설명이 명확했습니다',
    sentiment: 'POS',
    keywords: ['조직소개'],
    minute: 5,
  },
  {
    sessionId: 201,
    text: '내용이 좀 많아서 정신없었어요',
    sentiment: 'NEG',
    keywords: ['분량'],
    minute: 8,
  },
  {
    sessionId: 202,
    text: '코드 리뷰 예시가 구체적이라 좋았어요',
    sentiment: 'POS',
    keywords: ['코드리뷰', '사례'],
    minute: 40,
  },
  {
    sessionId: 202,
    text: '리뷰 문화 얘기는 매번 듣지만 실천이 어렵죠',
    sentiment: 'NEU',
    keywords: ['코드리뷰'],
    minute: 43,
  },
  {
    sessionId: 202,
    text: '실습 시간이 있었으면 더 좋았을 것 같습니다',
    sentiment: 'NEU',
    keywords: ['실습'],
    minute: 45,
  },
  // 공개 리포트의 unclassifiedCount가 0이 아니어야 화면이 "미분류 N건"을 그리는지 확인됩니다.
  {
    sessionId: 202,
    text: '브라우저가 버벅여서 분석이 안 된 채로 남깁니다',
    sentiment: 'UNKNOWN',
    keywords: [],
    minute: 47,
  },

  /*
   * 배열 끝에 둡니다. 시간 순서로는 1부(minute 33) 자리지만, 중간에 끼우면 뒤 항목의
   * id가 전부 밀려서 handlers.test.ts 의 HIDDEN_FEEDBACK_ID·DELETED_FEEDBACK_ID가
   * 엉뚱한 소감을 가리킵니다. 정렬은 minute 이 하고, 배열 위치는 id 만 정합니다.
   *
   * toxic 은 욕설 사전 매칭입니다(#160). 이 목록에서 유일하게 실제 욕설이 든 소감이라,
   * `?toxic=true` 필터와 대시보드의 독성 지표를 확인할 수 있는 자료입니다.
   * status 가 HIDDEN 인 것은 #150 규칙(독성은 제출 시점부터 비공개)을 따른 결과입니다.
   */
  {
    sessionId: 101,
    text: '시발 뭔 소린지 하나도 모르겠네',
    sentiment: 'NEG',
    keywords: [],
    toxic: true,
    status: 'HIDDEN',
    minute: 33,
  },
]);

export const seedReports: Report[] = [
  {
    id: 1,
    eventId: 43,
    status: 'GENERATED',
    summaryText:
      '참가자들은 조직 소개의 명확함과 코드 리뷰 예시의 구체성을 가장 높게 평가했습니다. ' +
      '반면 오전 세션의 분량이 많아 집중이 흐트러졌다는 지적과, 실습 시간이 없어 아쉬웠다는 ' +
      '의견이 반복적으로 나왔습니다. 다음 온보딩에서는 오전 분량을 줄이고 그 시간을 짧은 ' +
      '실습으로 옮기는 편이 좋겠습니다.',
    sentimentBreakdown: { POS: 2, NEU: 2, NEG: 1 },
    // 감정 분포는 UNKNOWN을 빼고 세므로 5건, 실제 분석 대상은 6건입니다.
    unclassifiedCount: 1,
    topKeywords: [
      { keyword: '코드리뷰', count: 2 },
      { keyword: '사례', count: 1 },
      { keyword: '조직소개', count: 1 },
      { keyword: '실습', count: 1 },
      { keyword: '분량', count: 1 },
    ],
    isPublic: true,
    generatedAt: '2026-07-20T08:30:00.000Z',
  },
];
