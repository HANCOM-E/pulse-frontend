import { describe, expect, it } from 'vitest';

import { isToxic } from '@/lib/tagger/tagger';

describe('isToxic', () => {
  it('사전에 있는 욕설을 잡는다', () => {
    expect(isToxic('시발 이게 뭔 소린지 하나도 모르겠네')).toBe(true);
    expect(isToxic('씨발 뭐라는 건지 하나도 못 알아듣겠음')).toBe(true);
  });

  it('초성 우회를 잡는다', () => {
    expect(isToxic('진짜 시간 낭비였음 ㅅㅂ')).toBe(true);
  });

  // 공백·늘임 우회. normalizeForProfanity와 STRETCH_SYLLABLES가 각각 담당합니다.
  it('공백과 늘임 음절 우회를 잡는다', () => {
    expect(isToxic('시 발 뭐라는 거야')).toBe(true);
    expect(isToxic('시이이발 못 알아듣겠네')).toBe(true);
  });

  // #164. 개새는 있었지만 개같-이 없어서 평가셋에서 이 문장만 새어 나갔습니다.
  it('개같- 계열을 잡는다', () => {
    expect(isToxic('개같이 어려웠지만 배운 건 있습니다')).toBe(true);
    expect(isToxic('개같은 진행이었어요')).toBe(true);
  });

  /*
   * 오탐이 곧 삭제입니다. #150 이후 toxic은 제출 시점에 HIDDEN으로 저장되고,
   * 주최자가 큐를 안 열면 그 참가자 소감은 영영 안 보입니다.
   */
  it('욕설을 부분 문자열로 포함하는 정상 단어를 통과시킨다', () => {
    expect(isToxic('시발점부터 다시 짚어주셔서 좋았습니다')).toBe(false);
    expect(isToxic('개인적으로는 아쉬웠어요')).toBe(false);
  });

  // toxic은 욕설 사전 매칭입니다(#160). 비하 표현은 대상을 봐야 판단되므로 넣지 않습니다.
  it('욕설이 없는 부정·자조 표현은 통과시킨다', () => {
    expect(isToxic('이딴 걸 토론이라고 앉아서 듣고 있는 내가 한심하다')).toBe(false);
    expect(isToxic('준비를 하나도 안 한 게 티가 나네 시간 아깝다')).toBe(false);
  });

  it('개-합성명사(번개·무지개·안개)는 통과시킨다', () => {
    expect(isToxic('번개같이 빠른 진행이었어요')).toBe(false);
    expect(isToxic('무지개같이 다채로웠어요')).toBe(false);
    expect(isToxic('안개같이 몽환적이었다')).toBe(false);
    expect(isToxic('번개 같이 빠른 진행이었어요')).toBe(false); // 띄어쓰기
  });

  it('개같- 계열은 계속 잡는다', () => {
    expect(isToxic('개같이 어려웠지만 배운 건 있습니다')).toBe(true);
    expect(isToxic('개같은 진행이었다')).toBe(true);
  });
});
