import { describe, expect, it } from 'vitest';

import { DECK_TEXT_MAX_LENGTH } from '@/lib/deck/limits';
import {
  compareSlideNames,
  normalizeDeckText,
  slideTextFromXml,
} from '@/lib/deck/extractDeckText';

/**
 * 순수 함수만 봅니다. PDF·PPTX를 실제로 여는 경로는 브라우저 API(`File`)와 동적 import에
 * 묶여 있어서 `environment: 'node'`에 올릴 수 없고, 올려봐야 검증하는 건 라이브러리 동작입니다.
 *
 * 여기 있는 셋은 자료가 잘못 읽히는 실제 원인이었던 자리입니다 — 런이 갈라져 글자 사이가
 * 벌어지거나, 슬라이드 순서가 뒤집히거나, 입력이 상한을 넘는 경우입니다.
 */

const paragraph = (...runs: string[]): string =>
  `<a:p>${runs.map((run) => `<a:r><a:t>${run}</a:t></a:r>`).join('')}</a:p>`;

describe('slideTextFromXml', () => {
  it('한 문단 안의 런은 공백 없이 이어 붙인다', () => {
    /*
     * PowerPoint는 서식이 바뀔 때마다 런을 새로 엽니다. 굵게 처리한 글자 하나 때문에 런이
     * 셋으로 갈리는 일이 흔해서, 사이에 공백을 넣으면 단어가 쪼개집니다.
     */
    expect(slideTextFromXml(paragraph('발표', '자료', ' 요약'))).toBe('발표자료 요약');
  });

  it('문단은 줄바꿈으로 나눈다', () => {
    const xml = `${paragraph('제목')}${paragraph('본문')}`;

    expect(slideTextFromXml(xml)).toBe('제목\n본문');
  });

  it('빈 문단은 버린다', () => {
    /* 레이아웃용 빈 자리표시자가 슬라이드마다 붙어서, 남기면 빈 줄만 잔뜩 쌓입니다. */
    const xml = `${paragraph('제목')}<a:p></a:p>${paragraph('본문')}`;

    expect(slideTextFromXml(xml)).toBe('제목\n본문');
  });

  it('XML 엔티티를 되돌린다', () => {
    expect(slideTextFromXml(paragraph('A &amp; B'))).toBe('A & B');
  });

  it('숫자 참조로 들어온 굽은 따옴표를 되돌린다', () => {
    /* PowerPoint가 자동 교정으로 넣는 문자라 실제 자료에서 매우 자주 나옵니다. */
    expect(slideTextFromXml(paragraph('&#8216;Pulse&#8217;'))).toBe('‘Pulse’');
  });

  it('텍스트가 없으면 빈 문자열이다', () => {
    /* 이미지로만 만든 슬라이드입니다. 호출부가 이 결과를 NO_TEXT_LAYER로 읽습니다. */
    expect(slideTextFromXml('<p:sp><p:pic /></p:sp>')).toBe('');
  });
});

describe('compareSlideNames', () => {
  it('두 자리 슬라이드를 번호순으로 세운다', () => {
    const names = [
      'ppt/slides/slide10.xml',
      'ppt/slides/slide2.xml',
      'ppt/slides/slide1.xml',
    ].sort(compareSlideNames);

    expect(names).toEqual([
      'ppt/slides/slide1.xml',
      'ppt/slides/slide2.xml',
      'ppt/slides/slide10.xml',
    ]);
  });
});

describe('normalizeDeckText', () => {
  it('늘어진 공백과 빈 줄을 한 줄로 접는다', () => {
    expect(normalizeDeckText('  제목   \n\n\n\n  본문  ')).toBe('제목\n본문');
  });

  it('줄바꿈 없는 공백도 보통 공백으로 접는다', () => {
    /* PDF 추출물에 자주 섞이는데 눈에 안 보여서, 안 접으면 토큰만 조용히 늘어납니다. */
    expect(normalizeDeckText('발표  자료')).toBe('발표 자료');
  });

  it('상한에서 자른다', () => {
    const text = normalizeDeckText('가'.repeat(DECK_TEXT_MAX_LENGTH + 100));

    expect(text).toHaveLength(DECK_TEXT_MAX_LENGTH);
  });
});
