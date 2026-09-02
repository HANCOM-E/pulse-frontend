'use client';

import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';

interface EventDateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// year·month·day가 실제로 존재하는 달력 날짜인지 확인한다. new Date(2026, 1, 30)처럼
// 존재하지 않는 날짜를 넘기면 JS는 에러 없이 3월로 넘겨버리므로(2월 30일 -> 3월 2일),
// 만든 Date에서 다시 연/월/일을 읽어 원래 입력과 같은지 대조해야 한다.
const isRealCalendarDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

// "YYYY-MM-DD"를 new Date(문자열)로 파싱하면 UTC 자정으로 읽혀서, 타임존에 따라
// 하루가 밀린다(lib/formatEventDate.ts와 같은 이유). 지역 시간 그대로 연/월/일을
// 읽어 Date를 만든다. 자릿수는 맞아도 51월처럼 실제로 없는 날짜면(타이핑 중일 수
// 있음) undefined를 돌려줘서 캘린더가 엉뚱한 달로 튀지 않게 한다.
const parseIsoDate = (value: string): Date | undefined => {
  const match = value.match(ISO_DATE_PATTERN);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  return isRealCalendarDate(y, m, d) ? new Date(y, m - 1, d) : undefined;
};

// Date.toISOString()은 UTC로 변환하므로 같은 이유로 쓰지 않는다. 지역 시간의
// 연/월/일을 그대로 문자열로 만든다.
const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// 타이핑 중인 숫자 0~8자리를 부모에 전달할 형태("2026-09" 처럼 다 못 채운 상태도
// 그대로)로 만든다. 다 채우지 못한 채로 등록을 누르면, 이 값이 그대로 lib/schemas/api.ts의
// calendarDate 스키마(정확히 YYYY-MM-DD만 통과) 검증에 걸려 저장이 막힌다(#312 후속).
const digitsToDraftValue = (digits: string) =>
  [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join('-');

// 타이핑 중인 숫자 8자리(YYYYMMDD)를 네이티브 date input과 같은 형식("2026. 09. 02.")으로
// 끊어 보여준다. slice로 연도를 4자리에서 강제로 자르기 때문에, 네이티브 date input에서
// 겪었던 "연도 자리가 4자리를 넘겨도 계속 받아들이는" 문제 자체가 여기서는 생길 수 없다.
const formatDraft = (digits: string) => {
  const segments = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean);
  return segments.length ? `${segments.join('. ')}.` : '';
};

/**
 * 네이티브 `<input type="date">`의 연도 자리가 4자리를 넘겨도 계속 숫자를 받아들이는
 * Chromium 버그(https://issues.chromium.org/issues/41235379, #312)를 피하려고
 * react-day-picker 팝오버로 대체한 행사 날짜 입력입니다. 자릿수를 우리 코드가 직접
 * 세기 때문에, 숫자 8자리(예: 20260902)를 타이핑해서 바로 날짜를 입력할 수도 있습니다.
 */
const EventDateField = ({ label, value, onChange, error }: EventDateFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rawDigits, setRawDigits] = useState(() => value.replaceAll('-', ''));
  // 8자리를 다 못 채운 채 필드를 벗어났을 때만 "8자리로 입력하라"는 안내를 보여준다.
  // 타이핑하는 도중(초점이 있는 동안)에는 아직 다 안 썼을 뿐이라 안내를 띄우지 않는다.
  const [showIncompleteHint, setShowIncompleteHint] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const errorId = `${id}-error`;

  // 캘린더 클릭으로 값이 바뀌면(또는 외부에서 값이 바뀌면) 타이핑 중이던 자리도 맞춘다.
  // 렌더링 중 상태 조정입니다(EventForm.tsx의 loadedEventData와 같은 이유로 useEffect가
  // 아니라 여기서 직접 처리합니다 — 렌더가 한 번 더 겹치고 react-hooks/set-state-in-effect에
  // 걸립니다).
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setRawDigits(value.replaceAll('-', ''));
  }

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // 타이핑되는 대로 항상 부모(EventForm)의 값을 그대로 갱신한다. 8자리를 다 채운
  // 유효한 날짜일 때만 반영하던 예전 방식은, 다 못 채운 채로 등록을 누르면 부모가
  // 여전히 이전 값을 들고 있어서 조용히 예전 날짜로 저장되는 문제가 있었다(#312 후속).
  const handleRawInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
    setRawDigits(digits);
    onChange(digitsToDraftValue(digits));
  };

  // 화면에 보이는 값은 우리가 만든 마스크("2026. 09. 02.")라, 커서 바로 앞 글자가
  // 숫자가 아니라 마침표·공백일 때가 있다. 그 상태로 브라우저 기본 백스페이스에 맡기면
  // 마침표만 지워지고 숫자 개수는 그대로라 화면이 안 바뀐 것처럼 보인다. 그래서
  // Backspace·Delete는 항상 "마지막 숫자 하나 지우기"로 직접 처리한다.
  const handleRawKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    event.preventDefault();

    const { selectionStart, selectionEnd } = event.currentTarget;
    const hasSelection =
      selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd;

    const digits = hasSelection ? '' : rawDigits.slice(0, -1);
    setRawDigits(digits);
    onChange(digitsToDraftValue(digits));
  };

  const handleFocus = () => {
    setIsOpen(true);
    setShowIncompleteHint(false);
  };

  const handleBlur = () => {
    if (rawDigits.length > 0 && rawDigits.length < 8) {
      setShowIncompleteHint(true);
    }
  };

  const draftIsIncomplete = showIncompleteHint && rawDigits.length > 0 && rawDigits.length < 8;
  const draftIsInvalidDate =
    rawDigits.length === 8 &&
    !isRealCalendarDate(
      Number(rawDigits.slice(0, 4)),
      Number(rawDigits.slice(4, 6)),
      Number(rawDigits.slice(6, 8)),
    );

  let localError: string | undefined;
  if (draftIsInvalidDate) {
    localError = '올바른 날짜가 아닙니다.';
  } else if (draftIsIncomplete) {
    localError = '행사 날짜는 8자리 숫자(YYYYMMDD)로 입력해야 합니다.';
  }

  const displayedError = localError ?? error;
  const selectedDate = parseIsoDate(value);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-normal leading-4 text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="행사 날짜를 입력하세요. (예: 20260902)"
        value={formatDraft(rawDigits)}
        onChange={handleRawInputChange}
        onKeyDown={handleRawKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={`${id}-calendar`}
        aria-describedby={errorId}
        className={`h-12 w-full rounded-lg border px-3.5 text-base font-normal leading-6 text-text-primary placeholder:text-text-disabled transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-darker ${
          displayedError
            ? 'border-negative-default'
            : 'border-border-default focus:border-primary-darker'
        }`}
      />

      {isOpen ? (
        <div
          id={`${id}-calendar`}
          role="dialog"
          aria-label={label}
          className="absolute top-full z-10 mt-1 rounded-lg border border-border-default bg-background-default p-2 shadow-dialog"
        >
          <DayPicker
            mode="single"
            locale={ko}
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              // rawDigits는 위 "값이 바뀌면 맞춘다" 렌더링 중 조정 로직이 알아서
              // 새 value에 맞춰 갱신하므로, 여기서 직접 건드리지 않는다.
              onChange(toIsoDate(date));
              setIsOpen(false);
            }}
            classNames={{
              months: 'flex',
              month: 'flex flex-col gap-2',
              month_caption:
                'flex items-center justify-center h-9 text-sm font-medium text-text-primary',
              nav: 'flex items-center justify-between absolute inset-x-1 top-0 h-9',
              button_previous:
                'flex h-7 w-7 items-center justify-center rounded hover:bg-background-muted',
              button_next:
                'flex h-7 w-7 items-center justify-center rounded hover:bg-background-muted',
              weekdays: 'flex',
              weekday: 'w-9 text-center text-xs font-normal text-text-secondary',
              week: 'flex',
              day: 'p-0 text-center',
              day_button:
                'flex h-9 w-9 items-center justify-center rounded-full text-sm text-text-primary hover:bg-background-muted',
              selected: 'bg-primary-darker text-text-inverse hover:bg-primary-pressed',
              today: 'font-semibold',
              outside: 'text-text-disabled',
              disabled: 'text-text-disabled',
            }}
          />
        </div>
      ) : null}

      <p
        id={errorId}
        className={
          displayedError ? 'text-xs font-normal leading-4 text-negative-darker' : 'sr-only'
        }
        role="alert"
        aria-atomic="true"
      >
        {displayedError}
      </p>
    </div>
  );
};

export default EventDateField;
