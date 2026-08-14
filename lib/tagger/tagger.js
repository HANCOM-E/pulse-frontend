// 태깅 순수 로직. 모델 호출은 없다 — 로짓만 받아서 라벨을 만든다.
// worker.js 와 sweep.mjs 가 이 파일을 공유한다.

export const TAGGER_VERSION = 'koelectra-small-v3-nsmc-q8+tau-1.2';

// 요구사항 명세서 「모델 버전 고정」: 임계값은 taggerVersion 하나에 묶인다.
// 182개 평가셋(튜닝 122 / 홀드아웃 60)으로 확정. 홀드아웃 macro F1 0.736.
// 스윕 최고점은 1.35였으나 1.00~1.50이 문장 1~2개 차이로 동률이라,
// 최고점 대신 양쪽 급락 지점에서 떨어진 구간 안쪽 값을 택했다.
// 근거: docs/tagger-validation.md
export const DEFAULT_NEU_MARGIN = 1.2;

// config.json 의 id2label 이 {"0":"0","1":"1"} 라 이름이 없다.
// 스파이크 UI 실측으로 POS_INDEX=1 확인 완료 (2026-08-14).
export const DEFAULT_POS_INDEX = 1;

// ── 층 1: margin 밴드 ────────────────────────────────────────────────

// 이진 로짓에서 margin 을 뽑는다. softmax 를 거치지 않는 이유는 포화 때문이다.
// 0.9999 와 0.999999 는 float 에서 거의 같아 보이지만 로짓 차이는 2배 넘게 난다.
export function marginOf(logits, posIndex = DEFAULT_POS_INDEX) {
  return logits[posIndex] - logits[1 - posIndex];
}

export function labelFromMargin(margin, tau = DEFAULT_NEU_MARGIN) {
  if (Math.abs(margin) < tau) return 'NEU';
  return margin > 0 ? 'POS' : 'NEG';
}

// ── 층 2: 규칙 보조 ──────────────────────────────────────────────────
// NSMC 는 영화 리뷰라 "감정 없는 문장"이 학습 데이터에 없다.
// 질문·사실 진술은 모델이 아무 데나 자신있게 꽂으므로 margin 으로 못 잡는다.

// 질문은 감정과 직교하는 축이다. sentiment 에 넣지 않고 별도 boolean 으로 뺀다.
// "설명이 빨랐는데 다시 해주실 수 있나요?" 는 NEG 이면서 질문이다.
const QUESTION_ENDING_RE =
  /(나요|까요|는지|인가|가요|어때|뭔가|맞죠|맞나|될까|할까|있을까|없을까|있나|없나)[\s.!~]*\??\s*$/;

const QUESTION_WORDS = [
  '어디',
  '언제',
  '누가',
  '무엇',
  '뭐가',
  '어떻게',
  '어떤',
  '얼마',
  '몇',
  '왜',
];

export function isQuestion(text) {
  const t = text.trim();
  if (!t) return false;
  if (t.includes('?')) return true;
  if (QUESTION_ENDING_RE.test(t)) return true;
  // 의문사가 있고 의문형 어미가 문장 안에 있으면 물음표가 없어도 질문으로 본다.
  if (QUESTION_WORDS.some((w) => t.includes(w)) && /(나요|까요|는지|인지|가요)/.test(t))
    return true;
  return false;
}

// 주의: 한국어 ㅂ 불규칙 때문에 사전형 어간이 활용형과 안 맞는다.
// "아쉽다"는 "아쉬웠습니다"가 되므로 '아쉽'으로는 못 잡는다. 공통 어간까지 잘라야 한다.
const POSITIVE_WORDS = [
  '좋',
  '유익',
  '재밌',
  '재미',
  '최고',
  '감사',
  '훌륭',
  '알차',
  '만족',
  '도움',
  '깔끔',
  '명확',
  '인상',
  '추천',
  '멋지',
  '멋있',
  '대박',
  '흥미',
  '쉽게',
  '쉬웠',
  '친절',
  '꼼꼼',
  '탄탄',
  '유용',
];

const NEGATIVE_WORDS = [
  '구려',
  '아쉬',
  '아쉽',
  '어려',
  '어렵',
  '지루',
  '별로',
  '실망',
  '부족',
  '불편',
  '난해',
  '산만',
  '길었',
  '길어',
  '빨랐',
  '빨라',
  '느렸',
  '느려',
  '모르겠',
  '안 들',
  '안들',
  '헷갈',
  '최악',
  '낭비',
  '불친절',
  '엉성',
  // 부정 서술. "강사님이 강의를 너무 못해요" 가 사전에 안 걸려 NEU 로 새던 케이스.
  '못하',
  '못해',
  '못했',
  '안 좋',
  '안좋',
  '그저',
  '글쎄',
  '대충',
  '성의',
  '억지',
  '따분',
  '심심',
  '아쉬움',
  '지겨',
];

/**
 * 규칙은 "모델이 구조적으로 못 하는 것"만 담당한다. 그 외에는 손대지 않는다.
 * 반환값이 null 이면 "규칙으로 판단 안 함" — 모델로 넘긴다.
 *
 * NSMC 는 영화 리뷰라 질문형 문장이 학습 데이터에 없다. 실측 결과 순수 질문 7건의
 * margin 이 -4.9 ~ +6.6 으로 퍼졌고 4건이 오분류였다. 크기가 커도 신호가 아니라
 * 잡음이므로 τ 밴드로는 막을 수 없다. 규칙은 여기서만 개입한다.
 *
 * 반대로 "감정 어휘가 사전에 없다"는 건 모델의 한계가 아니라 손사전의 한계다.
 * 예전에 있던 "감정어 0개 + 20자 이하 → NEU" 규칙은 이 둘을 혼동해서
 * "강사님이 강의를 너무 못해요"(margin -5.69, 모델은 정답)를 NEU 로 덮어썼다.
 * 확신 없는 건을 NEU 로 보내는 일은 τ 밴드가 이미 한다. 규칙이 낄 자리가 아니다.
 */
export function ruleLabel(text) {
  const t = text.trim();
  if (!t) return 'NEU';

  const hasPos = POSITIVE_WORDS.some((w) => t.includes(w));
  const hasNeg = NEGATIVE_WORDS.some((w) => t.includes(w));

  // 질문이면서 감정 어휘가 전혀 없을 때만 NEU 로 확정한다.
  // "설명이 어려웠는데 자료 주시나요?" 는 감정어가 있으므로 모델로 넘어간다.
  if (isQuestion(t) && !hasPos && !hasNeg) return 'NEU';

  return null;
}

// ── 욕설 필터 (모델 없이 코드로) ──────────────────────────────────────

const PROFANITY = [
  '시발',
  '씨발',
  '씨빨',
  '시빨',
  '병신',
  '븅신',
  '지랄',
  '좆',
  '개새',
  '개같',
  '새끼',
  '썅',
  '쌍놈',
  '엿먹',
  '꺼져',
  '닥쳐',
  '등신',
  '멍청이',
  '또라이',
];

// 초성·자모 우회
const PROFANITY_JAMO = ['ㅅㅂ', 'ㅄ', 'ㅂㅅ', 'ㅈㄹ', 'ㄲㅈ', 'ㅆㅂ'];

// 욕설 부분문자열을 포함하지만 정상인 단어. 오탐 방지용.
const PROFANITY_ALLOWLIST = ['시발점', '시발역', '시발자', '개새벽'];

/**
 * 공백·반복문자·특수문자를 걷어내 우회를 막는다.
 * "시 발", "시이이발", "시*발" 이 모두 "시발" 로 정규화된다.
 */
export function normalizeForProfanity(text) {
  return text
    .replace(/[^가-힣ㄱ-ㅎa-zA-Z0-9]/g, '')
    .replace(/(.)\1{1,}/g, '$1')
    .toLowerCase();
}

// "씨이이발" 처럼 늘임 음절을 끼워 넣는 우회에 대응한다.
// 반복 축약만으로는 "씨이발" 이 남아 사전에 안 걸린다.
const STRETCH_SYLLABLES = /[이으아어우]/g;

export function isToxic(text) {
  const raw = text.toLowerCase();

  // 정상 단어가 먼저 걸리면 그 부분을 빼고 검사한다.
  let stripped = raw;
  for (const ok of PROFANITY_ALLOWLIST) stripped = stripped.split(ok).join('');

  const norm = normalizeForProfanity(stripped);
  if (PROFANITY.some((w) => norm.includes(w))) return true;

  // 늘임 음절을 걷어낸 변형으로 한 번 더. 욕설 사전 매칭에만 쓰므로
  // 정상 단어가 이 변형에서 욕설이 되는 경우는 사실상 없다.
  const destretched = norm.replace(STRETCH_SYLLABLES, '');
  if (PROFANITY.some((w) => destretched.includes(w.replace(STRETCH_SYLLABLES, '')))) return true;

  if (PROFANITY_JAMO.some((w) => raw.includes(w))) return true;
  return false;
}

// ── 키워드 추출 (모델 없이 코드로) ────────────────────────────────────

// 뒤에서부터 잘라내는 조사·어미. 긴 것부터 시도해야 한다.
const PARTICLES = [
  '에서는',
  '으로는',
  '에게서',
  '이라고',
  '라고는',
  '에서',
  '으로',
  '에게',
  '까지',
  '부터',
  '이나',
  '라도',
  '처럼',
  '보다',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '에',
  '의',
  '와',
  '과',
  '도',
  '만',
  '로',
];

const STOPWORDS = new Set([
  // "몇 시에" 의 "시에" 는 조사 절단 대상이 아니다. 2글자 단어에서 1글자 조사를
  // 떼면 1글자가 남아 "평가·국가" 같은 정상 명사까지 날아가므로, 개별 등록으로 막는다.
  '시에',
  '나중',
  '정도',
  '경우',
  '자체',
  '이런',
  '저런',
  '그런',
  '그리고',
  '하지만',
  '그런데',
  '그래서',
  '너무',
  '정말',
  '진짜',
  '조금',
  '약간',
  '다시',
  '아주',
  '매우',
  '전체',
  '이번',
  '다음',
  '오늘',
  '내용',
  '생각',
  '부분',
  '어디',
  '어디서',
  '언제',
  '누가',
  '무슨',
  '하나',
  '전혀',
  '거의',
  '가장',
  '것',
  '거',
  '수',
  '때',
  '점',
  '분',
  '더',
  '좀',
  '잘',
  '안',
  '못',
]);

// 용언 활용형은 키워드로 쓸 수 없다. "좋았어요" 가 워드클라우드에 뜨면 안 된다.
// 형태소 분석기 없이 어미로 걸러내는 근사.
// 끝의 `는|은|던` 은 관형형 어미다. 조사로서의 `는` 은 PARTICLES 단계에서 이미
// 잘려나가므로, 여기까지 살아남은 것은 "받는·하는·있는" 같은 활용형뿐이다.
const VERB_ENDING_RE =
  /(어요|아요|에요|예요|해요|네요|나요|까요|군요|는데|습니다|ㅂ니다|였|았|었|겠|더라|든지|지만|아서|어서|하고|한다|된다|이다|하는|있는|없는|받는|되는|같은|던)$/;

export function extractKeywords(text, limit = 5) {
  const tokens = text
    .replace(/[^가-힣0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const freq = new Map();

  for (const raw of tokens) {
    let word = raw;

    // 조사 절단 — 자르고 나서도 2글자 이상 남을 때만.
    for (const p of PARTICLES) {
      if (word.length > p.length + 1 && word.endsWith(p)) {
        word = word.slice(0, -p.length);
        break;
      }
    }

    // 명세서 출력 계약: 각 키워드 1~20자
    if (word.length < 2 || word.length > 20) continue;
    if (STOPWORDS.has(word)) continue;
    if (VERB_ENDING_RE.test(word)) continue;

    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([w]) => w);
}

// ── 최종 조립 ────────────────────────────────────────────────────────

/**
 * 요구사항 명세서 「클라이언트 태깅 출력 계약」 그대로의 페이로드를 만든다.
 * logits 가 null 이면 태깅 실패로 간주한다.
 */
export function buildPayload(text, logits, opts = {}) {
  const { tau = DEFAULT_NEU_MARGIN, posIndex = DEFAULT_POS_INDEX, useRules = true } = opts;

  const toxic = isToxic(text);

  // 질문 판정은 규칙 기반이라 모델이 실패해도 살아남는다.
  const question = isQuestion(text);

  // 태깅 실패 — 명세서 고정값. taggerVersion 은 실패해도 그대로 보낸다.
  if (!logits) {
    return {
      text,
      sentiment: 'UNKNOWN',
      toxic: false,
      isQuestion: question,
      keywords: [],
      taggerVersion: TAGGER_VERSION,
      margin: null,
      source: 'fallback',
    };
  }

  const margin = marginOf(logits, posIndex);
  const rule = useRules ? ruleLabel(text) : null;
  const sentiment = rule ?? labelFromMargin(margin, tau);

  return {
    text,
    sentiment,
    toxic,
    isQuestion: question,
    keywords: extractKeywords(text),
    taggerVersion: TAGGER_VERSION,
    margin,
    source: rule ? 'rule' : 'model',
  };
}

// ── 평가 지표 ────────────────────────────────────────────────────────

export const LABELS = ['POS', 'NEU', 'NEG'];

/**
 * macro F1. 단순 정확도를 쓰면 다수 클래스에 유리하게 편향된다.
 * POS 90 / NEU 30 / NEG 30 분포에서 전부 POS 로 찍어도 정확도 60% 가 나온다.
 */
export function macroF1(rows, tau, posIndex = DEFAULT_POS_INDEX, useRules = true) {
  let sum = 0;

  for (const L of LABELS) {
    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (const r of rows) {
      const rule = useRules ? ruleLabel(r.text) : null;
      const pred = rule ?? labelFromMargin(marginOf(r.logits, posIndex), tau);

      if (pred === L && r.gold === L) tp += 1;
      else if (pred === L) fp += 1;
      else if (r.gold === L) fn += 1;
    }

    const prec = tp + fp ? tp / (tp + fp) : 0;
    const rec = tp + fn ? tp / (tp + fn) : 0;
    sum += prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  }

  return sum / LABELS.length;
}

export function confusionMatrix(rows, tau, posIndex = DEFAULT_POS_INDEX, useRules = true) {
  const m = {};
  for (const g of LABELS) {
    m[g] = {};
    for (const p of LABELS) m[g][p] = 0;
  }

  for (const r of rows) {
    const rule = useRules ? ruleLabel(r.text) : null;
    const pred = rule ?? labelFromMargin(marginOf(r.logits, posIndex), tau);
    if (m[r.gold]) m[r.gold][pred] += 1;
  }

  return m;
}

/** τ 를 0 부터 max 까지 훑어 macro F1 이 가장 높은 지점을 찾는다. */
export function sweepTau(
  rows,
  { max = 4, step = 0.05, posIndex = DEFAULT_POS_INDEX, useRules = true } = {},
) {
  const curve = [];
  let best = { tau: 0, f1: -1 };

  for (let tau = 0; tau <= max + 1e-9; tau += step) {
    const f1 = macroF1(rows, tau, posIndex, useRules);
    curve.push({ tau, f1 });
    if (f1 > best.f1) best = { tau, f1 };
  }

  return { curve, best };
}
