'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { GameView } from '@/lib/schemas/api';

/**
 * 게임을 만들고 모집을 여는 자리입니다. 참가자가 아직 아무것도 못 하는 두 상태를
 * 한 컴포넌트가 맡습니다 — 게임 없음과 `DRAFT`는 주최자가 할 일이 「다음 단계로
 * 넘긴다」로 같습니다.
 */

/** `gameCreateRequestSchema`의 `max(50)`과 같은 값입니다. 서버가 거절하기 전에 화면이 막습니다. */
const TITLE_MAX = 50;

interface GameSetupProps {
  /** `null`이면 아직 만들기 전입니다. */
  game: GameView | null;
  isPending: boolean;
  onCreate: (title: string) => void;
  onOpen: () => void;
}

const GameSetup = ({ game, isPending, onCreate, onOpen }: GameSetupProps) => {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setError('제목을 입력해주세요');
      return;
    }

    setError('');
    onCreate(trimmed);
  };

  if (game === null) {
    return (
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4"
      >
        {' '}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-8 text-text-primary">게임 만들기</h1>
          <p className="text-sm font-normal leading-5 text-text-secondary">
            제목은 참가자에게 보이지 않아요. 여러번 할 때 구분하려고 씁니다
          </p>
        </div>
        <Field
          label="제목"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError('');
          }}
          maxLength={TITLE_MAX}
          placeholder="쉬는 시간 몸풀기"
          error={error}
          disabled={isPending}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? '만드는 중...' : '만들기'}
        </Button>
      </form>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 text-center">
      {' '}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-normal leading-5 text-text-secondary">{game.title}</p>
        <h1 className="text-2xl font-semibold leading-8 text-text-primary">준비됐어요</h1>
        <p className="text-sm font-normal leading-5 text-text-secondary">
          모집을 시작하면 참가자 화면에 배너가 떠요
        </p>
      </div>
      <Button onClick={onOpen} disabled={isPending}>
        {isPending ? '여는 중…' : '모집 시작'}
      </Button>
    </section>
  );
};

export { GameSetup };
