import type { KeywordCount } from '@/components/dashboard/metrics';
import { Badge } from '@/components/ui/Badge';

/**
 * 상위 키워드 카드입니다. 소감에 붙은 키워드를 빈도순으로 보여줍니다.
 *
 * 높이를 고정하지 않습니다. 목록 카드들과 달리 내용이 몇 줄로 끝나고, 폴링으로 키워드가
 * 늘어도 순서가 고정돼 있어(`countKeywords`) 목록이 통째로 뒤바뀌지 않습니다.
 *
 * 대신 대시보드에서 아래 한 줄을 통째로 씁니다. 목록 카드 옆에 세우면 이 카드가 늘어난
 * 만큼 옆 피드의 스크롤 높이가 따라 흔들립니다(#216).
 */

/* 카드 모양이 대시보드의 다른 섹션과 같습니다. `components/ui/`에 카드 프리미티브가 아직 없습니다. */
const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';
const CARD_TITLE = 'text-xs font-normal leading-4 text-text-tertiary';

interface KeywordCardProps {
  /** 빈도순으로 이미 정렬·상위 N개로 잘린 목록입니다. */
  keywords: KeywordCount[];
}

const KeywordCard = ({ keywords }: KeywordCardProps) => (
  <section className={CARD}>
    <h2 className={CARD_TITLE}>상위 키워드</h2>

    {keywords.length === 0 ? (
      <p className="text-sm text-text-tertiary">아직 모인 키워드가 없어요</p>
    ) : (
      <ul className="flex flex-wrap gap-2">
        {keywords.map(([keyword, count]) => (
          <li key={keyword}>
            <Badge tone="outline">
              {keyword} {count}
            </Badge>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export { KeywordCard };
