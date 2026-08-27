'use client';

import { isToxic } from '@/lib/tagger/tagger';
import { useState } from 'react';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';

/**
 * 닉네임을 받아 게임에 참가시킵니다.
 *
 * 욕설 검사를 여기서 합니다. 서버는 이 검사를 하지 않기로 했으므로(#246) 유일한
 * 방어선입니다. `isToxic`은 사전 기반 문자열 검사라 태깅 모델(13.9MB)을 안 받아도
 * 됩니다 — 같은 파일에 있지만 부르는 함수가 다릅니다.
 */

/** `gameJoinRequestSchema`의 `max(12)`와 같은 값입니다. 서버가 거절하기 전에 화면이 먼저 막습니다. */
const NICKNAME_MAX = 12;

interface GameJoinFormProps {
  /** 마지막에 쓴 이름입니다. 없으면 빈 문자열입니다. */
  defaultNickname: string;
  /** 지금까지 참가한 사람 수입니다. 들어갈 이유를 하나 더 만듭니다. */
  participantCount: number;
  isPending: boolean;
  /** 서버가 거절했을 때의 문구입니다. 입력 검증과 달리 제출한 뒤에 옵니다 */
  submitError?: string;
  onSubmit: (nickname: string) => void;
}

const GameJoinForm = ({
  defaultNickname,
  participantCount,
  isPending,
  submitError,
  onSubmit,
}: GameJoinFormProps) => {
  const [nickname, setNickname] = useState(defaultNickname);
  const [error, setError] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
      setError('닉네임을 입력해주세요');
      return;
    }
    if (trimmed.length > NICKNAME_MAX) {
      setError(`${NICKNAME_MAX}자까지 쓸 수 있어요`);
      return;
    }
    if (isToxic(trimmed)) {
      setError('이 이름은 쓸 수 없어요');
      return;
    }

    setError('');
    onSubmit(trimmed);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNickname(event.target.value);
    // 고치기 시작하면 바로 지웁니다. 남겨두면 이미 해결한 문제를 계속 지적하는 꼴입니다.
    if (error) setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        label="닉네임"
        value={nickname}
        onChange={handleChange}
        maxLength={NICKNAME_MAX}
        placeholder="초코송이"
        error={error || submitError}
        disabled={isPending}
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? '참가하는 중...' : '참가하기'}
      </Button>
      {/*
        참가를 망설이는 시점은 참가 전입니다. 들어간 뒤에야 인원을 보면 늦습니다.
        0명일 때는 "아무도 없다"로 읽혀서 오히려 막으므로 안 보여줍니다.
      */}
      {participantCount > 0 ? (
        <p className="text-sm font-normal leading-5 text-text-secondary">
          지금 <span className="font-semibold text-text-primary">{participantCount}</span>명이
          참가했어요
        </p>
      ) : null}
      <p className="text-xs font-normal leading-4 text-text-tertiary">
        게임 닉네임은 소감과 연결되지 않아요
      </p>
    </form>
  );
};

export { GameJoinForm };
