'use client';

import { type ChangeEvent, type SubmitEvent, useState } from 'react';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { eventCreateRequestSchema } from '@/lib/schemas/api';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createEvent } from '@/lib/api/endpoints';
import { Banner } from '@/components/ui/Banner';

type EventFormInputs = {
  title: string;
  description: string;
  eventDate: string;
};

type EventFormErrors = {
  title?: string;
  description?: string;
  eventDate?: string;
};

const initialEventFormInputs: EventFormInputs = {
  title: '',
  description: '',
  eventDate: '',
};

const EventForm = () => {
  // 이벤트 등록/수정 공용 폼. 제목·이벤트코드·시작일·세션 목록으로 구성됩니다.
  // 세션 추가·수정·삭제는 페이지 이동 없이 이 컴포넌트 내부 상태(인라인 편집)로
  // 처리하고, 이벤트 삭제는 이 폼 위에 뜨는 확인 모달로 처리합니다.
  // API(openapi v0.3): POST /events(등록), PATCH /events/{eventCode}(수정),
  // DELETE /events/{eventCode}(삭제), POST /events/{eventCode}/sessions(세션 추가),
  // PATCH /events/{eventCode}/sessions/{sessionId}(세션 수정),
  // DELETE /events/{eventCode}/sessions/{sessionId}(세션 삭제).
  const [eventFormInputs, setEventFormInputs] = useState<EventFormInputs>(initialEventFormInputs);
  const [eventFormErrors, setEventFormErrors] = useState<EventFormErrors>({});

  const router = useRouter();

  const { mutate, isPending, error } = useMutation({
    mutationFn: createEvent,
    onSuccess: () => router.push('/events'),
  });

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setEventFormInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const titleValidation = eventCreateRequestSchema.shape.title.safeParse(eventFormInputs.title);
    const descriptionValidation = eventCreateRequestSchema.shape.description.safeParse(
      eventFormInputs.description,
    );
    const eventDateValidation = eventCreateRequestSchema.shape.eventDate.safeParse(
      eventFormInputs.eventDate,
    );

    setEventFormErrors((prev) => ({
      ...prev,
      title: titleValidation.error?.issues[0]?.message,
      description: descriptionValidation.error?.issues[0]?.message,
      eventDate: eventDateValidation.error?.issues[0]?.message,
    }));

    if (titleValidation.success && descriptionValidation.success && eventDateValidation.success) {
      mutate(eventFormInputs);
    }
  };

  return (
    <>
      <h1 className="w-full max-w-190 text-xl font-semibold text-text-primary">이벤트 설정</h1>
      <form onSubmit={handleFormSubmit} className="w-full max-w-190 flex flex-col gap-6">
        <Field
          label="제목"
          name="title"
          placeholder="이벤트 제목을 입력하세요."
          value={eventFormInputs.title}
          onChange={handleInputChange}
          error={eventFormErrors.title}
        />
        <Field
          label="행사 날짜"
          name="eventDate"
          type="date"
          value={eventFormInputs.eventDate}
          onChange={handleInputChange}
          error={eventFormErrors.eventDate}
        />
        <section className="flex flex-col gap-1">
          <p className="text-xs font-normal leading-4 text-text-secondary">설명 (선택)</p>
          <Textarea
            invalid={Boolean(eventFormErrors.description)}
            maxLength={500}
            placeholder="이벤트에 대한 간단한 설명을 남겨주세요."
            value={eventFormInputs.description}
            onChange={handleInputChange}
          />
          <p
            className={
              eventFormErrors.description
                ? 'text-xs font-normal leading-4 text-negative-darker'
                : 'sr-only'
            }
            role="alert"
            aria-atomic="true"
          >
            {eventFormErrors.description}
          </p>
        </section>
        {error ? (
          <Banner type="negative" className="w-full">
            이벤트를 등록하지 못했습니다. 잠시 후 다시 시도해주세요.
          </Banner>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? '등록 중...' : '등록'}
          </Button>
        </div>
      </form>
    </>
  );
};

export default EventForm;
