import { fetchFeedbackSnapshot, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import type { FeedbackSnapshot } from '@/lib/schemas/api';

/**
 * 세션 하나의 소감을 AI로 요약합니다(강연자 화면 전용).
 *
 * 주최자 리포트(`POST /events/{code}/report/generate`)를 쓰지 않는 이유는 셋입니다.
 * 그쪽은 (1) 주최자 계정이 있어야 하고, (2) 이벤트가 `ENDED`여야 하며, (3) `Report`에
 * `sessionId`가 없어서 애초에 이벤트 전체 요약입니다. 강연자가 자기 세션 것을 발표 직후에
 * 받으려면 지금 계약으로는 길이 없습니다.
 *
 * 그래서 백엔드(`pulse-backend`) 대신 이 레포의 Route Handler에서 부릅니다. 백엔드 담당자를
 * 거치지 않고 프론트 PR 하나로 끝납니다.
 *
 * ── 키를 서버에 두는 이유 ──
 * `OPENROUTER_API_KEY`에 `NEXT_PUBLIC_` 접두사가 없어서 브라우저 번들에 실리지 않습니다.
 * 강연자 화면은 로그인이 없는 공개 페이지라, 키가 번들에 들어가면 주소를 아는 누구나 꺼내
 * 우리 크레딧을 쓸 수 있습니다.
 *
 * 브라우저에서 직접 부르고 싶다면 `hooks/useSpeakerSummary.ts` 맨 위 주석에 바꿀 부분을
 * 적어뒀습니다(OpenRouter는 Anthropic과 달리 CORS를 열어둬서 동작은 합니다).
 *
 * ── 소감 본문을 클라이언트에서 받지 않는 이유 ──
 * 이 경로에는 인증이 없습니다. 본문을 그대로 받아 모델에 넘기면 누구나 우리 크레딧으로
 * 아무 프롬프트나 돌리는 무료 프록시가 됩니다. 그래서 `eventCode`·`sessionId`만 받고 소감은
 * 서버가 공개 API로 직접 받아옵니다. 프롬프트도 서버가 조립합니다.
 */

/**
 * 모델은 환경변수로 뺍니다. OpenRouter는 모델이 자주 바뀌어서 코드에 박으면 금방 낡습니다.
 *
 * 기본값은 팀이 쓰기로 한 모델과 같아야 합니다. 배포 환경에는 키만 넣고 이 변수는 두지 않기로
 * 해서, 폴백이 항상 발동합니다 — 즉 이 기본값이 곧 배포에서 도는 모델입니다. 여기가 다른 값이면
 * 로컬과 배포가 서로 다른 모델로 돌고, 로컬에서 멀쩡한 요약이 배포에서만 깨져도 원인을 짚기
 * 어렵습니다.
 */
const MODEL = process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.7-flash';

/**
 * 요약 본문의 상한입니다. 3~4문장 한국어면 250토큰 안쪽이라 두 배 남짓 여유를 뒀습니다.
 *
 * 추론을 끄고도 남기는 이유는 모델마다 `effort: 'none'` 지원이 다르기 때문입니다. 무시하는
 * 모델을 만나도 본문이 통째로 잘리지는 않게 하는 완충입니다. 남용 시 비용 상한 역할도 합니다.
 */
const MAX_TOKENS = 1000;

/**
 * 실패 원인을 응답에 실을지입니다. 502만 돌려주고 끝내면 어디가 틀렸는지 알 방법이 없어서,
 * 개발 중에는 업스트림 응답을 그대로 보여줍니다. 프로덕션에서는 내보내지 않습니다.
 */
const isDevelopment = process.env.NODE_ENV !== 'production';

/** 모델에 넘길 소감 개수 상한입니다. 스냅샷이 최대 50건이라 사실상 전량입니다. */
const MAX_FEEDBACKS = 50;

const buildPrompt = (sessionTitle: string, snapshot: FeedbackSnapshot): string => {
  const { POS, NEU, NEG } = snapshot.sentimentBreakdown;
  const keywords = snapshot.topKeywords.map((item) => item.keyword).join(', ');
  const texts = snapshot.recentFeedbacks
    .slice(0, MAX_FEEDBACKS)
    .map((feedback) => `- ${feedback.text}`)
    .join('\n');

  return [
    `아래는 "${sessionTitle}" 세션에 참가자들이 남긴 소감입니다.`,
    '',
    `감정 분포: 긍정 ${POS}건, 중립 ${NEU}건, 부정 ${NEG}건 (미분류 ${snapshot.unclassifiedCount}건)`,
    keywords.length > 0 ? `자주 언급된 키워드: ${keywords}` : '',
    '',
    '소감:',
    texts,
    '',
    '위 내용을 강연자가 읽을 3~4문장짜리 한국어 단락 하나로 요약해 주세요.',
    '전반적인 반응, 자주 나온 칭찬, 개선 요청을 담되 목록이 아니라 이어지는 문장으로 쓰세요.',
    '주어진 소감에 없는 내용이나 숫자를 지어내지 마세요.',
  ]
    .filter((line) => line !== '')
    .join('\n');
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    /* 설정 누락과 호출 실패는 다음 행동이 달라서 코드를 나눕니다. 이건 개발자가 고칠 일입니다. */
    return Response.json(
      { code: 'SUMMARY_NOT_CONFIGURED', message: 'OPENROUTER_API_KEY가 설정되지 않았습니다.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { code: 'VALIDATION_ERROR', message: '본문이 JSON이 아닙니다.' },
      { status: 400 },
    );
  }

  const { eventCode, sessionId } = (body ?? {}) as { eventCode?: unknown; sessionId?: unknown };

  if (
    typeof eventCode !== 'string' ||
    typeof sessionId !== 'number' ||
    !Number.isInteger(sessionId)
  ) {
    return Response.json(
      { code: 'VALIDATION_ERROR', message: 'eventCode(string)와 sessionId(number)가 필요합니다.' },
      { status: 400 },
    );
  }

  try {
    /* 세션 제목은 프롬프트에 들어가므로 실재하는 세션인지 여기서 함께 걸러집니다. */
    const [sessions, snapshot] = await Promise.all([
      fetchSessionsByEventCode(eventCode),
      fetchFeedbackSnapshot(eventCode, sessionId),
    ]);

    const session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      return Response.json(
        { code: 'SESSION_NOT_FOUND', message: '세션을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (snapshot.recentFeedbacks.length === 0) {
      return Response.json(
        { code: 'NO_FEEDBACK', message: '요약할 소감이 아직 없습니다.' },
        { status: 409 },
      );
    }

    const completion = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        /*
         * 추론을 끕니다. 켜두면 추론 토큰이 `max_tokens`를 통째로 먹고 본문이 빈 채로
         * `finish_reason: "length"`가 옵니다(2026-08-25 qwen3.7-flash 실측 — 500토큰을
         * 영어 사고 과정에 다 쓰고 요약을 한 글자도 못 냈습니다).
         *
         * `exclude: true`가 아니라 `effort: 'none'`입니다. 저쪽은 추론을 생성은 하고
         * 응답에서 숨기기만 해서 비용이 그대로 나갑니다. 이 작업은 소감 몇십 건을 한 문단으로
         * 줄이는 일이라 추론이 필요하지 않습니다.
         */
        reasoning: { effort: 'none' },
        /* 실제 과금 토큰과 비용을 응답에 실어달라고 요청합니다. 모델 비교의 근거가 됩니다. */
        usage: { include: true },
        messages: [{ role: 'user', content: buildPrompt(session.title, snapshot) }],
      }),
    });

    if (!completion.ok) {
      const detail = await completion.text();
      console.error('[summary] OpenRouter 응답 실패', completion.status, detail);
      return Response.json(
        {
          code: 'SUMMARY_FAILED',
          message: `모델 호출이 실패했습니다 (${completion.status}).`,
          ...(isDevelopment ? { detail } : {}),
        },
        { status: 502 },
      );
    }

    const data: unknown = await completion.json();
    const choice = (
      data as { choices?: { finish_reason?: unknown; message?: { content?: unknown } }[] }
    )?.choices?.[0];
    const text = choice?.message?.content;

    /*
     * 본문이 비는 원인은 대개 잘림입니다. 사유를 나눠야 로그만 보고 `max_tokens`를 올릴지
     * 추론 설정을 볼지 판단할 수 있습니다.
     */
    if (typeof text !== 'string' || text.trim() === '') {
      if (choice?.finish_reason === 'length') {
        console.error('[summary] 본문이 잘렸습니다 — max_tokens 또는 추론 설정을 확인하세요');
      }
      console.error('[summary] 본문이 비어 있습니다', JSON.stringify(data));
      return Response.json(
        {
          code: 'SUMMARY_FAILED',
          message: '모델이 빈 응답을 돌려줬습니다.',
          ...(isDevelopment ? { detail: data } : {}),
        },
        { status: 502 },
      );
    }

    if (isDevelopment) {
      console.log('[summary] usage', MODEL, JSON.stringify((data as { usage?: unknown })?.usage));
    }

    return Response.json({ text: text.trim() });
  } catch (error) {
    console.error('[summary] 요약 생성 실패', error);
    return Response.json(
      {
        code: 'SUMMARY_FAILED',
        message: '요약을 만들지 못했습니다.',
        ...(isDevelopment ? { detail: String(error) } : {}),
      },
      { status: 502 },
    );
  }
}
