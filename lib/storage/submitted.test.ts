import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasSubmitted, listSubmitted, markSubmitted } from '@/lib/storage/submitted';

/**
 * 화면에 붙기 전이라 브라우저로 확인할 수 없습니다. 깨진 값·접근 차단·서버 렌더처럼
 * 실제로 마주치지만 재현이 번거로운 경우를 여기서 봅니다.
 *
 * vitest 환경이 node라 window가 없습니다. 브라우저 경로는 stubGlobal로 만듭니다.
 */

const EVENT_CODE = 'ab3f9x';
const OTHER_EVENT_CODE = 'kd7m2p';
const key = `pulse:submitted:${EVENT_CODE}`;

const stubBrowser = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string): string | null => map.get(k) ?? null,
      setItem: (k: string, v: string): void => {
        map.set(k, v);
      },
    },
  });
};

afterEach(() => vi.unstubAllGlobals());

describe('기록과 조회', () => {
  it('기록한 세션을 찾는다', () => {
    stubBrowser();
    markSubmitted(EVENT_CODE, 101);
    expect(hasSubmitted(EVENT_CODE, 101)).toBe(true);
  });

  it('같은 세션을 두 번 기록해도 하나만 남는다', () => {
    stubBrowser();
    markSubmitted(EVENT_CODE, 101);
    markSubmitted(EVENT_CODE, 101);
    expect([...listSubmitted(EVENT_CODE)]).toEqual([101]);
  });

  it('이벤트가 다르면 섞이지 않는다', () => {
    stubBrowser();
    markSubmitted(EVENT_CODE, 101);
    expect(hasSubmitted(OTHER_EVENT_CODE, 101)).toBe(false);
  });
});

describe('망가진 값', () => {
  it('JSON이 아니면 빈 값으로 읽는다', () => {
    stubBrowser({ [key]: '{{{' });
    expect(listSubmitted(EVENT_CODE).size).toBe(0);
  });

  it('배열이 아니면 빈 값으로 읽는다', () => {
    stubBrowser({ [key]: '{"a":1}' });
    expect(listSubmitted(EVENT_CODE).size).toBe(0);
  });

  it('숫자가 아닌 항목은 걸러낸다', () => {
    stubBrowser({ [key]: '[101,"102",null]' });
    expect([...listSubmitted(EVENT_CODE)]).toEqual([101]);
  });

  it('유한하지 않은 세션은 기록하지 않는다', () => {
    stubBrowser();
    markSubmitted(EVENT_CODE, NaN);
    markSubmitted(EVENT_CODE, Infinity);
    markSubmitted(EVENT_CODE, -Infinity);
    expect(listSubmitted(EVENT_CODE).size).toBe(0);
  });
});

describe('접근이 막힌 경우', () => {
  it('읽기가 던져도 빈 값을 돌려준다', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
      },
    });
    expect(listSubmitted(EVENT_CODE).size).toBe(0);
  });

  it('쓰기가 던져도 예외가 새지 않는다', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
    });
    expect(() => markSubmitted(EVENT_CODE, 101)).not.toThrow();
  });
});

describe('서버 렌더', () => {
  it('window가 없으면 빈 값이다', () => {
    expect(listSubmitted(EVENT_CODE).size).toBe(0);
    expect(hasSubmitted(EVENT_CODE, 101)).toBe(false);
  });

  it('window가 없으면 기록해도 던지지 않는다', () => {
    expect(() => markSubmitted(EVENT_CODE, 101)).not.toThrow();
  });
});
