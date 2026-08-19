/**
 * 실사용 소감 수집 스니펫. **노드가 아니라 브라우저 콘솔에서 돌립니다.**
 *
 * 인증이 HttpOnly 쿠키라(`lib/apiClient.ts`) 노드 스크립트로는 `/admin/feedbacks`를
 * 부를 수 없습니다. FE가 토큰을 읽을 방법이 아예 없고, 브라우저가 붙이게 맡기는 구조입니다.
 * 그래서 로그인된 탭에서 그대로 실행합니다.
 *
 * ── 쓰는 법 ─────────────────────────────────────────────────────────
 *   1. 배포 사이트에 주최자 계정으로 로그인
 *   2. F12 → Console
 *   3. 이 파일 내용을 통째로 붙여넣고 Enter
 *   4. `tagger-eval-수집.txt` 가 다운로드됨
 *   5. 파일을 docs/tagger-eval/ 로 옮기고 라벨 열을 채움
 *
 * ── 내보내는 형식 ───────────────────────────────────────────────────
 *   문장 \t 라벨(빈칸) \t 비고 \t 배포예측
 *
 * 라벨 열은 비어 있습니다. 사람이 채웁니다 — `docs/tagger-eval/라벨링-가이드.md` 참고.
 * 4번째 열(배포예측)은 그때 브라우저가 실제로 붙인 값입니다. 지우지 마세요.
 * `npm run tagger:eval`이 이 열을 로컬 재계산과 대조해서 실행 환경 차이를 잡아냅니다.
 */

(async () => {
  // next.config.ts의 리버스 프록시를 거칩니다. 다른 경로를 쓰고 있다면 여기만 바꾸세요.
  const API_BASE = '/api/proxy';

  const response = await fetch(`${API_BASE}/admin/feedbacks?includeHidden=true`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`요청 실패 ${response.status}`, body);
    console.error('401/403이면 로그인이 풀린 것입니다. 다시 로그인하고 실행하세요.');
    return;
  }

  const { items } = await response.json();
  console.log(`받아온 소감 ${items.length}건`);

  /**
   * 탭·줄바꿈을 공백으로 눕힙니다. TSV라 탭 하나가 섞이면 열이 밀려서
   * 라벨 자리에 문장 뒷부분이 들어갑니다. textarea 입력이라 줄바꿈이 실제로 들어옵니다.
   */
  const flatten = (text) => text.replace(/[\t\r\n]+/g, ' ').trim();

  // 같은 문장은 로짓도 같아서 평가에 정보를 더하지 않습니다. 분포 통계가 필요하면
  // 원본 JSON을 따로 보세요 — 아래에서 window에 남겨둡니다.
  const seen = new Map();
  for (const item of items) {
    const text = flatten(item.text);
    if (!text || seen.has(text)) continue;
    seen.set(text, item);
  }

  console.log(`중복 제거 후 ${seen.size}건 (중복 ${items.length - seen.size}건)`);

  const header = [
    '# 실사용 소감 수집본',
    `# 수집일: ${new Date().toISOString().slice(0, 10)}`,
    `# 원본 ${items.length}건 → 중복 제거 ${seen.size}건`,
    '#',
    '# 형식: 문장 \\t 라벨 \\t 비고 \\t 배포예측',
    '# 라벨(POS/NEU/NEG)을 2번째 열에 채우세요. 4번째 열은 건드리지 마세요.',
    '# 라벨링 기준: docs/tagger-validation.md §2, 절차: docs/tagger-eval/라벨링-가이드.md',
    '#',
    '# 라벨링 전에 튜닝/홀드아웃으로 파일을 나눠야 합니다. 라벨을 먼저 보고 나누면',
    '# 어려운 문장을 무의식적으로 한쪽에 몰게 됩니다.',
  ].join('\n');

  const body = [...seen.values()]
    .map((item) => {
      const note = [`id=${item.id}`, `s=${item.sessionId}`, item.status, item.toxic ? 'toxic' : '']
        .filter(Boolean)
        .join(' ');
      // 2번째 열(라벨)은 일부러 비웁니다.
      return [flatten(item.text), '', note, item.sentiment].join('\t');
    })
    .join('\n');

  const blob = new Blob([`${header}\n${body}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'tagger-eval-수집.txt';
  anchor.click();
  URL.revokeObjectURL(url);

  // 태거 버전이 섞여 있으면 평가가 오염됩니다. 옛 버전으로 태깅된 건은 빼야 할 수 있습니다.
  const versions = {};
  const sentiments = {};
  for (const item of items) {
    versions[item.taggerVersion] = (versions[item.taggerVersion] ?? 0) + 1;
    sentiments[item.sentiment] = (sentiments[item.sentiment] ?? 0) + 1;
  }
  console.log('태거 버전 분포', versions);
  console.log('배포 예측 분포', sentiments);
  console.log('원본 JSON은 window.__pulseFeedbacks 에 남겨뒀습니다.');

  window.__pulseFeedbacks = items;
})();
