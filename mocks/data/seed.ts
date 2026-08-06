import type { Feedback, PulseEvent, Report, Session } from '@/lib/schemas/api';

/**
 * MSW 목 서버의 시드 데이터입니다.
 *
 * 화면별로 필요한 상태를 한 번에 만질 수 있도록 이벤트를 세 가지 상태로 준비했습니다.
 *   - LIVE  (ab3f9x) 대시보드·실시간·모더레이션 확인용. 독성/미분류 소감이 섞여 있습니다.
 *   - ENDED (kd7m2p) 공개 리포트 확인용. 리포트가 GENERATED·isPublic=true 상태입니다.
 *   - DRAFT (zq1v8t) 세션 0개. LIVE 전이 시 409를 확인하는 용도입니다.
 */

export const HOST_USER = {
  id: 1,
  email: 'host@example.com',
  password: 'pulse1234',
} as const;

export const TAGGER_VERSION = 'kobert-sent-v1';

export const seedEvents: PulseEvent[] = [
  {
    id: 42,
    code: 'ab3f9x',
    title: '2026 프론트엔드 세미나',
    description: '리액트 서버 컴포넌트와 실시간 UI를 주제로 한 사내 세미나입니다.',
    ownerId: HOST_USER.id,
    status: 'LIVE',
    createdAt: '2026-08-01T09:00:00.000Z',
  },
  {
    id: 43,
    code: 'kd7m2p',
    title: '한컴 신입 온보딩 데이',
    description: '신입 개발자 대상 온보딩 세션입니다.',
    ownerId: HOST_USER.id,
    status: 'ENDED',
    createdAt: '2026-07-20T01:00:00.000Z',
  },
  {
    id: 44,
    code: 'zq1v8t',
    title: '사내 해커톤 리허설',
    description: null,
    ownerId: HOST_USER.id,
    status: 'DRAFT',
    createdAt: '2026-08-04T05:00:00.000Z',
  },
];

export const seedSessions: Session[] = [
  { id: 101, eventId: 42, title: '1부: 키노트', order: 1, status: 'ACTIVE' },
  { id: 102, eventId: 42, title: '2부: 패널 토론', order: 2, status: 'ACTIVE' },
  { id: 103, eventId: 42, title: '3부: Q&A', order: 3, status: 'ACTIVE' },
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

export const seedFeedbacks: Feedback[] = buildFeedbacks([
  // ── 이벤트 42 / 1부: 키노트 ────────────────────────────────
  { sessionId: 101, text: '도입부 사례가 실무랑 딱 맞아서 좋았어요', sentiment: 'POS', keywords: ['사례', '실무'], minute: 3 },
  { sessionId: 101, text: '슬라이드 글씨가 조금 작아서 뒷자리에서 안 보입니다', sentiment: 'NEG', keywords: ['슬라이드', '가독성'], minute: 5 },
  { sessionId: 101, text: '발표 속도가 조금 빨랐어요', sentiment: 'NEU', keywords: ['발표속도'], minute: 7 },
  { sessionId: 101, text: '데모가 실제로 동작하는 걸 보여줘서 이해가 빨랐습니다', sentiment: 'POS', keywords: ['데모', '이해'], minute: 9 },
  { sessionId: 101, text: '마이크 볼륨이 너무 큽니다', sentiment: 'NEG', keywords: ['음향'], minute: 11 },
  { sessionId: 101, text: '준비를 하나도 안 한 게 티가 나네 시간 아깝다', sentiment: 'NEG', keywords: ['준비'], toxic: true, minute: 12 },
  { sessionId: 101, text: '감정 분석이 안 켜진 것 같은데 그냥 남깁니다', sentiment: 'UNKNOWN', keywords: [], minute: 13 },
  { sessionId: 101, text: '전반적으로 무난했습니다', sentiment: 'NEU', keywords: ['무난'], minute: 15 },

  // ── 이벤트 42 / 2부: 패널 토론 ─────────────────────────────
  { sessionId: 102, text: '패널들 의견이 갈리는 지점이 제일 재밌었어요', sentiment: 'POS', keywords: ['패널', '토론'], minute: 32 },
  { sessionId: 102, text: '질문 받는 시간이 너무 짧았습니다', sentiment: 'NEG', keywords: ['질문시간'], minute: 35 },
  { sessionId: 102, text: '사회자가 정리를 잘 해주셔서 흐름을 놓치지 않았어요', sentiment: 'POS', keywords: ['사회자', '진행'], minute: 37 },
  { sessionId: 102, text: '모델 로딩이 안 돼서 그냥 제출합니다', sentiment: 'UNKNOWN', keywords: [], minute: 38 },
  { sessionId: 102, text: '이딴 걸 토론이라고 앉아서 듣고 있는 내가 한심하다', sentiment: 'NEG', keywords: ['토론'], toxic: true, minute: 40 },
  { sessionId: 102, text: '발표속도는 이번이 딱 좋았어요', sentiment: 'POS', keywords: ['발표속도'], minute: 42 },
  { sessionId: 102, text: '중간에 소리가 끊겼습니다', sentiment: 'NEG', keywords: ['음향'], minute: 44 },
  {
    sessionId: 102,
    text: '앞에 나온 사람 얼굴부터가 마음에 안 드는데',
    sentiment: 'NEG',
    keywords: ['외모'],
    toxic: true,
    status: 'HIDDEN',
    minute: 45,
  },
  { sessionId: 102, text: '실무 적용 사례를 하나만 더 들어주셨으면', sentiment: 'NEU', keywords: ['사례', '실무'], minute: 47 },

  // ── 이벤트 42 / 3부: Q&A ───────────────────────────────────
  { sessionId: 103, text: '질문 하나하나 성실하게 답해주셔서 좋았습니다', sentiment: 'POS', keywords: ['질의응답'], minute: 62 },
  { sessionId: 103, text: '시간이 부족해서 제 질문은 못 했어요', sentiment: 'NEG', keywords: ['질문시간'], minute: 64 },
  { sessionId: 103, text: '다음에도 같은 포맷으로 해주세요', sentiment: 'POS', keywords: ['재참여'], minute: 66 },
  { sessionId: 103, text: '개나 소나 발표하는구나 진짜', sentiment: 'NEG', keywords: [], toxic: true, minute: 67 },
  { sessionId: 103, text: '자료 공유해주시면 감사하겠습니다', sentiment: 'NEU', keywords: ['자료공유'], minute: 69 },
  { sessionId: 103, text: '이미 삭제 처리된 소감입니다', sentiment: 'NEU', keywords: [], status: 'DELETED', minute: 70 },
  { sessionId: 103, text: '실무에서 바로 써먹을 수 있을 것 같아요', sentiment: 'POS', keywords: ['실무'], minute: 72 },

  // ── 이벤트 43 (ENDED) ──────────────────────────────────────
  { sessionId: 201, text: '조직도 설명이 명확했습니다', sentiment: 'POS', keywords: ['조직소개'], minute: 5 },
  { sessionId: 201, text: '내용이 좀 많아서 정신없었어요', sentiment: 'NEG', keywords: ['분량'], minute: 8 },
  { sessionId: 202, text: '코드 리뷰 예시가 구체적이라 좋았어요', sentiment: 'POS', keywords: ['코드리뷰', '사례'], minute: 40 },
  { sessionId: 202, text: '리뷰 문화 얘기는 매번 듣지만 실천이 어렵죠', sentiment: 'NEU', keywords: ['코드리뷰'], minute: 43 },
  { sessionId: 202, text: '실습 시간이 있었으면 더 좋았을 것 같습니다', sentiment: 'NEU', keywords: ['실습'], minute: 45 },
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
    topKeywords: ['코드리뷰', '사례', '조직소개', '실습', '분량'],
    isPublic: true,
    generatedAt: '2026-07-20T08:30:00.000Z',
  },
];
