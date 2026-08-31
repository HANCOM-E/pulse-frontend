import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { showToast } from '@/hooks/useToast';
import { createSession, deleteSession, updateSession } from '@/lib/api/endpoints';
import { sessionCreateRequestSchema, type SessionView } from '@/lib/schemas/api';

interface SessionListProps {
  sessions: SessionView[];
  eventCode: string | undefined;
}

const SessionList = ({ sessions, eventCode }: SessionListProps) => {
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);

  const queryClient = useQueryClient();

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

  return (
    <>
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
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      handleEditSessionConfirm(session.id);
                    }
                  }}
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
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  handleAddSessionConfirm();
                }
              }}
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

export default SessionList;
