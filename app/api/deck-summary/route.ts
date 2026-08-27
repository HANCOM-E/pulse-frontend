import { ApiError } from '@/lib/apiClient';
import { fetchSessionReport, fetchSessionsByEventCode } from '@/lib/api/endpoints';
import { DECK_TEXT_MAX_LENGTH, MIN_DECK_TEXT_LENGTH } from '@/lib/deck/limits';
import { MATERIAL_SUMMARY_MAX_LENGTH } from '@/lib/schemas/api';

/**
 * 발표 자료 텍스트를 한 문단으로 줄입니다(강연자 화면 전용).
 *
 * 만들어진 요약은 화면이 그대로 들고 있다가 세션 리포트 생성 요청의 `materialSummary`에 실어
 * 보냅니다. 그게 이 값의 유일한 목적지입니다 — 여기서 저장하지도, 백엔드에 직접 넣지도
 * 않습니다. 소감 요약과 리포트 본문은 전부 백엔드가 만듭니다(pulse-backend#43).
 *
 * 원본 파일은 이 서버에 오지 않습니다. 브라우저가 `lib/deck/extractDeckText.ts`로 텍스트만
 * 뽑아 보냅니다. 이유는 그쪽 주석에 있습니다.
 *
 * ── 키를 서버에 두는 이유 ──
 * `OPENROUTER_API_KEY`에 `NEXT_PUBLIC_` 접두사가 없어서 브라우저 번들에 실리지 않습니다.
 * 강연자 화면은 로그인이 없는 공개 페이지라, 키가 번들에 들어가면 주소를 아는 누구나 꺼내
 * 우리 크레딧을 쓸 수 있습니다.
 *
 * ── 인증이 없는데 남용을 어떻게 막는가 ──
 * 강연자에게는 계정이 없습니다(BE가 세션 리포트 생성을 비인증으로 연 것도 같은 이유입니다).
 * 그래서 인증 대신 **BE가 쓰는 방어를 본떠서** 모델을 부르기 전에 두 가지를 확인합니다.
 *
 * 1. 실재하는 세션인가 — 프롬프트에 들어갈 세션 제목을 여기서 가져오면서 함께 걸러집니다.
 * 2. 그 세션에 리포트가 이미 있는가 — 있으면 생성이 멱등으로 막히므로 요약도 쓸 데가 없습니다.
 *
 * 걸리면 모델을 아예 부르지 않습니다. 남는 표면은 "아직 리포트가 없는 세션" 수뿐이라 세션당
 * 사실상 1회로 묶입니다. 여기에 입력·출력 글자 수 상한이 붙어 요청당 비용도 묶입니다.
 *
 * BE의 `CLOSED` 게이트는 **일부러 복사하지 않았습니다.** 그쪽은 리포트를 만드는 시점의
 * 조건이고, 자료 요약은 그 전에 미리 준비해두는 값입니다. 여기까지 마감을 요구하면 강연자가
 * 발표 중에는 아무것도 못 하고, 세션이 닫힌 뒤 좁은 시간에 자료 첨부·요약 대기·리포트 생성을
 * 몰아서 해야 합니다. 막아서 얻는 것(세션 수 단위의 표면 축소)보다 잃는 게 큽니다.
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
 * 요약 본문의 상한입니다. 아래 프롬프트가 요구하는 분량(700자 안팎)의 두 배 남짓입니다.
 *
 * 추론을 끄고도 남기는 이유는 모델마다 `effort: 'none'` 지원이 다르기 때문입니다. 무시하는
 * 모델을 만나도 본문이 통째로 잘리지는 않게 하는 완충입니다. 남용 시 비용 상한 역할도 합니다.
 */
const MAX_TOKENS = 1200;

/**
 * 요약에 요구하는 분량입니다. 계약 상한(2000자)보다 한참 낮게 잡습니다.
 *
 * 이 값은 사람이 읽을 최종 결과가 아니라 **BE의 리포트 프롬프트에 들어갈 재료**입니다. 저쪽은
 * 이 문단에 세션 소감까지 얹어 다시 요약하므로, 자료 쪽이 길수록 소감의 비중이 밀립니다.
 */
const TARGET_LENGTH = 500;

/**
 * 실패 원인을 응답에 실을지입니다. 502만 돌려주고 끝내면 어디가 틀렸는지 알 방법이 없어서,
 * 개발 중에는 업스트림 응답을 그대로 보여줍니다. 프로덕션에서는 내보내지 않습니다.
 */
const isDevelopment = process.env.NODE_ENV !== 'production';

const buildPrompt = (sessionTitle: string, deckText: string): string =>
  [
    `아래는 "${sessionTitle}" 세션의 발표 자료에서 뽑은 텍스트입니다.`,
    '슬라이드에서 기계적으로 추출한 것이라 문장이 끊기거나 순서가 어색할 수 있습니다.',
    '',
    '발표 자료:',
    deckText,
    '',
    `위 자료가 무엇을 다뤘는지 공백 포함 ${TARGET_LENGTH}자 안팎의 한국어 단락 하나로 요약해 주세요.`,
    '주제, 다룬 내용의 흐름, 강조된 결론을 담되 목록이 아니라 이어지는 문장으로 쓰세요.',
    '자료에 없는 내용이나 숫자를 지어내지 마세요.',
    '요약문만 출력하고 머리말이나 맺음말은 붙이지 마세요.',
  ].join('\n');

/**
 * 계약 상한에서 자릅니다. BE가 `@Size(max=2000)`으로 막아서, 넘겨 보내면 400입니다.
 *
 * 문장 중간에서 끊길 수 있지만 그대로 둡니다. 마지막 문장을 통째로 버리는 방법도 있는데,
 * 모델이 상한을 넘기는 건 프롬프트를 무시한 예외적인 경우라 그때 몇 글자를 다듬는 것보다
 * 요청이 통과하는 게 중요합니다.
 */
const capMaterialSummary = (text: string): string =>
  text.trim().slice(0, MATERIAL_SUMMARY_MAX_LENGTH);

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

  const { eventCode, sessionId, text } = (body ?? {}) as {
    eventCode?: unknown;
    sessionId?: unknown;
    text?: unknown;
  };

  if (
    typeof eventCode !== 'string' ||
    typeof sessionId !== 'number' ||
    !Number.isInteger(sessionId) ||
    typeof text !== 'string' ||
    text.trim() === ''
  ) {
    return Response.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'eventCode(string)·sessionId(number)·text(string)가 필요합니다.',
      },
      { status: 400 },
    );
  }

  /*
   * 클라이언트가 이미 자르지만 여기서 한 번 더 자릅니다. 이 경로에 인증이 없어서, 브라우저를
   * 거치지 않고 직접 부르면 얼마든지 긴 본문을 실을 수 있습니다.
   */
  const deckText = text.slice(0, DECK_TEXT_MAX_LENGTH);

  /*
   * 받은 글자 수를 남깁니다. 모델이 "자료에 내용이 없다"고 답하거나 엉뚱한 내용을 지어냈을 때,
   * 추출이 빈 건지 모델이 이상한 건지를 로그만 보고 가릅니다. 본문은 남기지 않습니다 — 발표
   * 자료 내용이 서버 로그에 쌓일 이유가 없습니다.
   */
  if (isDevelopment) {
    console.log('[deck-summary] 받은 자료 텍스트', deckText.length, '자');
  }

  /*
   * 너무 짧으면 모델을 부르지 않습니다. 이유는 `MIN_DECK_TEXT_LENGTH` 주석에 있습니다.
   * 추출 단계의 `NO_TEXT_LAYER`와 같은 사유라 같은 코드로 돌려줘서 화면 문구를 하나로 씁니다.
   */
  if (deckText.length < MIN_DECK_TEXT_LENGTH) {
    return Response.json(
      { code: 'NO_TEXT_LAYER', message: '자료에서 읽어낸 글자가 너무 적습니다.' },
      { status: 422 },
    );
  }

  try {
    /* 세션 제목은 프롬프트에 들어가므로 실재하는 세션인지 여기서 함께 걸러집니다. */
    const sessions = await fetchSessionsByEventCode(eventCode);
    const session = sessions.find((item) => item.id === sessionId);

    if (!session) {
      return Response.json(
        { code: 'SESSION_NOT_FOUND', message: '세션을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    /*
     * 리포트가 이미 있으면 요약을 만들어도 쓸 데가 없습니다. 생성이 세션당 멱등이라
     * `REPORT_ALREADY_EXISTS`로 막히기 때문입니다. 없을 때만 404가 오고, 그게 정상 경로입니다.
     *
     * `FAILED`는 BE가 같은 행을 재사용해 재시도를 허용하므로 통과시킵니다.
     */
    try {
      const existing = await fetchSessionReport(eventCode, sessionId);

      if (existing.status !== 'FAILED') {
        return Response.json(
          { code: 'REPORT_ALREADY_EXISTS', message: '이 세션의 리포트가 이미 있습니다.' },
          { status: 409 },
        );
      }
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'REPORT_NOT_FOUND') throw error;
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
         * 응답에서 숨기기만 해서 비용이 그대로 나갑니다. 이 작업은 슬라이드 텍스트를 한
         * 문단으로 줄이는 일이라 추론이 필요하지 않습니다.
         */
        reasoning: { effort: 'none' },
        /* 실제 과금 토큰과 비용을 응답에 실어달라고 요청합니다. 모델 비교의 근거가 됩니다. */
        usage: { include: true },
        messages: [{ role: 'user', content: buildPrompt(session.title, deckText) }],
      }),
    });

    if (!completion.ok) {
      const detail = await completion.text();
      console.error('[deck-summary] OpenRouter 응답 실패', completion.status, detail);
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
    const summary = choice?.message?.content;

    /*
     * 본문이 비는 원인은 대개 잘림입니다. 사유를 나눠야 로그만 보고 `max_tokens`를 올릴지
     * 추론 설정을 볼지 판단할 수 있습니다.
     */
    if (typeof summary !== 'string' || summary.trim() === '') {
      if (choice?.finish_reason === 'length') {
        console.error('[deck-summary] 본문이 잘렸습니다 — max_tokens 또는 추론 설정을 확인하세요');
      }
      console.error('[deck-summary] 본문이 비어 있습니다', JSON.stringify(data));
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
      console.log(
        '[deck-summary] usage',
        MODEL,
        JSON.stringify((data as { usage?: unknown })?.usage),
      );
    }

    return Response.json({ text: capMaterialSummary(summary) });
  } catch (error) {
    console.error('[deck-summary] 요약 생성 실패', error);
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
