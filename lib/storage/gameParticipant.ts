/**
 * 게임 참가 기록입니다.
 *
 * 공개 응답에 `clientId`가 없어서(계약대로) 화면이 참가자 목록에서 자기를 못 고릅니다.
 * 참가 응답의 `id`를 여기 적어두고, 그걸로 명단에서 자기 구슬을 찾습니다.
 *
 * `RUNNING`이 되면 `POST /participants`가 `GAME_NOT_OPEN`으로 막혀서 다시 물어볼 수도
 * 없습니다. 저장을 빠뜨리면 레이스가 시작된 뒤 영영 못 찾습니다.
 *
 *   키   pulse:game-participant:{gameId}   값   participantId
 *   키   pulse:game-nickname               값   닉네임 문자열
 *
 * 이 파일이 키 문자열을 아는 유일한 곳입니다. 화면에서 localStorage를 직접 부르지
 * 마세요. 오타가 나도 에러가 아니라 "기록 없음"으로 조용히 읽혀서 찾기 어렵습니다
 * (`lib/storage/submitted.ts`와 같은 규칙).
 */
const participantKey = (gameId: number) => `pulse:game-participant:${gameId}`;

/**
 * 닉네임은 게임이 아니라 브라우저에 붙습니다. 한 행사에서 게임을 여러 번 하는데 매번
 * 이름을 다시 치게 하면 들어오다 맙니다. 다른 행사에 가도 쓰던 이름이 뜨는 게 자연스럽습니다.
 */
const NICKNAME_KEY = 'pulse:game-nickname';

/**
 * `useSyncExternalStore`용 구독입니다.
 *
 * `localStorage`는 React 밖에 있는 저장소라, 화면이 그 값을 읽으려면 "언제 바뀌는지"를
 * 알려줘야 합니다. effect에서 `setState`로 옮겨 담는 방식은 React 19에서 막혔습니다
 * (cascading render). 쓰는 쪽이 이 파일뿐이라 쓰기 함수가 직접 알립니다.
 */
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const emit = (): void => {
  for (const listener of listeners) listener();
};

/**
 * 서버에는 localStorage가 없어 항상 `null`입니다. 호출부는 첫 렌더에서 "기록 없음"으로
 * 그렸다가 마운트 후 다시 그려야 합니다.
 *
 * Safari 시크릿 모드는 접근 자체를 막습니다. 던지는 대신 "기록 없음"과 같게 취급합니다.
 */
const readRaw = (key: string): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** 저장 실패는 무시합니다. 참가 자체는 이미 서버에 들어갔습니다. */
const writeRaw = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 용량 초과 또는 시크릿 모드
  }
};

/** 이 게임에 참가한 적이 있으면 그때 받은 participantId를 줍니다. */
const readParticipantId = (gameId: number): number | null => {
  const raw = readRaw(participantKey(gameId));
  if (raw === null) return null;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * 참가 성공 직후 부릅니다.
 *
 * 유한하지 않은 값은 저장하지 않습니다. 문자열로 굳으면 읽을 때 `Number('NaN')`이
 * 다시 `NaN`이 되어 기록이 조용히 사라집니다.
 */
const rememberParticipant = (gameId: number, participantId: number): void => {
  if (!Number.isInteger(participantId) || participantId <= 0) return;

  writeRaw(participantKey(gameId), String(participantId));
  emit();
};

/** 입력창 기본값으로 씁니다. 없으면 빈 문자열이라 그대로 넣으면 됩니다. */
const readNickname = (): string => readRaw(NICKNAME_KEY) ?? '';

/** 참가에 성공한 이름만 남깁니다. 입력 중인 값을 저장하면 욕설 검사를 통과 못 한 이름이 굳습니다. */
const rememberNickname = (nickname: string): void => {
  const trimmed = nickname.trim();
  if (trimmed.length === 0) return;

  writeRaw(NICKNAME_KEY, trimmed);
  emit();
};

export { readNickname, readParticipantId, rememberNickname, rememberParticipant, subscribe };
