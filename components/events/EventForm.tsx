'use client';

import { type ChangeEvent, type SubmitEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ChevronLeftIcon } from '@/components/ui/icons';
import ReportPanel from '@/components/report/ReportPanel';
import { showToast } from '@/hooks/useToast';
import { eventCreateRequestSchema, sessionCreateRequestSchema } from '@/lib/schemas/api';
import type { EventView, PulseEvent, SessionView } from '@/lib/schemas/api';
import {
  createEvent,
  createSession,
  deleteEvent,
  deleteSession,
  fetchEventByCode,
  fetchSessionsByEventCode,
  updateEvent,
  updateSession,
} from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';

interface EventFormProps {
  /** 있으면 수정 모드(기존 값 로드 + PATCH), 없으면 생성 모드(POST)입니다. */
  eventCode?: string;
  duplicateFrom?: string;
}

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

type IncompleteCleanup = {
  eventTitle: string;
  failedSessionTitles: string[];
  eventDeleted: boolean;
} | null;

type UndeletedItem = {
  type: '이벤트' | '세션';
  title: string;
};

const initialEventFormInputs: EventFormInputs = {
  title: '',
  description: '',
  eventDate: '',
};

/**
 * 세션 및 이벤트를 삭제하는 헬퍼 함수
 * @param deleteFn
 * @param maxRetries
 */
const deleteWithRetry = async (
  deleteFn: () => Promise<void>,
  maxRetries: number,
): Promise<boolean> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await deleteFn();
      return true;
    } catch (error) {
      const isAlreadyDeleted =
        error instanceof ApiError &&
        (error.code === 'EVENT_ALREADY_DELETED' || error.code === 'SESSION_ALREADY_DELETED');

      if (isAlreadyDeleted) {
        return true;
      }
    }
  }
  return false;
};

const getUndeletedItems = (failure: IncompleteCleanup): UndeletedItem[] => {
  if (!failure) {
    return [];
  }

  const items: UndeletedItem[] = failure.failedSessionTitles.map((title) => ({
    type: '세션' as const,
    title,
  }));

  if (!failure.eventDeleted) {
    items.unshift({ type: '이벤트', title: failure.eventTitle });
  }

  return items;
};

// 이벤트 등록/수정 공용 폼. 세션 추가·수정·삭제는 페이지 이동 없이 이 컴포넌트
// 내부 상태(인라인 편집)로 처리하고, 이벤트 삭제는 이 폼 위에 뜨는 확인 모달로 처리합니다.
// API(openapi v0.3): POST /events(등록), PATCH /events/{eventCode}(수정),
// DELETE /events/{eventCode}(삭제), POST /events/{eventCode}/sessions(세션 추가),
// PATCH /events/{eventCode}/sessions/{sessionId}(세션 수정),
// DELETE /events/{eventCode}/sessions/{sessionId}(세션 삭제).
const EventForm = ({ eventCode, duplicateFrom }: EventFormProps) => {
  const isEditMode = Boolean(eventCode);
  const isDuplicateMode = Boolean(duplicateFrom);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [eventFormInputs, setEventFormInputs] = useState<EventFormInputs>(initialEventFormInputs);
  const [eventFormErrors, setEventFormErrors] = useState<EventFormErrors>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [isAddingSession, setIsAddingSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);

  const [incompleteCleanup, setIncompleteCleanup] = useState<IncompleteCleanup>(null);

  const targetCode = isEditMode ? eventCode : duplicateFrom;

  const eventQuery = useQuery({
    queryKey: ['event', targetCode],
    queryFn: () => fetchEventByCode(targetCode as string),
    enabled: isEditMode || isDuplicateMode,
  });

  const sessionsQuery = useQuery({
    queryKey: ['sessions', targetCode],
    queryFn: () => fetchSessionsByEventCode(targetCode as string),
    enabled: isEditMode || isDuplicateMode,
  });
  const sessions: SessionView[] = sessionsQuery.data ?? [];

  // 쿼리 데이터가 새로 도착했을 때만 폼 입력값을 덮어씁니다(렌더링 중 상태 조정 —
  // useEffect로 하면 렌더가 한 번 더 겹치고 react-hooks/set-state-in-effect에 걸립니다).
  //
  // 초깃값을 undefined로 고정합니다. eventQuery.data로 초기화하면, TanStack Query 캐시가
  // 이전 방문에서 이미 이 이벤트를 받아온 상태로 재마운트될 때 loadedEventData가 처음부터
  // eventQuery.data와 같아져서 아래 비교가 한 번도 참이 되지 않고, 폼이 빈 값으로 남습니다.
  const [loadedEventData, setLoadedEventData] = useState<EventView | undefined>(undefined);
  if (eventQuery.data && eventQuery.data !== loadedEventData) {
    setLoadedEventData(eventQuery.data);
    setEventFormInputs({
      title: eventQuery.data.title,
      description: eventQuery.data.description ?? '',
      eventDate: isEditMode ? eventQuery.data.eventDate : '',
    });
  }

  const {
    mutate: saveEvent,
    isPending: isSaving,
    error: saveError,
  } = useMutation({
    mutationFn: async (body: EventFormInputs) => {
      if (isEditMode) {
        return updateEvent(eventCode as string, body);
      }

      const newEvent = await createEvent(body);
      const createdSessions: { id: number; title: string }[] = [];

      if (isDuplicateMode) {
        try {
          for (const session of sessions) {
            const createdSession = await createSession(newEvent.code, {
              title: session.title,
              order: session.order,
            });

            createdSessions.push({
              id: createdSession.id,
              title: createdSession.title,
            });
          }
        } catch (error) {
          const sessionDeleteResults = await Promise.all(
            createdSessions.map(async (session) => ({
              title: session.title,
              succeeded: await deleteWithRetry(() => deleteSession(newEvent.code, session.id), 3),
            })),
          );

          const eventDeleteResult = await deleteWithRetry(() => deleteEvent(newEvent.code), 3);

          const failedSessionTitles = sessionDeleteResults
            .filter((result) => !result.succeeded)
            .map((result) => result.title);

          if (failedSessionTitles.length > 0 || !eventDeleteResult) {
            setIncompleteCleanup({
              eventTitle: newEvent.title,
              failedSessionTitles,
              eventDeleted: eventDeleteResult,
            });
          }

          throw error;
        }
      }
      return newEvent;
    },
    onSuccess: () => {
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['event', eventCode] });
        showToast('저장했어요');
      } else {
        router.push('/events');
      }
    },
  });

  const { mutate: startEvent, isPending: isStarting } = useMutation({
    mutationFn: () => updateEvent(eventCode as string, { status: 'LIVE' }),
    onSuccess: (started) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventCode] });
      /*
       * 옮겨갈 대시보드는 상태를 이 단수 캐시가 아니라 내 이벤트 목록에서 코드로 찾아
       * 씁니다(`DashboardView.tsx:151`, `:306`). 목록을 그대로 두면 방금 `LIVE`가 된
       * 이벤트가 거기서는 여전히 `DRAFT`라, 배지가 "준비 중"으로 남고 그 상태에서만
       * 나오는 QR·링크 복사·종료 버튼도 함께 사라집니다(#284).
       *
       * `invalidateQueries`가 아니라 응답을 직접 꽂는 이유는, 무효화는 stale 표시일 뿐이라
       * 대시보드가 마운트되는 순간에는 여전히 캐시된 `DRAFT`를 한 번 그리기 때문입니다.
       * 방금 받은 이벤트가 정답이라 다시 물어볼 것도 없습니다.
       *
       * 목록을 거치지 않고 들어온 경우에는 채울 칸 자체가 없습니다. 그때는 갱신자가
       * `undefined`를 돌려주고, 대시보드가 마운트되면서 목록을 처음부터 받아옵니다.
       */
      queryClient.setQueryData<PulseEvent[]>(['myEvents'], (previous) =>
        previous?.map((item) => (item.code === started.code ? started : item)),
      );
      showToast('이벤트를 시작했어요');
      router.push(`/events/${eventCode}/dashboard`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'INVALID_EVENT_STATE_TRANSITION') {
        showToast('세션이 1개 이상 있어야 이벤트를 시작할 수 있어요');
      }
    },
  });

  const { mutate: removeEvent, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteEvent(eventCode as string),
    onSuccess: () => router.push('/events'),
  });

  const { mutate: addSession, isPending: isAddingSessionPending } = useMutation({
    mutationFn: (title: string) =>
      createSession(eventCode as string, { title, order: sessions.length + 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', eventCode] });
      setIsAddingSession(false);
      setNewSessionTitle('');
    },
  });

  const { mutate: editSession, isPending: isEditingSessionPending } = useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: number; title: string }) =>
      updateSession(eventCode as string, sessionId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', eventCode] });
      setEditingSessionId(null);
    },
  });

  const { mutate: removeSession, isPending: isRemovingSession } = useMutation({
    mutationFn: (sessionId: number) => deleteSession(eventCode as string, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', eventCode] });
      setDeletingSessionId(null);
      showToast('세션이 삭제되었어요');
    },
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
      saveEvent(eventFormInputs);
    }
  };

  const handleAddSessionConfirm = () => {
    const validation = sessionCreateRequestSchema.shape.title.safeParse(newSessionTitle);
    if (!validation.success) return;
    addSession(newSessionTitle);
  };

  const handleEditSessionStart = (session: SessionView) => {
    setEditingSessionId(session.id);
    setEditingSessionTitle(session.title);
  };

  const handleEditSessionConfirm = (sessionId: number) => {
    const validation = sessionCreateRequestSchema.shape.title.safeParse(editingSessionTitle);
    if (!validation.success) return;
    editSession({ sessionId, title: editingSessionTitle });
  };

  const handleEditSessionCancel = () => {
    setEditingSessionId(null);
  };

  const handleAddSessionCancel = () => {
    setIsAddingSession(false);
    setNewSessionTitle('');
  };

  if (isEditMode && eventQuery.isPending) {
    return <p>불러오는 중...</p>;
  }

  if (isEditMode && eventQuery.data?.status === 'ENDED') {
    return <ReportPanel />;
  }

  let formTitle = '새 이벤트 만들기';
  if (isEditMode) {
    formTitle = '이벤트 수정하기';
  } else if (isDuplicateMode) {
    formTitle = '이벤트 복제하기';
  }

  return (
    <>
      <div className="w-full max-w-190">
        <button
          type="button"
          className="-ml-1 flex cursor-pointer items-center rounded p-1 text-text-secondary hover:bg-background-secondary"
          aria-label="이벤트 목록으로 돌아가기"
          onClick={() => router.push('/events')}
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
      </div>
      <h1 className="w-full max-w-190 text-xl font-semibold text-text-primary">{formTitle}</h1>
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
        {isEditMode && eventQuery.data ? (
          // window 접근은 이 블록이 eventQuery.data가 있을 때만 렌더링되기 때문에 안전합니다.
          // 서버 렌더링에서는 eventQuery.data가 항상 비어있어 이 줄까지 오지 않습니다
          // (DashboardView.tsx의 publicUrl과 같은 이유입니다).
          <Field
            label="참가자 링크"
            name="code"
            value={`${window.location.origin}/e/${eventQuery.data.code}`}
            readOnly
          />
        ) : null}
        <section className="flex flex-col gap-1">
          <p className="text-xs font-normal leading-4 text-text-secondary">설명 (선택)</p>
          <Textarea
            name="description"
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

        {isEditMode ? (
          <section className="flex flex-col gap-2">
            <p className="text-xs font-normal leading-4 text-text-secondary">세션 목록</p>
            {sessions.map((session, index) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border-default px-4 py-3"
              >
                {editingSessionId === session.id ? (
                  <>
                    <input
                      className="flex-1 rounded border border-border-default px-2 py-1 text-sm"
                      placeholder="세션 이름 입력"
                      value={editingSessionTitle}
                      onChange={(event) => setEditingSessionTitle(event.target.value)}
                    />
                    <Button type="button" variant="secondary" onClick={handleEditSessionCancel}>
                      취소
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isEditingSessionPending}
                      onClick={() => handleEditSessionConfirm(session.id)}
                    >
                      확인
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-text-primary">
                      {index + 1}. {session.title}
                    </span>
                    <div className="flex gap-2 text-xs text-text-secondary">
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => handleEditSessionStart(session)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => setDeletingSessionId(session.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {isAddingSession ? (
              <div className="flex items-center gap-2 rounded-lg border border-border-default px-4 py-3">
                <input
                  className="flex-1 rounded border border-border-default px-2 py-1 text-sm"
                  placeholder="세션 이름 입력"
                  value={newSessionTitle}
                  onChange={(event) => setNewSessionTitle(event.target.value)}
                  autoFocus
                />
                <Button type="button" variant="secondary" onClick={handleAddSessionCancel}>
                  취소
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isAddingSessionPending}
                  onClick={handleAddSessionConfirm}
                >
                  확인
                </Button>
              </div>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setIsAddingSession(true)}>
                + 세션추가
              </Button>
            )}
          </section>
        ) : null}

        {saveError ? (
          <Banner type="negative" className="w-full">
            {isEditMode
              ? '이벤트를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'
              : '이벤트를 등록하지 못했습니다. 잠시 후 다시 시도해주세요.'}
          </Banner>
        ) : null}

        {incompleteCleanup ? (
          <Banner type="negative" className="w-full">
            <span className="whitespace-pre-line">
              {`다음 항목이 정리되지 않았습니다.\n${getUndeletedItems(incompleteCleanup)
                .map((item) => `${item.type} '${item.title}'`)
                .join(', ')}\n이벤트 목록에서 직접 삭제해주세요.`}
            </span>
          </Banner>
        ) : null}

        <div className="flex justify-end gap-2">
          {isEditMode ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              삭제
            </Button>
          ) : null}
          <Button type="submit" variant="secondary" disabled={isSaving}>
            {isSaving ? '저장 중...' : isEditMode ? '저장' : '등록'}
          </Button>
          {isEditMode && eventQuery.data?.status === 'DRAFT' ? (
            <Button
              type="button"
              variant="primary"
              disabled={isStarting}
              onClick={() => startEvent()}
            >
              {isStarting ? '시작 중...' : '이벤트 시작'}
            </Button>
          ) : null}
        </div>
      </form>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title="이벤트를 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요"
        onClose={() => setIsDeleteDialogOpen(false)}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setIsDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isDeleting}
              onClick={() => removeEvent()}
            >
              삭제
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={deletingSessionId !== null}
        title="세션을 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요"
        onClose={() => setDeletingSessionId(null)}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setDeletingSessionId(null)}>
              취소
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isRemovingSession}
              onClick={() => deletingSessionId !== null && removeSession(deletingSessionId)}
            >
              삭제
            </Button>
          </>
        }
      />
    </>
  );
};

export default EventForm;
