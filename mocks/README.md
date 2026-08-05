# MSW 목 서버

프론트 3축이 백엔드 없이 각자 화면을 붙일 수 있게 만든 목 서버입니다.
계약 원본은 Notion [openapi.yaml v0.2](https://app.notion.com/p/3b25f62e868481dbbf3efcb698ecb072)이며,
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
    ├── shared.ts        에러 봉투·인증·바디 검증
    ├── auth.ts / event.ts / feedback.ts / admin.ts / report.ts
    └── proposed.ts      ⚠️ BE 미확정 엔드포인트
```

## ⚠️ `proposed.ts` — 아직 계약이 아닌 것

명세에 없는데 화면에 필요해서 목에서만 먼저 연 엔드포인트입니다.
`lib/api/endpoints.ts`에서도 `⚠️` 주석이 붙은 함수가 이것들입니다.
김효인 님 확인 전까지는 **여기 있는 응답이 곧 제안서**이고, 확정되면 확정 핸들러로 옮깁니다.

| 엔드포인트 | 없으면 안 되는 이유 |
|---|---|
| `GET /events/{eventCode}/sessions` | 요구사항은 Session CRUD인데 API에는 생성·삭제만 있습니다. 세션 목록이 없으면 게스트가 제출할 세션을 못 고르고(`POST /feedbacks`는 `sessionId` 필수), 대시보드·모더레이션도 세션 탭을 못 그립니다. `GET /events/{eventCode}` 응답에 `sessions[]`를 넣는 쪽이 왕복 1회로 끝나 더 낫습니다. |
| `PATCH /admin/feedbacks/{id}/show` | 요구사항 소감 상태 전이 4번에 `HIDDEN → VISIBLE`이 있는데 API에는 `/hide`, `/delete`뿐입니다. |
| `GET /admin/feedbacks?status=` | 숨김 해제 UI에는 `HIDDEN` 건도 큐에 나와야 합니다. |
| `GET /admin/events/{eventId}/report` | 확정된 `GET /events/{eventCode}/report`는 공개용이라 비공개 리포트에 404를 냅니다. 주최자가 `GENERATING → GENERATED` 진행 상태를 볼 경로가 없습니다. 경로를 `/admin/*`으로 잡은 이유는 `{eventCode}`와 `{eventId}`가 라우팅상 같은 패턴이라 같은 자리에 GET을 둘 수 없기 때문입니다. |
| `PATCH /admin/events/{eventId}/report` | 요구사항 "3. 리포트 공개"의 `isPublic` 토글에 대응하는 엔드포인트가 없습니다. |

## 알아둘 것

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
3. 도메인에 맞는 `handlers/*.ts`에 핸들러를 추가합니다. 확정 전이면 `proposed.ts`에 둡니다.
4. `handlers.test.ts`에 성공 1개 + 실패 코드 1개를 추가합니다.
