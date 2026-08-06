# MSW 목 서버

프론트 3축이 백엔드 없이 각자 화면을 붙일 수 있게 만든 목 서버입니다.
계약 원본은 Notion [API 명세서](https://app.notion.com/p/f3f5f62e868482ee9faf816de775057c) 2026-08-06 갱신본이며,
여기 있는 스키마·핸들러가 백엔드 연동의 단일 소스입니다(CLAUDE.md "백엔드 연동 원칙").

## 쓰는 법

```bash
npm run dev
```

환경변수를 따로 만들 필요 없습니다. 개발 모드에서는 기본으로 켜지고, 프로덕션 빌드에서는 항상 꺼집니다.
실제 백엔드에 붙여볼 때만 `.env.local`에 `NEXT_PUBLIC_API_MOCKING=disabled`를 넣습니다.

확인용 페이지가 두 개 있습니다. 각 축이 자기 화면을 붙이고 나면 지워도 됩니다.

| 주소 | 확인하는 것 |
|---|---|
| `/dev/msw` | 브라우저 워커. 로그인·집계 폴링·모더레이션 숨김/해제 |
| `/dev/msw/ssr` | 서버 목(`msw/node`). 서버 컴포넌트 fetch가 가로채지는지 |

화면 코드는 경로 문자열을 직접 만들지 말고 `lib/api/endpoints.ts`의 함수를 호출합니다.
응답을 계약 스키마로 한 번 검사하기 때문에, BE 응답이 명세와 어긋나면 화면이 아니라 거기서 먼저 터집니다.

## 시드 데이터

로그인 계정은 `host@example.com` / `pulse1234` 하나입니다.

| code | 상태 | 용도 |
|---|---|---|
| `ab3f9x` | LIVE | 대시보드·실시간·모더레이션. 세션 3개, 독성·미분류 소감 포함 |
| `kd7m2p` | ENDED | 공개 리포트. 리포트가 GENERATED·`isPublic=true` |
| `zq1v8t` | DRAFT | 세션 0개. LIVE 전이 409를 확인하는 용도 |

상태는 메모리에만 있습니다. 새로고침하면 시드로 돌아갑니다.

## 구조

```
mocks/
├── config.ts            목 on/off 판정
├── browser.ts           브라우저 워커 (MswProvider가 시작)
├── server.ts            서버 목 (instrumentation.ts가 시작)
├── handlers.ts          핸들러 합치는 곳
├── handlers.test.ts     계약 스모크 테스트 (npm run test)
├── data/
│   ├── seed.ts          시드 데이터
│   └── store.ts         인메모리 저장소 + 집계
└── handlers/
    ├── shared.ts        에러 봉투·인증·소유자 확인·바디 검증
    └── auth.ts / event.ts / feedback.ts / admin.ts / report.ts
```

미확정 엔드포인트를 모아두던 `proposed.ts`는 2026-08-06에 다섯 건이 전부 명세로 확정되면서 없어졌습니다.
지금은 전 핸들러가 확정 계약입니다.

## 경로 규칙

**이벤트를 가리키는 경로 파라미터는 전부 `eventCode`입니다.** 공개 응답에서 내부 `id`가 빠지면서
화면이 숫자 id를 얻을 방법 자체가 없어졌습니다. 저장소 내부는 여전히 숫자 id로 관계를 잇고,
경계에서만 code를 씁니다(`toEventView`/`toSessionView`가 그 변환입니다).

공개뷰에서 빠지는 필드:

| 응답 | 빠지는 것 | 남는 이유 |
|---|---|---|
| `EventView` | `id`, `ownerId` | — |
| `SessionView` | `eventId`, `status` | `id`는 남습니다. 소감 제출에 `sessionId`가 필수입니다 |
| `FeedbackView` | `toxic`, `taggerVersion`, `status` | 공개 경로에 모더레이션 신호를 노출하지 않습니다 |

`GET /events/{eventCode}/report` 하나만 **같은 경로가 인증 여부로 갈립니다.**

- Bearer 있고 소유자 → `Report` 전체(`status`·`isPublic` 포함). 생성 진행 폴링용입니다.
- Bearer 없음 → 공개·생성완료일 때만 `PublicReport`, 아니면 404.

`endpoints.ts`에서 `fetchOwnReport`/`fetchPublicReport`가 이 한 경로를 나눠 씁니다.
게스트 응답을 받아야 하는 자리에서 `skipAuth`를 빼먹으면 로그인 상태일 때 스키마 검증이 터집니다.

## 알아둘 것

- 모더레이션 큐는 기본적으로 `VISIBLE`만 돌려줍니다. `includeHidden=true`를 붙여야 `HIDDEN`이 들어옵니다.
  `DELETED`는 어느 쪽이든 나오지 않습니다.

- **`next.config.ts`의 `serverExternalPackages: ['msw']`를 지우면 SSR에서 목이 죽습니다.**
  Next가 `msw`를 서버 번들에 넣으면 번들된 사본이 `globalThis.fetch`를 패치하게 되고,
  정작 렌더러가 쓰는 fetch는 그대로라 SSR 요청만 목을 통과해 실제 주소로 나갑니다.
  `[msw] 서버 목 활성화됨` 로그는 그대로 찍히는데 `TypeError: fetch failed`(`ECONNREFUSED`)만
  나므로 목 문제로 안 보입니다. 브라우저 워커는 멀쩡하니 `/dev/msw`만 보고 판단하면 놓칩니다.
- **`instrumentation.ts`는 서버가 뜰 때 한 번만 실행됩니다.** 이 코드를 처음 받은 뒤에는
  `npm run dev`를 재시작해야 서버 목이 붙습니다(핫리로드로는 안 붙습니다).
  붙었으면 터미널에 `[msw] 서버 목 활성화됨`이 찍힙니다.
- **`msw` 패키지와 `public/mockServiceWorker.js` 버전이 같아야 합니다.**
  `msw`를 올리면 `npx msw init public/`를 다시 돌립니다.
- 소감 제출은 `X-Client-Id` 헤더가 필요합니다(분당 3회 제한 키). `lib/clientId.ts`가 만듭니다.
- 목록 응답은 `{ items: [...] }` 봉투입니다. `endpoints.ts`가 벗겨서 배열로 돌려줍니다.

## 핸들러 추가할 때

1. Notion 명세를 먼저 고칩니다(BE 스펙 변경은 김효인 님 확인이 선행입니다).
2. `lib/schemas/api.ts`에 스키마를 추가합니다. 타입은 `z.infer`로 따라옵니다.
3. 도메인에 맞는 `handlers/*.ts`에 핸들러를 추가합니다.
4. `handlers.test.ts`에 성공 1개 + 실패 코드 1개를 추가합니다.

명세에 없는데 화면에 필요한 엔드포인트가 또 생기면, 확정 핸들러에 섞지 말고 별도 파일로 분리한 뒤
`⚠️` 주석으로 미확정임을 남깁니다. 확정되면 도메인 핸들러로 옮기고 그 파일을 지웁니다.
