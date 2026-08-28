'use client';

import { QRCodeSVG } from 'qrcode.react';

import { Button } from '@/components/ui/Button';
import type { GameView } from '@/lib/schemas/api';

/**
 * 모집 중 화면입니다. QR과 참가자 명단이 절반씩 차지합니다.
 *
 * QR은 **소감 화면**(`/e/{code}`)을 가리킵니다. 게임으로 바로 보내면 게임만 하고
 * 나갑니다 — 소감 화면에 떨어져야 배너를 거쳐 게임으로 가고, 그 과정에서 소감 화면을
 * 한 번은 봅니다(#243). 인쇄된 QR과 같은 주소이기도 합니다.
 *
 * 멀리서 보는 화면이라 글자를 크게 씁니다. 참가자 폰의 `max-w-md` 열에 맞추지 않습니다.
 */

/**
 * 이름표를 다는 최대 인원입니다. 넘으면 인원 숫자만 보여줍니다.
 *
 * 47명이 프로젝터에 다 뜨면 아무도 자기를 못 찾습니다. #243의 규모 경계값(30)을 그대로
 * 썼고, 실제로 띄워보고 조정합니다.
 */
const NAME_TAG_LIMIT = 30;

interface GameRecruitingProps {
  sessionTitle: string;
  game: GameView;
  joinUrl: string;
  isPending: boolean;
  onStart: () => void;
}

const GameRecruiting = ({
  sessionTitle,
  game,
  joinUrl,
  isPending,
  onStart,
}: GameRecruitingProps) => {
  const showNames = game.participants.length <= NAME_TAG_LIMIT;

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-col items-center gap-1 pt-[6dvh]">
        {sessionTitle ? (
          <p className="text-base font-normal leading-6 text-text-secondary">{sessionTitle}</p>
        ) : null}
        <h1 className="text-4xl font-semibold leading-tight text-text-primary">
          QR을 찍고 참가하세요
        </h1>
      </div>

      {/* 본문만 남는 공간에서 가운데 정렬합니다. 제목은 화면마다 같은 높이에 있어야 합니다. */}
      <div className="flex flex-1 flex-col justify-center gap-10">
        {/* QR과 인원만 가로로 둡니다. 명단은 아래에서 폭을 다 씁니다. */}
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-center md:gap-16">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl bg-background-default p-4">
              <QRCodeSVG value={joinUrl} title="참가자 진입 주소 QR 코드" className="h-56 w-56" />
            </div>
            <p className="text-sm font-normal leading-5 text-text-tertiary">{joinUrl}</p>
          </div>

          <p className="text-7xl font-semibold leading-none text-text-primary">
            {game.participants.length}
            <span className="text-3xl font-normal text-text-secondary">명</span>
          </p>
        </div>

        {/*
          명단은 전체 폭으로 펼칩니다. 좁은 칼럼에 두면 세로로 길게 늘어져서 프로젝터의
          가로 공간이 비고, 뒤쪽 사람은 아래 이름을 못 읽습니다.
        */}
        {showNames ? (
          <ul className="flex flex-wrap justify-center gap-3">
            {game.participants.map((participant) => (
              <li
                key={participant.id}
                className="rounded-full bg-primary-subtle px-5 py-2 text-2xl font-normal leading-8 text-primary-darker"
              >
                {participant.nickname}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-xl font-normal leading-7 text-text-secondary">
            이름은 레이스에서 보여드릴게요
          </p>
        )}

        <div className="flex justify-center">
          <Button onClick={onStart} disabled={isPending || game.participants.length === 0}>
            {isPending ? '시작하는 중…' : '시작하기'}
          </Button>
        </div>
      </div>
    </section>
  );
};

export { GameRecruiting };
