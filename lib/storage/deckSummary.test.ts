import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearDeckSummary, readDeckSummary, writeDeckSummary } from '@/lib/storage/deckSummary';

/**
 * 저장한 요약이 실제로 되살아나는지, 그리고 되살릴 수 없는 값을 조용히 흘리지 않는지를 봅니다.
 *
 * 여기서 `null`이 나와야 하는데 깨진 값이 나오면 그대로 `materialSummary`에 실려 BE까지
 * 갑니다. 재시도 한 번을 살리려다 리포트에 쓰레기를 남기는 셈이라, 살리기보다 버리는 쪽이
 * 맞습니다.
 *
 * vitest 환경이 node라 window가 없습니다. 브라우저 경로는 stubGlobal로 만듭니다.
 */

const EVENT_CODE = 'ab3f9x';
const SESSION_ID = 101;
const key = `pulse:deck-summary:${EVENT_CODE}:${SESSION_ID}`;

const value = { fileName: '발표자료.pdf', summary: '이 발표는 실시간 피드백을 다뤘습니다.' };

const stubBrowser = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string): string | null => map.get(k) ?? null,
      setItem: (k: string, v: string): void => {
        map.set(k, v);
      },
      removeItem: (k: string): void => {
        map.delete(k);
      },
    },
  });
};

afterEach(() => vi.unstubAllGlobals());

describe('저장과 조회', () => {
  it('저장한 요약을 그대로 되돌려준다', () => {
    stubBrowser();
    writeDeckSummary(EVENT_CODE, SESSION_ID, value);

    expect(readDeckSummary(EVENT_CODE, SESSION_ID)).toEqual(value);
  });

  it('세션이 다르면 섞이지 않는다', () => {
    /* 한 이벤트의 여러 세션을 연달아 보는 강연자가 남의 자료 요약을 싣게 되면 안 됩니다. */
    stubBrowser();
    writeDeckSummary(EVENT_CODE, SESSION_ID, value);

    expect(readDeckSummary(EVENT_CODE, SESSION_ID + 1)).toBeNull();
  });

  it('지우면 사라진다', () => {
    stubBrowser();
    writeDeckSummary(EVENT_CODE, SESSION_ID, value);
    clearDeckSummary(EVENT_CODE, SESSION_ID);

    expect(readDeckSummary(EVENT_CODE, SESSION_ID)).toBeNull();
  });
});

describe('망가진 값', () => {
  it('JSON이 아니면 없는 것으로 읽는다', () => {
    stubBrowser({ [key]: '{{{' });

    expect(readDeckSummary(EVENT_CODE, SESSION_ID)).toBeNull();
  });

  it('형태가 다르면 없는 것으로 읽는다', () => {
    /* 옛 버전이 남긴 값입니다. 필드가 빠진 채 화면까지 흘러가면 거기서 터집니다. */
    stubBrowser({ [key]: '{"summary":"본문만 있고 파일 이름이 없음"}' });

    expect(readDeckSummary(EVENT_CODE, SESSION_ID)).toBeNull();
  });

  it('빈 요약은 없는 것으로 읽는다', () => {
    /* 빈 문자열을 실어 보내면 자료를 첨부한 적 없는 리포트와 구분이 안 됩니다. */
    stubBrowser({ [key]: '{"fileName":"발표자료.pdf","summary":""}' });

    expect(readDeckSummary(EVENT_CODE, SESSION_ID)).toBeNull();
  });
});

describe('브라우저가 아닐 때', () => {
  it('서버 렌더에서는 없는 것으로 읽는다', () => {
    /* window가 없는 상태입니다. 던지면 SSR이 통째로 깨집니다. */
    expect(readDeckSummary(EVENT_CODE, SESSION_ID)).toBeNull();
  });
});
