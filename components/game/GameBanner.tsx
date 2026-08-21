import Link from 'next/link';

import { gameBannerMessage, isVisibleGame } from './gameBannerMessage';
import { Banner } from '@/components/ui/Banner';
import { ChevronRightIcon } from '@/components/ui/icons';
import { GameView } from '@/lib/schemas/api';

/**
 * 소감 화면에서 게임으로 넘어가는 유일한 길입니다(#243).
 *
 * 배너 전체를 `Link`로 감쌉니다. 오른쪽 끝에 작은 버튼을 두는 것보다 터치 영역이 커서
 * 모바일에서 낫고, `Banner`에 액션 슬롯을 새로 뚫지 않아도 됩니다.
 *
 * 닫기 버튼은 없습니다(#259). 닫으면 되돌릴 방법이 없는데 얻는 게 「한 줄 치우기」라
 * 남는 장사가 아니라고 봤습니다. `info`는 원래 상시형입니다(`components/ui/README.md`).
 */

interface GameBannerProps {
  eventCode: string;
  game: GameView;
}

const GameBanner = ({ eventCode, game }: GameBannerProps) => {
  if (!isVisibleGame(game)) return null;

  return (
    <Link href={`/e/${eventCode}/game`} className="block">
      <Banner type="info" className="w-full">
        <span className="min-w-0 flex-1">{gameBannerMessage(game)}</span>
        <ChevronRightIcon className="shrink-0" />
      </Banner>
    </Link>
  );
};

export { GameBanner };
