'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { GameFinished } from '@/components/game/host/GameFinished';
import { GameRecruiting } from '@/components/game/host/GameRecruiting';
import { GameRunning } from '@/components/game/host/GameRunning';
import { GameSetup } from '@/components/game/host/GameSetup';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { useHostGame } from '@/hooks/useHostGame';

/**
 * 프로젝터 화면의 클라이언트 경계입니다.
 *
 * 화면 전체가 클라이언트 아일랜드입니다. 상태가 폴링 결과에서 나와서 서버가 미리 그릴 게
 * 없고, `eventCode`도 `useParams`로 직접 읽습니다(`DashboardPage`와 같은 방식).
 */

const GameHostView = () => {
  const { eventCode } = useParams<{ eventCode: string }>();
  const { game, isLoading, isError, isPending, create, open, start, finish } =
    useHostGame(eventCode);

  /*
   * 시작은 되돌릴 수 없습니다. `RUNNING`으로 넘기면 참가가 마감되고 `DRAFT`·`OPEN`으로
   * 못 돌아갑니다. 실수로 누르는 걸 막으려고 한 번 물어봅니다.
   */
  const [isStartAsking, setIsStartAsking] = useState(false);

  /** QR이 가리키는 주소입니다. 게임 화면이 아니라 소감 화면입니다(#243). */
  const joinUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/e/${eventCode}`;

  const renderBody = () => {
    if (game === null || game.status === 'DRAFT') {
      return <GameSetup game={game} isPending={isPending} onCreate={create} onOpen={open} />;
    }

    if (game.status === 'OPEN') {
      return (
        <>
          <GameRecruiting
            game={game}
            joinUrl={joinUrl}
            isPending={isPending}
            onStart={() => setIsStartAsking(true)}
          />
          <ConfirmDialog
            open={isStartAsking}
            title="지금 시작할까요?"
            description={`${game.participantCount}명이 참가했어요. 시작하면 더 참가할 수 없어요`}
            onClose={() => setIsStartAsking(false)}
            actions={
              <>
                <Button variant="secondary" onClick={() => setIsStartAsking(false)}>
                  취소
                </Button>
                <Button
                  onClick={() => {
                    setIsStartAsking(false);
                    start();
                  }}
                >
                  시작하기
                </Button>
              </>
            }
          />
        </>
      );
    }

    if (game.status === 'RUNNING') {
      return <GameRunning game={game} onFinish={finish} />;
    }

    /*
     * 새 게임을 만들면 `useHostGame`이 가장 최근 것을 고르므로 화면이 저절로 `DRAFT`로
     * 넘어갑니다. 제목은 이전 것을 그대로 씁니다 — 프로젝터 앞에서 타이핑하게 하지 않습니다.
     */
    return (
      <GameFinished
        game={game}
        eventCode={eventCode}
        isPending={isPending}
        onCreateNext={() => create(game.title)}
      />
    );
  };

  if (isLoading) return null;
  if (isError) return <Banner type="negative">게임 정보를 불러올 수 없어요</Banner>;

  return (
    <>
      {/*
        프로젝터에 띄우는 화면이라 헤더 말고는 나갈 길이 없습니다. 행사 중에 주최자가
        대시보드를 봐야 할 때가 있어서 둡니다. `EventForm`과 같은 모양입니다.

        `router.back()`이 아니라 목적지를 박아둡니다. 주소를 직접 치고 들어오거나 행사
        내내 켜두는 화면이라 히스토리가 어디를 가리킬지 모릅니다.
      */}
      <div className="w-full">
        <Link
          href={`/events/${eventCode}/dashboard`}
          className="-ml-1 flex w-fit cursor-pointer items-center rounded p-1 text-text-secondary hover:bg-background-secondary"
          aria-label="대시보드로 돌아가기"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </Link>
      </div>

      {renderBody()}
    </>
  );
};

export { GameHostView };
