/**
 * 감정 태깅 평가 하네스.
 *
 * `docs/tagger-eval/*.txt`(문장\t라벨 TSV)를 읽어 모델을 돌리고 macro F1·혼동행렬·
 * τ 스윕·오분류 목록을 냅니다. 라벨 규칙은 `lib/tagger/tagger.js`를 그대로 씁니다 —
 * 여기에 판정 로직을 다시 쓰지 않습니다. 두 벌이 갈리면 측정값이 거짓이 됩니다.
 *
 * ── 브라우저와 숫자가 다를 수 있습니다 ──────────────────────────────
 * 워커(`lib/tagger/tagger.worker.ts`)는 WebGPU를 먼저 잡고 실패해야 WASM으로 갑니다.
 * 이 스크립트는 노드라 실행 프로바이더가 `cpu`뿐입니다. 같은 q8 가중치라도 EP가 다르면
 * 로짓 끝자리가 달라질 수 있고, margin이 τ 근처인 문장은 라벨이 갈릴 수 있습니다.
 * 그래서 수집 TSV의 4번째 열(브라우저가 실제로 붙인 예측)과 대조하는 기능을 넣었습니다.
 * 불일치가 나오면 그건 데이터가 아니라 **실행 환경 차이**입니다.
 *
 * ── 쓰는 법 ─────────────────────────────────────────────────────────
 *   npm run tagger:eval                          # docs/tagger-eval/ 전체
 *   npm run tagger:eval -- --sweep               # τ 스윕까지
 *   npm run tagger:eval -- --tau 1.5             # τ 바꿔서 한 번
 *   npm run tagger:eval -- --files real-*.txt    # 특정 파일만
 *   npm run tagger:eval -- --no-cache            # 로짓 캐시 무시하고 재추론
 *
 * 로짓은 `docs/tagger-eval/.logits-cache.json`에 텍스트 기준으로 캐싱합니다.
 * τ만 바꿔 다시 볼 때 13.9MB 모델을 다시 돌리지 않으려는 것입니다. 모델 파일이나
 * 토크나이저를 바꿨다면 `--no-cache`로 한 번 밀어야 합니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AutoModelForSequenceClassification, AutoTokenizer, env } from '@huggingface/transformers';

import {
  DEFAULT_NEU_MARGIN,
  LABELS,
  TAGGER_VERSION,
  confusionMatrix,
  labelFromMargin,
  macroF1,
  marginOf,
  ruleLabel,
  sweepTau,
} from '../lib/tagger/tagger.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVAL_DIR = path.join(ROOT, 'docs', 'tagger-eval');
const CACHE_PATH = path.join(EVAL_DIR, '.logits-cache.json');
const MODEL_ID = 'koelectra-small-v3-nsmc';

// ── 인자 ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};

const tau = Number(option('tau', DEFAULT_NEU_MARGIN));
const useCache = !flag('no-cache');
const filePatterns = option('files', null);

if (!Number.isFinite(tau)) {
  console.error(`--tau 값이 숫자가 아닙니다: ${option('tau')}`);
  process.exit(1);
}

// ── TSV 읽기 ─────────────────────────────────────────────────────────

/**
 * `문장\t라벨` 또는 `문장\t라벨\t비고\t브라우저예측` 형식을 읽습니다.
 * 3번째 열부터는 선택입니다. 4번째 열은 수집 스니펫이 채우는 "그때 화면에 뜬 값"입니다.
 */
const readTsv = (file) => {
  const rows = [];
  const lines = fs.readFileSync(path.join(EVAL_DIR, file), 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const [text, gold, note, deployed] = trimmed.split('\t');

    // 라벨이 안 붙은 줄은 조용히 넘기지 않고 셉니다. 라벨링 누락을 모르고 지나가면
    // 평가셋이 실제보다 작아진 걸 눈치채지 못합니다.
    if (!gold) {
      rows.push({ file, line: index + 1, text, gold: null, note, deployed });
      return;
    }

    const label = gold.trim().toUpperCase();
    if (!LABELS.includes(label)) {
      console.error(`${file}:${index + 1} 알 수 없는 라벨 "${gold}" — POS/NEU/NEG만 됩니다.`);
      process.exit(1);
    }

    rows.push({
      file,
      line: index + 1,
      text,
      gold: label,
      note,
      deployed: deployed?.trim().toUpperCase() || null,
    });
  });

  return rows;
};

const matchesPattern = (name) => {
  if (filePatterns === null) return true;
  return filePatterns
    .split(',')
    .some((raw) =>
      new RegExp(`^${raw.trim().replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`).test(name),
    );
};

const files = fs
  .readdirSync(EVAL_DIR)
  .filter((name) => name.endsWith('.txt'))
  .filter(matchesPattern)
  .sort();

if (files.length === 0) {
  console.error(`${EVAL_DIR} 에서 읽을 .txt 가 없습니다.`);
  process.exit(1);
}

const all = files.flatMap(readTsv);
const unlabeled = all.filter((r) => r.gold === null);
const rows = all.filter((r) => r.gold !== null);

if (rows.length === 0) {
  console.error('라벨이 붙은 줄이 하나도 없습니다.');
  process.exit(1);
}

// ── 추론 ─────────────────────────────────────────────────────────────

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = path.join(ROOT, 'public', 'models') + path.sep;

const cache =
  useCache && fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) : {};

const missing = rows.filter((r) => cache[r.text] === undefined);

if (missing.length > 0) {
  process.stderr.write(`모델 로딩 중… (${missing.length}건 추론 필요)\n`);

  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  // 노드 onnxruntime은 cuda/webgpu/cpu만 받습니다. 워커의 'wasm'과 다릅니다.
  const model = await AutoModelForSequenceClassification.from_pretrained(MODEL_ID, {
    device: 'cpu',
    dtype: 'q8',
  });

  for (const [index, row] of missing.entries()) {
    const output = await model(await tokenizer(row.text, { truncation: true }));
    cache[row.text] = output.logits.tolist()[0];

    if ((index + 1) % 20 === 0) process.stderr.write(`  ${index + 1}/${missing.length}\n`);
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

for (const row of rows) row.logits = cache[row.text];

// ── 출력 ─────────────────────────────────────────────────────────────

const predict = (row) => ruleLabel(row.text) ?? labelFromMargin(marginOf(row.logits), tau);

const pct = (value) => (value * 100).toFixed(1).padStart(5);

console.log(`\n태거 버전  ${TAGGER_VERSION}`);
console.log(`τ          ${tau}`);
console.log(`실행 EP    cpu (브라우저는 webgpu 우선 — 위 주석 참고)`);
console.log(`평가 대상  ${rows.length}건 / ${files.length}개 파일`);

if (unlabeled.length > 0) {
  console.log(`\n⚠ 라벨 없는 줄 ${unlabeled.length}건 — 집계에서 뺐습니다.`);
  for (const row of unlabeled.slice(0, 10)) {
    console.log(`   ${row.file}:${row.line}  ${row.text}`);
  }
  if (unlabeled.length > 10) console.log(`   … 외 ${unlabeled.length - 10}건`);
}

/**
 * 파일명으로 세트를 가릅니다. `tuning-base.txt`·`real-tuning-01.txt` → 튜닝.
 *
 * 세트별 숫자가 파일별 숫자보다 중요합니다. 파일 하나가 10건짜리면 macro F1이
 * 요동쳐서(`holdout-add.txt` 단독 0.433) 성능이 아니라 표본 크기를 보게 됩니다.
 */
const setOf = (file) =>
  file.includes('holdout') ? '홀드아웃' : file.includes('tuning') ? '튜닝' : '미분류';

const setNames = [...new Set(rows.map((r) => setOf(r.file)))].sort();

console.log('\n세트별 macro F1');
for (const name of setNames) {
  const group = rows.filter((r) => setOf(r.file) === name);
  console.log(
    `  ${name.padEnd(10)} n=${String(group.length).padStart(4)}  ${macroF1(group, tau).toFixed(3)}`,
  );
}
console.log(
  `  ${'── 전체'.padEnd(10)} n=${String(rows.length).padStart(4)}  ${macroF1(rows, tau).toFixed(3)}`,
);

if (setNames.includes('미분류')) {
  console.log(
    '\n  ⚠ 파일명에 tuning/holdout이 없는 파일이 있습니다. 세트 분리는 이름으로 판단합니다.',
  );
}

console.log('\n파일별 (참고 — 건수가 적으면 요동칩니다)');
for (const name of files) {
  const group = rows.filter((r) => r.file === name);
  if (group.length === 0) continue;
  console.log(
    `  ${name.padEnd(24)} n=${String(group.length).padStart(4)}  ${macroF1(group, tau).toFixed(3)}`,
  );
}

// 혼동행렬
const matrix = confusionMatrix(rows, tau);
console.log('\n혼동행렬 (행=정답, 열=예측)');
console.log(`  ${''.padEnd(8)}${LABELS.map((l) => l.padStart(6)).join('')}${'계'.padStart(7)}`);
for (const gold of LABELS) {
  const total = LABELS.reduce((sum, p) => sum + matrix[gold][p], 0);
  console.log(
    `  ${gold.padEnd(8)}${LABELS.map((p) => String(matrix[gold][p]).padStart(6)).join('')}${String(total).padStart(7)}`,
  );
}

// 클래스별 정밀도·재현율
console.log('\n클래스별');
console.log('  라벨    정밀도   재현율      F1   건수');
for (const label of LABELS) {
  const tp = matrix[label][label];
  const fp = LABELS.reduce((sum, g) => sum + (g === label ? 0 : matrix[g][label]), 0);
  const fn = LABELS.reduce((sum, p) => sum + (p === label ? 0 : matrix[label][p]), 0);
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  console.log(
    `  ${label.padEnd(6)}${pct(precision)}%  ${pct(recall)}%  ${f1.toFixed(3).padStart(6)}  ${String(tp + fn).padStart(5)}`,
  );
}
console.log(
  `  ${'macro'.padEnd(6)}${''.padStart(16)}${macroF1(rows, tau).toFixed(3).padStart(6)}  ${String(rows.length).padStart(5)}`,
);

// 오분류
const wrong = rows.filter((r) => predict(r) !== r.gold);
console.log(`\n오분류 ${wrong.length}건 (${((wrong.length / rows.length) * 100).toFixed(1)}%)`);
for (const row of wrong) {
  const rule = ruleLabel(row.text);
  const source = rule ? 'rule ' : 'model';
  console.log(
    `  ${row.gold}→${predict(row)}  m=${marginOf(row.logits).toFixed(2).padStart(6)}  ${source}  ${row.text}`,
  );
}

// 브라우저 예측과 대조 — 수집 TSV에 4번째 열이 있을 때만
const comparable = rows.filter((r) => r.deployed && LABELS.includes(r.deployed));
if (comparable.length > 0) {
  const drift = comparable.filter((r) => predict(r) !== r.deployed);
  console.log(`\n브라우저 예측과 대조 (${comparable.length}건 중 불일치 ${drift.length}건)`);
  console.log('  불일치는 라벨 문제가 아니라 실행 환경(webgpu vs cpu) 차이 신호입니다.');
  for (const row of drift) {
    console.log(
      `  배포=${row.deployed} 로컬=${predict(row)}  m=${marginOf(row.logits).toFixed(2).padStart(6)}  ${row.text}`,
    );
  }
}

// τ 스윕 — 튜닝셋으로만 돕니다
if (flag('sweep')) {
  // 홀드아웃으로 τ를 고르는 순간 홀드아웃이 아니게 됩니다(docs/tagger-validation.md §4).
  // 스크립트가 그걸 막습니다. 굳이 전체로 보려면 --sweep-all.
  const sweepRows = flag('sweep-all') ? rows : rows.filter((r) => setOf(r.file) === '튜닝');

  if (sweepRows.length === 0) {
    console.log('\nτ 스윕 — 튜닝셋이 없습니다. 파일명에 tuning을 넣거나 --sweep-all을 쓰세요.');
    process.exit(0);
  }

  const { curve, best } = sweepTau(sweepRows);
  console.log(`\nτ 스윕 (${flag('sweep-all') ? '전체' : '튜닝셋'} ${sweepRows.length}건)`);
  for (const point of curve) {
    if (Math.abs(point.tau * 4 - Math.round(point.tau * 4)) > 1e-9) continue; // 0.25 간격만 표시
    const mark = Math.abs(point.tau - tau) < 1e-9 ? ' ← 현재' : '';
    console.log(`  τ=${point.tau.toFixed(2)}  ${point.f1.toFixed(3)}${mark}`);
  }
  console.log(`\n  최고점 τ=${best.tau.toFixed(2)} (F1 ${best.f1.toFixed(3)})`);
  console.log(
    '  ⚠ 이 값을 그대로 채택하지 마세요. 최고점은 표본이 조금만 바뀌어도 크게 움직입니다',
  );
  console.log('    (docs/tagger-validation.md §3). 홀드아웃으로 고르면 홀드아웃이 아니게 됩니다.');
}

console.log('');
