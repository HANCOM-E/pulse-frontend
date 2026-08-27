'use client';

import { DECK_TEXT_MAX_LENGTH } from '@/lib/deck/limits';

/**
 * 발표 자료(PDF·PPTX)에서 텍스트만 뽑습니다.
 *
 * ── 왜 브라우저에서 하는가 ──
 * 파일을 Route Handler로 올려서 서버가 파싱할 수도 있지만 셋이 걸립니다.
 *
 * 1. Vercel 서버리스 함수의 요청 본문 상한이 4.5MB입니다. 슬라이드가 몇십 장인 발표 PDF는
 *    이걸 쉽게 넘깁니다.
 * 2. 서버가 파싱하면 함수 실행 시간과 메모리를 씁니다. 이 프로젝트는 비용 0이 원칙입니다.
 * 3. 원본 파일이 브라우저 밖으로 나가지 않으면 서버에 남을 일도 새어 나갈 일도 없습니다.
 *    백엔드에도 요약 문자열만 갑니다(pulse-backend#43).
 *
 * 그래서 서버로 나가는 것은 여기서 뽑은 **텍스트**뿐이고, 그마저도 `DECK_TEXT_MAX_LENGTH`로
 * 자릅니다. 파싱 라이브러리는 전부 동적 import입니다 — `pdfjs-dist`는 SSR에서 깨지고 번들도
 * 무거워서, 자료를 첨부하지 않는 사람이 내려받을 이유가 없습니다.
 *
 * ── 못 읽는 자료 ──
 * 이미지로 내보낸 PDF나 텍스트가 전부 도형으로 그려진 슬라이드는 결과가 빈 문자열입니다
 * (`NO_TEXT_LAYER`). OCR이나 멀티모달 모델로 살릴 수는 있지만 비용과 4.5MB 제한이 다시
 * 걸려서, 지금은 화면이 "직접 입력해 달라"고 안내하는 쪽입니다.
 */

/** 화면이 안내 문구를 가르는 데 씁니다. 사유마다 사용자가 할 수 있는 일이 다릅니다. */
export type DeckExtractErrorCode =
  /** PDF·PPTX가 아닙니다. 사용자가 다른 파일을 고르면 됩니다. */
  | 'UNSUPPORTED_FILE_TYPE'
  /** 파일이 너무 큽니다. */
  | 'FILE_TOO_LARGE'
  /** 텍스트 레이어가 없습니다(스캔 PDF·이미지 슬라이드). 다시 시도해도 같습니다. */
  | 'NO_TEXT_LAYER'
  /** 파일이 손상됐거나 암호가 걸려 있습니다. */
  | 'EXTRACT_FAILED';

export class DeckExtractError extends Error {
  constructor(public code: DeckExtractErrorCode) {
    super(code);
    this.name = 'DeckExtractError';
  }
}

/**
 * 파일 크기 상한입니다. 이 값을 넘으면 파싱을 시작하지도 않습니다.
 *
 * 서버로 보내는 게 아니라 브라우저 메모리에서 처리하는 값이라 네트워크 제한과는 무관하고,
 * 순전히 탭이 멎는 걸 막는 선입니다. 슬라이드에 이미지가 많으면 파일은 커도 텍스트는 얼마
 * 안 되므로, 여유 있게 잡아도 아래 글자 수 상한이 비용을 따로 묶어 줍니다.
 */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** PPTX 안에서 슬라이드 하나가 들어 있는 경로입니다. 마스터·레이아웃은 걸리지 않습니다. */
const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/;

/** 텍스트 런 하나입니다. PowerPoint는 서식이 바뀔 때마다 이 태그를 새로 엽니다. */
const TEXT_RUN = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;

const XML_ENTITY: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITY[entity] ?? entity)
    /* 숫자 참조(`&#39;`·`&#x2019;`)는 PowerPoint가 굽은 따옴표를 쓸 때 자주 나옵니다. */
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));

/**
 * 슬라이드 XML 한 장에서 사람이 읽는 텍스트만 남깁니다.
 *
 * 문단(`<a:p>`) 단위로 끊고 그 안의 런은 그대로 이어 붙입니다. 런 경계는 서식이 바뀌는
 * 자리일 뿐 띄어쓰기가 아니라서, 사이에 공백을 넣으면 "발 표 자 료"처럼 갈라집니다.
 *
 * 순수 함수라 파일이나 zip을 건드리지 않습니다. `environment: 'node'`인 vitest가 그대로 붙습니다.
 */
export const slideTextFromXml = (xml: string): string =>
  xml
    .split('</a:p>')
    .map((paragraph) => {
      const runs = [...paragraph.matchAll(TEXT_RUN)].map(([, text]) => decodeXmlEntities(text));
      return runs.join('').trim();
    })
    .filter((paragraph) => paragraph !== '')
    .join('\n');

/**
 * 슬라이드 파일 이름을 번호순으로 세웁니다.
 *
 * 문자열 정렬이면 `slide10`이 `slide2`보다 앞에 서서 발표 순서가 뒤섞입니다. 요약이 "도입 →
 * 본론 → 정리"라는 흐름을 읽어야 하는데 순서가 어긋나면 그 근거가 무너집니다.
 */
export const compareSlideNames = (left: string, right: string): number => {
  const leftNumber = Number(SLIDE_PATH.exec(left)?.[1] ?? 0);
  const rightNumber = Number(SLIDE_PATH.exec(right)?.[1] ?? 0);
  return leftNumber - rightNumber;
};

/**
 * 모델에 넘기기 전 마지막 손질입니다. 빈 줄과 늘어진 공백을 접고 상한에서 자릅니다.
 *
 * 공백을 접는 건 미관이 아니라 비용입니다. PDF 추출물은 줄바꿈과 공백이 원문보다 훨씬 많아서,
 * 그대로 두면 내용은 그대로인데 입력 토큰만 늘어납니다. 줄바꿈이 아닌 공백에는 PDF가 자주 쓰는
 * 줄바꿈 없는 공백(U+00A0)도 들어갑니다 — 보통 정규식의 \s와 달리 눈에 안 보여서 놓치기 쉽습니다.
 *
 * 빈 줄은 남기지 않고 한 줄로 접습니다. 요약에 쓰는 입력이라 문단 사이 간격이 뜻을 더하지
 * 않는데, 슬라이드마다 붙는 빈 자리표시자 때문에 원본에는 빈 줄이 유난히 많습니다.
 */
export const normalizeDeckText = (raw: string): string =>
  raw
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
    .slice(0, DECK_TEXT_MAX_LENGTH);

const extractPdfText = async (file: File): Promise<string> => {
  const pdfjs = await import('pdfjs-dist');

  /*
   * 워커 경로를 번들러가 풀어주게 둡니다. 문자열 상수로 박으면 배포에서 404가 나고, 그때
   * pdf.js는 조용히 메인 스레드로 떨어져 큰 파일에서 탭이 멎습니다.
   */
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  /*
   * 로딩 작업을 변수에 남겨둡니다. 워커를 정리하는 `destroy`가 문서가 아니라 이쪽에 있어서,
   * `.promise`만 받아 쓰면 워커를 놓아줄 손잡이가 사라집니다(pdfjs-dist 6 기준).
   */
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });

  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];

    /*
     * 한 장씩 순서대로 받습니다. `Promise.all`로 전부 동시에 열면 슬라이드가 많은 자료에서
     * 페이지 객체가 한꺼번에 메모리에 뜹니다. 어차피 사용자가 기다리는 일회성 작업입니다.
     */
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();

      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      await page.cleanup();
    }

    return pages.join('\n');
  } finally {
    /* 워커와 페이지 캐시를 놓아줍니다. 여러 번 고르는 동안 쌓이면 탭이 무거워집니다. */
    await loadingTask.destroy();
  }
};

const extractPptxText = async (file: File): Promise<string> => {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);

  const slideNames = Object.keys(zip.files)
    .filter((name) => SLIDE_PATH.test(name))
    .sort(compareSlideNames);

  const slides: string[] = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async('string');
    slides.push(slideTextFromXml(xml));
  }

  return slides.join('\n');
};

/**
 * 확장자로 가릅니다. `file.type`을 보지 않는 이유는 Windows에서 PPTX가 빈 문자열이나
 * `application/octet-stream`으로 오는 경우가 있어서입니다. 그러면 멀쩡한 자료가 "지원하지
 * 않는 형식"으로 튕깁니다.
 */
const isPdf = (file: File): boolean => file.name.toLowerCase().endsWith('.pdf');
const isPptx = (file: File): boolean => file.name.toLowerCase().endsWith('.pptx');

/**
 * 발표 자료 파일 하나에서 요약에 쓸 텍스트를 뽑습니다.
 *
 * 실패는 전부 `DeckExtractError`입니다. 화면은 `code`로 문구를 가릅니다.
 */
export const extractDeckText = async (file: File): Promise<string> => {
  if (!isPdf(file) && !isPptx(file)) throw new DeckExtractError('UNSUPPORTED_FILE_TYPE');
  if (file.size > MAX_FILE_BYTES) throw new DeckExtractError('FILE_TOO_LARGE');

  let raw: string;
  try {
    raw = isPdf(file) ? await extractPdfText(file) : await extractPptxText(file);
  } catch (error) {
    console.error('[deck] 텍스트 추출 실패', error);
    throw new DeckExtractError('EXTRACT_FAILED');
  }

  const text = normalizeDeckText(raw);

  /*
   * 파싱은 성공했는데 글자가 하나도 없는 경우입니다. 실패와 다르게 다뤄야 합니다 — 다시
   * 시도해도 결과가 같아서, 화면이 재시도를 권하면 사용자가 헛수고를 합니다.
   */
  if (text === '') throw new DeckExtractError('NO_TEXT_LAYER');

  return text;
};
