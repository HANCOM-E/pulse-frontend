'use client';

import { useSyncExternalStore } from 'react';

/** 토스트가 화면에 머무는 시간입니다. */
const DURATION_MS = 4_000;

/**
 * 사라지는 애니메이션 길이입니다. `globals.css`의 `--animate-toast-out`과 같아야 합니다.
 *
 * 이 구간은 `prefers-reduced-motion`과 무관하게 항상 돕니다. 퇴장은 불투명도만
 * 바뀌고 이동이 없어서, 모션을 줄이는 설정이 막으려는 대상이 아닙니다. 여기서
 * 갈라놓으면 모션 판단이 CSS와 JS 두 곳에 생기고, 완전히 보이는 시간도
 * 4초와 4.2초로 어긋납니다.
 */
const EXIT_MS = 200;

interface ToastState {
  id: number;
  message: string;
  isLeaving: boolean;
}

/**
 * 상태를 모듈 변수로 둡니다. Context를 쓰지 않는 이유는 두 가지입니다.
 *
 * 하나는 호출부가 훅 없이 `showToast('...')`만 부르면 되기 때문이고,
 * 다른 하나는 프로바이더가 하나 더 늘지 않기 때문입니다. 동시에 하나만 뜨는
 * 구조라 공유할 상태가 객체 하나뿐입니다.
 */
let state: ToastState | null = null;
let listeners: (() => void)[] = [];
let lastId = 0;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let removeTimer: ReturnType<typeof setTimeout> | undefined;

const setState = (next: ToastState | null) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/**
 * 토스트를 띄웁니다. 이미 떠 있으면 갈아치웁니다.
 *
 * 성공·확인에만 씁니다. 실패는 Banner입니다 — 토스트는 몇 초 뒤 사라져서
 * 다른 곳을 보던 사용자가 놓칩니다.
 */
const showToast = (message: string) => {
  clearTimeout(hideTimer);
  clearTimeout(removeTimer);

  lastId += 1;
  setState({ id: lastId, message, isLeaving: false });

  hideTimer = setTimeout(() => {
    if (state) setState({ ...state, isLeaving: true });
    removeTimer = setTimeout(() => setState(null), EXIT_MS);
  }, DURATION_MS);
};

const subscribe = (listener: () => void) => {
  listeners.push(listener);

  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
};

const getSnapshot = () => state;
const getServerSnapshot = () => null;

/** 현재 떠 있는 토스트입니다. `ToastViewport`만 씁니다. */
const useToast = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export { showToast, useToast, DURATION_MS };
export type { ToastState };
