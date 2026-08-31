import Link from 'next/link';
import { ChevronLeftIcon } from '@/components/ui/icons';

import { notFound } from 'next/navigation';

import { ParticipantGameView } from '@/components/game/ParticipantGameView';
import { fetchCurrentGame } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';

export const dynamic = 'force-dynamic';

interface GamePageProps {
  params: Promise<{ code: string }>;
}

/**
 * 첫 게임만 서버에서 받아 넘깁니다. 상태 분기는 `ParticipantGameView`가 폴링 결과로
 * 다시 계산합니다(`app/e/[code]/page.tsx`와 같은 구조).
 *
 * 열린 게임이 없으면 `fetchCurrentGame`이 404를 `null`로 삼켜서 옵니다. 그건 정상
 * 상태라 `notFound()`가 아니라 화면에서 빈 상태로 그립니다.
 */
const GamePage = async ({ params }: GamePageProps) => {
  const { code } = await params;

  const game = await fetchCurrentGame(code).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === 'EVENT_NOT_FOUND') notFound();
    throw error;
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-2 px-5 py-4">
      <Link
        href={`/e/${code}`}
        className="-ml-1 flex w-fit cursor-pointer items-center rounded p-1 text-text-secondary hover:bg-background-secondary"
        aria-label="소감 화면으로 돌아가기"
      >
        <ChevronLeftIcon className="h-6 w-6" />
      </Link>
      <ParticipantGameView eventCode={code} initialGame={game} />
    </main>
  );
};

export default GamePage;
