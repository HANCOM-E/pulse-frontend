'use client';

import { type ChangeEvent, type SubmitEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import ReportPanel from '@/components/report/ReportPanel';
import { showToast } from '@/hooks/useToast';
import { eventCreateRequestSchema, sessionCreateRequestSchema } from '@/lib/schemas/api';
import type { SessionView } from '@/lib/schemas/api';
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

const initialEventFormInputs: EventFormInputs = {
  title: '',
  description: '',
  eventDate: '',
};

// 이벤트 등록/수정 공용 폼. 세션 추가·수정·삭제는 페이지 이동 없이 이 컴포넌트
// 내부 상태(인라인 편집)로 처리하고, 이벤트 삭제는 이 폼 위에 뜨는 확인 모달로 처리합니다.
// API(openapi v0.3): POST /events(등록), PATCH /events/{eventCode}(수정),
// DELETE /events/{eventCode}(삭제), POST /events/{eventCode}/sessions(세션 추가),
// PATCH /events/{eventCode}/sessions/{sessionId}(세션 수정),
// DELETE /events/{eventCode}/sessions/{sessionId}(세션 삭제).
const EventForm = ({ eventCode }: EventFormProps) => {
  const isEditMode = Boolean(eventCode);
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

  const eventQuery = useQuery({
    queryKey: ['event', eventCode],
    queryFn: () => fetchEventByCode(eventCode as string),
    enabled: isEditMode,
  });

  const sessionsQuery = useQuery({
    queryKey: ['sessions', eventCode],
    queryFn: () => fetchSessionsByEventCode(eventCode as string),
    enabled: isEditMode,
  });
  const sessions: SessionView[] = sessionsQuery.data ?? [];

  // 쿼리 데이터가 새로 도착했을 때만 폼 입력값을 덮어씁니다(렌더링 중 상태 조정 —
  // useEffect로 하면 렌더가 한 번 더 겹치고 react-hooks/set-state-in-effect에 걸립니다).
  const [loadedEventData, setLoadedEventData] = useState(eventQuery.data);
  if (eventQuery.data && eventQuery.data !== loadedEventData) {
    setLoadedEventData(eventQuery.data);
    setEventFormInputs({
      title: eventQuery.data.title,
      description: eventQuery.data.description ?? '',
      eventDate: eventQuery.data.eventDate,
    });
  }

  const {
    mutate: saveEvent,
    isPending: isSaving,
    error: saveError,
  } = useMutation({
    mutationFn: (body: EventFormInputs) =>
      isEditMode ? updateEvent(eventCode as string, body) : createEvent(body),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventCode] });
      showToast('이벤트를 시작했어요');
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

  if (isEditMode && eventQuery.isPending) {
    return <p>불러오는 중...</p>;
  }

  if (isEditMode && eventQuery.data?.status === 'ENDED') {
    return <ReportPanel />;
  }

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
        {isEditMode && eventQuery.data ? (
          <Field
            label="참가자 링크"
            name="code"
            value={`pulse.app/e/${eventQuery.data.code}`}
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
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border-default px-4 py-3"
              >
                {editingSessionId === session.id ? (
                  <>
                    <input
                      className="flex-1 rounded border border-border-default px-2 py-1 text-sm"
                      value={editingSessionTitle}
                      onChange={(event) => setEditingSessionTitle(event.target.value)}
                    />
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
                    <span className="text-sm text-text-primary">{session.title}</span>
                    <div className="flex gap-2 text-xs text-text-secondary">
                      <button type="button" onClick={() => handleEditSessionStart(session)}>
                        수정
                      </button>
                      <button type="button" onClick={() => setDeletingSessionId(session.id)}>
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
                  placeholder="세션 제목을 입력하세요."
                  value={newSessionTitle}
                  onChange={(event) => setNewSessionTitle(event.target.value)}
                  autoFocus
                />
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
