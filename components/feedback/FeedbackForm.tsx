'use client';

import { useState } from 'react';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Textarea } from '@/components/ui/Textarea';
import type { SessionView } from '@/lib/schemas/api';

interface FeedbackFormProps {
  eventCode: string;
  sessions: SessionView[];
}

const FeedbackForm = ({ eventCode, sessions }: FeedbackFormProps) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [text, setText] = useState('');

  return (
    <>
      <section className="flex flex-col gap-1">
        <p className="text-xs font-normal leading-4 text-text-tertiary">세션 선택</p>
        <div className="flex flex-wrap gap-2">
          {sessions.map((session) => (
            <Chip
              key={session.id}
              selected={session.id === selectedId}
              onClick={() => setSelectedId(session.id)}
            >
              {session.title}
            </Chip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-normal leading-4 text-text-tertiary">한줄 소감</p>
          <p className="text-xs font-normal leading-4 text-text-tertiary">{text.length}/200</p>
        </div>
        <Textarea
          placeholder="이번 세션은 어떠셨나요?"
          maxLength={200}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </section>

      <Banner type="info" className="w-full">
        제출하면 브라우저에서 감정을 자동 분석해요
      </Banner>

      <Button size="lg" className="w-full" disabled={selectedId === null || text.trim() === ''}>
        소감 남기기
      </Button>
    </>
  );
};

export { FeedbackForm };
