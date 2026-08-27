import { describe, expect, it } from 'vitest';

import type { FeedbackView } from '@/lib/schemas/api';
import { ARCHIVE_LIMIT, mergeArchive } from '@/lib/storage/sessionArchive';

const feedback = (id: number, minutesAgo: number): FeedbackView => ({
  id,
  sessionId: 1,
  text: `소감 ${id}`,
  sentiment: 'POS',
  keywords: [],
  createdAt: new Date(Date.UTC(2026, 7, 25, 10, 0) + minutesAgo * 60_000).toISOString(),
});

describe('mergeArchive', () => {
  it('새 건이 없으면 받은 배열을 그대로 돌려준다', () => {
    /*
     * 참조가 같아야 React가 다시 그리지 않습니다. 스트림이 2초마다 같은 50건을 밀어주는데
     * 매번 새 배열을 만들면 소감이 안 들어오는 동안에도 화면이 계속 다시 그려집니다.
     */
    const previous = [feedback(1, 0), feedback(2, 1)];

    expect(mergeArchive(previous, [feedback(1, 0), feedback(2, 1)])).toBe(previous);
  });

  it('처음 보는 건만 더한다', () => {
    const previous = [feedback(1, 0)];

    const merged = mergeArchive(previous, [feedback(1, 0), feedback(2, 1)]);

    expect(merged).not.toBe(previous);
    expect(merged.map((item) => item.id)).toEqual([1, 2]);
  });

  it('이미 있는 id는 덮어쓰지 않는다', () => {
    const previous = [{ ...feedback(1, 0), text: '원본' }];

    const merged = mergeArchive(previous, [{ ...feedback(1, 0), text: '덮어쓰기 시도' }]);

    expect(merged).toBe(previous);
    expect(merged[0].text).toBe('원본');
  });

  it('시간순으로 세운다', () => {
    /* 스냅샷은 최신순으로 오는데 차트는 시간순이어야 합니다. */
    const merged = mergeArchive([], [feedback(3, 20), feedback(1, 0), feedback(2, 10)]);

    expect(merged.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('상한을 넘으면 오래된 것부터 버린다', () => {
    const previous = Array.from({ length: ARCHIVE_LIMIT }, (_, index) => feedback(index + 1, index));

    const merged = mergeArchive(previous, [feedback(9_000, ARCHIVE_LIMIT + 1)]);

    expect(merged).toHaveLength(ARCHIVE_LIMIT);
    /* 가장 오래된 1번이 밀려나고 새 건이 끝에 붙는다. */
    expect(merged[0].id).toBe(2);
    expect(merged[merged.length - 1].id).toBe(9_000);
  });
});
