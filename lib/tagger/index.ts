import { keywordsSchema, sentimentSchema, type FeedbackSubmitRequest } from '@/lib/schemas/api';
import { buildPayload, TAGGER_VERSION } from './tagger';

/**
 * 클라이언트 태깅의 경계입니다.
 *
 * `tagger.js`는 스파이크(`감정모델/tagger.js`)에서 그대로 가져온 파일입니다.
 * τ 튜닝은 스파이크 UI에서 하고 결과 숫자만 그 파일에 옮깁니다. **직접 고치지 마세요.**
 * 두 벌이 갈리면 어느 쪽이 최신인지 알 수 없게 됩니다.
 *
 * 이 파일이 하는 일은 둘입니다.
 *   1. 제출 스키마에 없는 필드(`isQuestion`·`margin`·`source`)를 걷어냅니다
 *   2. `keywords`가 스키마 제약을 지키는지 실제로 검증합니다
 */

/** 제출 요청에서 `sessionId`만 뺀 모양입니다. 세션은 화면이 정합니다. */
type TagResult = Omit<FeedbackSubmitRequest, 'sessionId'>;

/**
 * `tagger.js`가 JS라 TS가 `sentiment`를 `string`으로 넓힙니다.
 *
 * `as`로 눌러도 되지만, 그러면 스키마에 없는 값이 들어와도 조용히 통과해서
 * 서버가 400을 줍니다. 태깅 실패는 `UNKNOWN`으로 떨어뜨리기로 했으므로(#82)
 * 여기서도 같은 규칙을 씁니다.
 */
const safeSentiment = (raw: unknown): FeedbackSubmitRequest['sentiment'] => {
  const parsed = sentimentSchema.safeParse(raw);
  return parsed.success ? parsed.data : 'UNKNOWN';
};

/**
 * 키워드는 타입으로 막을 수 없습니다.
 *
 * 스키마가 최대 5개·각 1~20자·중복 불가인데 `string[]` 타입은 21자짜리도 통과시킵니다.
 * 어기면 서버가 400을 주고, 그러면 태깅이 아니라 **제출 자체가 실패합니다.**
 *
 * 형태소 분석기 없이 조사를 잘라내는 근사라(스파이크 README "알려진 한계") 이상한 값이
 * 나올 수 있습니다. 키워드는 있으면 좋은 정보지 제출의 조건이 아니므로, 규칙을 어긴
 * 항목만 버리고 나머지는 살립니다.
 */
const safeKeywords = (raw: unknown): string[] => {
  const parsed = keywordsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  if (!Array.isArray(raw)) return [];

  const cleaned = [
    ...new Set(
      raw.filter(
        (value): value is string =>
          typeof value === 'string' && value.length >= 1 && value.length <= 20,
      ),
    ),
  ].slice(0, 5);

  const rechecked = keywordsSchema.safeParse(cleaned);
  return rechecked.success ? rechecked.data : [];
};

/**
 * 로짓이 이진 분류 결과인지 확인합니다.
 *
 * `marginOf`는 `logits[a] - logits[b]`라 빈 배열이면 `NaN`이 나오고,
 * `labelFromMargin`이 그걸 `NEG`로 떨어뜨립니다. 실패가 부정으로 둔갑합니다.
 */
const isBinaryLogits = (value: number[] | null): value is number[] =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

/**
 * 로짓을 받아 제출 payload를 만듭니다.
 *
 * `logits`가 `null`이거나 형식이 틀리면 태깅 실패로 봅니다 — 모델 로딩 실패,
 * 타임아웃(3초), 미지원 브라우저, 그리고 길이가 2가 아니거나 유한하지 않은 값이
 * 섞인 경우가 여기로 옵니다.
 */
const toSubmitPayload = (text: string, logits: number[] | null): TagResult => {
  // 형식이 틀리면 태깅 실패와 같게 취급합니다. buildPayload가 UNKNOWN으로 떨어뜨립니다.
  const payload = buildPayload(text, isBinaryLogits(logits) ? logits : null);

  return {
    text: payload.text,
    sentiment: safeSentiment(payload.sentiment),
    toxic: payload.toxic,
    keywords: safeKeywords(payload.keywords),
    taggerVersion: payload.taggerVersion,
  };
};

export { toSubmitPayload, TAGGER_VERSION };
export type { TagResult };
