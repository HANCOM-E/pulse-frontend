import type { GameParticipant, GameView } from '@/lib/schemas/api';

/**
 * 참가한 뒤부터 결과가 나오기 전까지입니다.
 *
 * 레이스는 그리지 않습니다. 물리 연산이 부동소수점이라 기기마다 결과가 갈리고, 작은
 * 화면에 구슬 수십 개는 어차피 안 보입니다. 다들 프로젝터를 보게 하는 게 목적에도
 * 맞습니다(#243).
 *
 * 내 닉네임을 크게 보여주는 이유는 프로젝터에서 자기를 찾기 위해서입니다.
 */

interface GameWaitingProps {
  game: GameView;
  /** 참가자 목록에서 찾은 나입니다. 못 찾음녀 `null`입니다. */
  me: GameParticipant | null;
}

const GameWaiting = ({ game, me }: GameWaitingProps) => {
  const isRunning = game.status === 'RUNNING';

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold leading-6 text-text-primary">
          {isRunning ? '레이스 진행중이에요' : '프로젝터를 봐주세요'}
        </h2>
        <p className="text-sm font-normal leading-5 text-text-secondary">
          {isRunning ? '곧 결과가 나와요' : '주최자가 시작하면 레이스가 열려요'}
        </p>
      </div>

      {me ? (
        <div className="flex flex-col gap-1 rounded-xl border border-border-subtle p-4">
          <p className="text-xs font-normal leading-4 text-text-tertiary">내 이름</p>
          <p className="text-xl font-semibold leading-7 text-text-primary">{me.nickname}</p>
        </div>
      ) : null}

      {/*
        인원은 폴링으로 늘어납니다. 숫자만 바뀌고 자리는 그대로여야 아래 내용이 안 밀립니다.
      */}
      <p className="text-sm font-normal leading-5 text-text-secondary">
        지금 <span className="font-semibold text-text-primary">{game.participantCount}</span>명이
        참가했아요
      </p>
    </section>
  );
};

export { GameWaiting };
