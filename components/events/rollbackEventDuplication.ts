import { deleteEvent, deleteSession } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/apiClient';
import type { PulseEvent } from '@/lib/schemas/api';

type CreatedSession = { id: number; title: string }[];

const MAX_DELETE_RETRIES = 3;
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

const rollbackEventDuplication = async ({
  newEvent,
  createdSessions,
}: {
  newEvent: PulseEvent;
  createdSessions: CreatedSession;
}) => {
  const sessionDeleteResults = await Promise.all(
    createdSessions.map(async (session) => ({
      title: session.title,
      succeeded: await deleteWithRetry(
        () => deleteSession(newEvent.code, session.id),
        MAX_DELETE_RETRIES,
      ),
    })),
  );

  const eventDeleteResult = await deleteWithRetry(
    () => deleteEvent(newEvent.code),
    MAX_DELETE_RETRIES,
  );

  const failedSessionTitles = sessionDeleteResults
    .filter((result) => !result.succeeded)
    .map((result) => result.title);

  return {
    eventDeleteResult,
    failedSessionTitles,
  };
};

export default rollbackEventDuplication;
