import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readNickname,
  readParticipantId,
  rememberNickname,
  rememberParticipant,
  subscribe,
} from '@/lib/storage/gameParticipant';

/**
 * 화면 테스트를 못 쓰는 환경이라(vitest `environment: 'node'`) 저장소 규칙을 여기서 봅니다.
 * 깨진 값·접근 차단·서버 렌더처럼 실제로 마주치지만 재현이 번거로운 경우가 대상입니다
 * (`lib/storage/submitted.test.ts`와 같은 방식).
 */

const GAME_ID = 2;
const OTHER_GAME_ID = 3;

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

describe('참가 기록', () => {
  it('기록한 participantId를 되찾는다', () => {
    stubBrowser();
    rememberParticipant(GAME_ID, 6);

    expect(readParticipantId(GAME_ID)).toBe(6);
  });

  /*
   * 참가는 게임 단위입니다. 한 행사에서 게임을 여러 번 하는데 기록이 섞이면, 새 게임에서
   * 지난 게임의 id로 명단을 뒤지게 됩니다.
   */
  it('게임이 다르면 섞이지 않는다', () => {
    stubBrowser();
    rememberParticipant(GAME_ID, 6);

    expect(readParticipantId(OTHER_GAME_ID)).toBeNull();
  });

  it('기록이 없으면 null이다', () => {
    stubBrowser();

    expect(readParticipantId(GAME_ID)).toBeNull();
  });

  /*
   * 서버 응답이 계약과 다르거나 저장 값이 손상됐을 때입니다. 그대로 통과시키면 화면이
   * NaN으로 명단을 뒤져서 아무도 못 찾고, 원인은 한참 뒤에 드러납니다.
   */
  it('숫자가 아닌 값이 들어 있으면 null로 떨어뜨린다', () => {
    stubBrowser({ 'pulse:game-participant:2': 'abc' });

    expect(readParticipantId(GAME_ID)).toBeNull();
  });

  it('0이나 음수는 저장하지 않는다', () => {
    stubBrowser();
    rememberParticipant(GAME_ID, 0);
    rememberParticipant(GAME_ID, -1);

    expect(readParticipantId(GAME_ID)).toBeNull();
  });
});

describe('닉네임', () => {
  /*
   * 게임이 아니라 브라우저에 붙습니다. 한 행사에서 게임을 여러 번 하는데 매번 이름을
   * 다시 치게 하면 들어오다 맙니다.
   */
  it('게임이 달라도 같은 이름을 준다', () => {
    stubBrowser();
    rememberNickname('초코송이');

    expect(readNickname()).toBe('초코송이');
  });

  it('기록이 없으면 빈 문자열이다', () => {
    stubBrowser();

    expect(readNickname()).toBe('');
  });

  it('앞뒤 공백을 지우고 저장한다', () => {
    stubBrowser();
    rememberNickname('  감자  ');

    expect(readNickname()).toBe('감자');
  });

  it('공백뿐이면 저장하지 않는다', () => {
    stubBrowser({ 'pulse:game-nickname': '감자' });
    rememberNickname('   ');

    expect(readNickname()).toBe('감자');
  });
});

describe('브라우저가 아닐 때', () => {
  /*
   * SSR에는 window가 없습니다. 던지면 서버 렌더가 통째로 실패하므로 "기록 없음"과 같게
   * 취급합니다. `useSyncExternalStore`의 서버 스냅샷과 같은 값이어야 합니다.
   */
  it('서버에서는 읽어도 던지지 않는다', () => {
    vi.stubGlobal('window', undefined);

    expect(readParticipantId(GAME_ID)).toBeNull();
    expect(readNickname()).toBe('');
  });

  it('서버에서는 읽어도 던지지 않는다', () => {
    vi.stubGlobal('window', undefined);

    expect(readParticipantId(GAME_ID)).toBeNull();
    expect(readNickname()).toBe('');
  });

  it('서버에서는 써도 던지지 않는다', () => {
    vi.stubGlobal('window', undefined);

    expect(() => rememberParticipant(GAME_ID, 6)).not.toThrow();
    expect(() => rememberNickname('감자')).not.toThrow();
  });

  /*
   * Safari 시크릿 모드는 localStorage 접근 자체를 막습니다. 참가는 이미 서버에 들어갔으니
   * 저장 실패로 화면을 세우면 안 됩니다.
   */
  it('저장소 접근이 막혀도 던지지 않는다', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      },
    });

    expect(readParticipantId(GAME_ID)).toBeNull();
    expect(() => rememberParticipant(GAME_ID, 6)).not.toThrow();
  });
});

describe('구독', () => {
  /*
   * `useSyncExternalStore`가 이걸로 다시 읽습니다. 안 부르면 참가 직후 화면이 그대로
   * 입력창에 머뭅니다 — 저장은 됐는데 화면만 모르는 상태가 됩니다.
   */
  it('기록하면 구독자에게 알린다', () => {
    stubBrowser();
    const listener = vi.fn();
    subscribe(listener);

    rememberParticipant(GAME_ID, 6);
    rememberNickname('감자');

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('저장하지 않는 값이면 알리지 않는다', () => {
    stubBrowser();
    const listener = vi.fn();
    subscribe(listener);

    rememberParticipant(GAME_ID, 0);
    rememberNickname('   ');

    expect(listener).not.toHaveBeenCalled();
  });

  it('구독을 끊으면 더 안 부른다', () => {
    stubBrowser();
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    unsubscribe();
    rememberNickname('감자');

    expect(listener).not.toHaveBeenCalled();
  });
});
