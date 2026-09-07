<!-- 배너 이미지를 넣으세요. 예시 저장소는 노션 커버를 썼습니다.
     <img width="1680" height="320" alt="Pulse" src="…" /> -->

# Pulse — 현장의 반응을 실시간으로 모으는 서비스

<div align="left">

행사 참가자의 한줄 소감을 실시간으로 모아 **브라우저에서 감정을 분석하고**,<br />
주최자에게 실시간 대시보드와 종료 후 리포트로 보여주는 서비스입니다.

</div>

> 이 저장소는 **프론트엔드**입니다. 백엔드는 [`pulse-backend`](https://github.com/HANCOM-E/pulse-backend)에서 관리합니다.

<br />

## 🧩 Quick Link

- 🏠 [서비스 바로가기](https://pulse-frontend-eosin.vercel.app)
- 🎬 [데모 영상](https://…) <!-- 사전 녹화 영상 -->
- 🗂️ [백엔드 저장소](https://github.com/HANCOM-E/pulse-backend)
- 📚 [전체 문서 보기](#-documents)

<br />

## 👋 Introduction

<!-- 화면 스크린샷 3~4장을 넣으세요.
     소감 입력 / 실시간 대시보드 / 프로젝터 미니게임 / 종료 후 리포트 순을 권합니다.
<p align="center">
  <img width="1920" alt="소감 입력" src="…" />
  <img width="1920" alt="실시간 대시보드" src="…" />
</p>
-->

행사장에서 주최자는 참가자 반응을 표정으로 짐작하고, 참가자는 설문을 귀찮아합니다. Pulse는 그 사이를 **한줄 소감과 실시간 대시보드**로 잇습니다.

- **참가자**: QR로 입장 → 한줄 소감 제출 → 실시간 반응 확인 → 종료 후 리포트 열람
- **주최자**: 이벤트·세션 관리 → 실시간 대시보드 모니터링 → 부적절한 소감 숨김 → 종료 후 리포트 생성
- **발표자**: 자기 세션의 반응만 따로 확인
- **프로젝터**: 참여를 유도하는 미니게임 진행

> **기간**: 2026.08 ~ 2026.09<br />
> **팀 구성**: FE 3명, BE 1명

<br />

## 🏛️ Architecture

<!-- 아키텍처 다이어그램을 넣으세요. 발표 자료 7번 슬라이드를 그대로 쓸 수 있습니다. -->

```
브라우저 (참가자 · 주최자)
  ├─ Next.js (Vercel)          공개 페이지는 SSR/SSG, 대시보드는 CSR
  └─ Web Worker                Transformers.js — 감정·독성 태깅
        │
        ▼  결과만 전송
  Spring Boot (Render) ──▶ PostgreSQL (Neon)
        │
        └─ Gemini API          종료 후 리포트 요약 1회
```

- **감정 분석은 서버가 아니라 참가자 기기에서** 돌아갑니다. 서버는 결과만 받아 저장합니다
- 프론트엔드는 Vercel, 백엔드는 Render, DB는 Neon을 씁니다. **비용 0 유지가 원칙**입니다
- 실시간 갱신은 폴링으로 시작해 SSE로 승급했습니다

<br />

## 🧠 Key Design Points

### 🧠 1. 브라우저에서 감정을 분석합니다

소감마다 서버 AI를 부르면 호출 수만큼 비용이 쌓이고, 참가자는 네트워크 왕복까지 기다립니다. Transformers.js를 **참가자 기기에서** 실행해 서버 추론 비용을 0으로 만들었습니다.

추론을 메인 스레드에서 돌리면 계산 중에 화면이 멈추기 때문에 **Web Worker로 분리**했습니다. 모델은 첫 로드 1회만 받고 재사용하며, 화면 진입 시점에 미리 받아 소감을 쓰는 동안 준비를 마칩니다.

측정값 (Chrome · WebGPU · 로컬):

| 항목           | 값                                      |
| -------------- | --------------------------------------- |
| 모델 최초 로드 | 약 1.9초 (13.9MB)                       |
| 태깅 1건       | 약 0.7초                                |
| 25자 → 134자   | 653ms → 756ms (**글자 5배에 15% 증가**) |

태깅이 실패하거나 3초를 넘기면 `UNKNOWN`으로 떨어뜨리고 **제출은 그대로 진행**합니다.

### 📜 2. MSW 목 스키마가 API 계약의 단일 소스입니다

백엔드 담당이 1명이라 API 완성까지 프론트가 멈추는 구조였습니다. **Zod로 계약을 정의하고 같은 스키마로 MSW 목 서버를 구성**해, 백엔드 구현을 기다리지 않고 화면을 완성했습니다.

응답은 Zod로 검증해 계약을 벗어난 데이터가 화면까지 오지 않게 합니다. 실서버 공개 후에는 스키마 차이만 흡수해 연동했습니다.

### 🔄 3. 실시간 갱신을 훅으로 격리했습니다

초기에는 SSE 엔드포인트가 없어 폴링으로 시작했습니다. 갱신 로직을 커스텀 훅 뒤로 숨겨서, 백엔드가 SSE를 제공했을 때 **화면 코드를 안 고치고** 통신 방식만 교체했습니다.

실패 판정도 한곳에 모았습니다. 순간 장애(5xx)와 영구 실패(4xx)를 구분해서, **일시적 오류에는 폴링을 멈추지 않습니다.** 여기서 멈추면 서버가 복구돼도 화면이 영영 굳습니다.

### 🎱 4. 소감 참여를 미니게임으로 끌어냅니다

행사 초반에는 분위기가 굳어 있고, 참가자에게 소감 작성은 「해도 그만인 일」입니다. **프로젝터에 띄우는 핀볼 레이스**를 붙이고 결과 화면을 소감 입력으로 이어지게 했습니다.

물리는 라이브러리 대신 직접 구현했습니다. **시드로 난수를 만들어야 「같은 시드면 같은 결과」를 테스트할 수 있기 때문**입니다. 상수는 눈대중 대신 조합을 훑는 스크립트로 측정해, 10명에서 47명까지 21-30초로 수렴하게 맞췄습니다.

### 📱 5. 참가자와 주최자는 다른 플랫폼입니다

참가자는 QR로 들어와 한 가지 일만 하고 나가는 **모바일 흐름**이고, 주최자는 로그인한 채 여러 화면을 오가는 **데스크톱**입니다.

그래서 헤더의 역할이 다릅니다. 참가자 화면은 상단 바에 뒤로가기와 화면 이름을 두고, 주최자 화면은 로고·계정·로그아웃이 늘 같은 자리에 있는 앱 크롬으로 둡니다. 프로젝터 화면은 **멀리서 읽히는 것**이 기준입니다.

<br />

## 🖥️ Tech Stack

**Frontend**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js%2016-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React%2019-61DAFB?logo=react&logoColor=black)
![TanStack Query](https://img.shields.io/badge/TanStack%20Query-FF4154?logo=reactquery&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS%20v4-06B6D4?logo=tailwindcss&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?logo=zod&logoColor=white)
![React Hook Form](https://img.shields.io/badge/React%20Hook%20Form-EC5990?logo=reacthookform&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-22B5BF?logo=chartdotjs&logoColor=white)

**AI · Test · Mock**

![Transformers.js](https://img.shields.io/badge/Transformers.js-FFD21E?logo=huggingface&logoColor=black)
![ONNX Runtime](https://img.shields.io/badge/ONNX%20Runtime%20Web-005CED?logo=onnx&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)
![MSW](https://img.shields.io/badge/MSW-FF6A33?logo=mockserviceworker&logoColor=white)
![Testing Library](https://img.shields.io/badge/Testing%20Library-E33332?logo=testinglibrary&logoColor=white)

**Backend · Infra**

![Spring Boot](https://img.shields.io/badge/Spring%20Boot-6DB33F?logo=springboot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E599?logo=postgresql&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?logo=render&logoColor=black)
![Gemini](https://img.shields.io/badge/Gemini%20API-8E75B2?logo=googlegemini&logoColor=white)

<br />

## 🗺️ Screens

참가자 화면은 QR로 들어오는 **모바일 전용**, 주최자 화면은 로그인이 필요한 **데스크톱**입니다.

| 경로                       | 대상     | 설명               |
| -------------------------- | -------- | ------------------ |
| `/e/[code]`                | 참가자   | 한줄 소감 입력     |
| `/e/[code]/live`           | 참가자   | 실시간 반응        |
| `/e/[code]/report`         | 참가자   | 종료 후 리포트     |
| `/e/[code]/game`           | 참가자   | 미니게임 참가      |
| `/events`                  | 주최자   | 이벤트 목록        |
| `/events/[code]`           | 주최자   | 이벤트·세션 관리   |
| `/events/[code]/dashboard` | 주최자   | 실시간 대시보드    |
| `/events/[code]/game`      | 프로젝터 | 미니게임 진행·결과 |
| `/speaker/[code]/[id]`     | 발표자   | 세션별 반응        |

<br />

## 📂 Directory Structure

```text
pulse-frontend/
├── app/                라우트 (App Router)
│   ├── (host)/         주최자 — 로그인 필요
│   ├── e/[code]/       참가자 — QR 진입
│   ├── speaker/        발표자
│   └── dev/msw/        목 데이터 확인용
├── components/
│   ├── ui/             공통 컴포넌트 (디자인 시스템)
│   ├── brand/          로고
│   ├── layout/         헤더
│   ├── feedback/       소감 입력·실시간
│   ├── dashboard/      주최자 대시보드
│   ├── game/           미니게임 (참가자 · 프로젝터)
│   └── speaker/        발표자 화면
├── hooks/              서버 상태·브라우저 API 훅
├── lib/
│   ├── api/            엔드포인트 · 재시도 정책
│   ├── schemas/        Zod 스키마 (API 계약)
│   ├── storage/        localStorage 접근
│   └── tagger/         감정·독성 태깅 (Web Worker)
├── mocks/              MSW 핸들러 · 시드 데이터
├── docs/               태거 평가 자료
└── scripts/            태거 평가 하네스
```

폴더별 상세 규칙은 각 `README.md`에 있습니다 — [`ui`](./components/ui/README.md) · [`brand`](./components/brand/README.md) · [`layout`](./components/layout/README.md) · [`feedback`](./components/feedback/README.md) · [`mocks`](./mocks/README.md)

<br />

## 🚀 Getting Started

```bash
npm install
npm run dev
```

`http://localhost:3000`이 뜹니다. **환경 변수 없이 바로 돌아갑니다** — 개발 중에는 MSW 목 서버가 기본으로 켜집니다.

실제 백엔드에 붙이려면 `.env.example`을 `.env.local`로 복사하고 채웁니다.

```bash
BACKEND_API_URL=https://…/api/v1
NEXT_PUBLIC_API_MOCKING=disabled
```

| 명령                  | 설명                          |
| --------------------- | ----------------------------- |
| `npm run dev`         | 개발 서버                     |
| `npm run build`       | 프로덕션 빌드                 |
| `npm run lint`        | ESLint 검사 (자동 수정 안 함) |
| `npm run format`      | Prettier 적용                 |
| `npm run test`        | 테스트 1회 실행               |
| `npm run test:watch`  | 테스트 감시 모드              |
| `npm run tagger:eval` | 감정 태거 평가 하네스         |

목 데이터는 `/dev/msw`에서 확인할 수 있습니다. 시드 이벤트 코드는 [`mocks/README.md`](./mocks/README.md)에 있습니다.

<br />

## 📚 Documents

- [프로젝트 규칙 (CLAUDE.md)](./CLAUDE.md) — 코드·Git·PR·이슈 컨벤션의 원본
- [요구사항 명세서](https://app.notion.com/p/a9a5f62e86848339a96c01c7d055b4f5) — 화면 동작·상태 전이·검증 규칙
- [API 명세서](https://app.notion.com/p/f3f5f62e868482ee9faf816de775057c) — 요청/응답 스키마
- [ERD](https://app.notion.com/p/4f85f62e868483ceac7c81a76f998ef1)
- [용어집](https://app.notion.com/p/3b25f62e8684818ca55dcd2825d5e988)
- [태거 검증 기록](./docs/tagger-validation.md)

### 개발 규칙 요약

전체는 [`CLAUDE.md`](./CLAUDE.md)에 있습니다. 자주 걸리는 것만 옮겨 적습니다.

- `main`·`dev` 직접 커밋 금지. `feature/…`·`fix/…` 브랜치에서 작업하고 PR을 엽니다
- 커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/). `.githooks/commit-msg`가 강제합니다
- 새 작업은 GitHub Issue를 먼저 만듭니다
- import는 절대경로 `@/`를 씁니다
- CSS 길이는 폰트·간격에 `rem`, 비율에 `%`, 풀스크린에 `dvh`. `px`은 1px 고정값만
- `any` 금지. 불가피하면 `unknown` + 좁히기

포맷과 네이밍은 ESLint·Prettier가 강제하므로 따로 신경 쓰지 않아도 됩니다.

`npm install` 시 `prepare` 스크립트가 `core.hooksPath`를 잡습니다. 안 잡혔으면 한 번만 실행하세요.

```bash
git config core.hooksPath .githooks
```

<br />

## 👥 Contributors

<table>
  <tr>
    <th>Profile</th>
    <th width="72">Name</th>
    <th>Role</th>
    <th>Contributions</th>
  </tr>
  <tr>
    <td><img src="https://github.com/ndopy.png" width="56" alt="ndopy profile" /></td>
    <td><a href="https://github.com/ndopy">표후동</a></td>
    <td align="center">FE</td>
    <td>인증 · 이벤트 관리 · 세션 CRUD</td>
  </tr>
  <tr>
    <td><img src="https://github.com/yundlab.png" width="56" alt="yundlab profile" /></td>
    <td><a href="https://github.com/yundlab">한윤지</a></td>
    <td align="center">FE</td>
    <td>디자인 시스템 · 참가자 화면 · 브라우저 감정 태깅 · 미니게임(핀볼 레이스) 제안부터 실서버 연동까지</td>
  </tr>
  <tr>
    <td><img src="https://github.com/Dante0214.png" width="56" alt="Dante0214 profile" /></td>
    <td><a href="https://github.com/Dante0214">안치호</a></td>
    <td align="center">FE</td>
    <td>실시간 대시보드 · 라이브 화면 · 발표자 화면 · SSE 전환</td>
  </tr>
  <tr>
    <td><img src="https://github.com/kimnioyh.png" width="56" alt="kimnioyh profile" /></td>
    <td><a href="https://github.com/kimnioyh">김효인</a></td>
    <td align="center">BE</td>
    <td>백엔드 전담 — API 설계·구현 · DB 스키마 · 리포트 생성 · 배포</td>
  </tr>
</table>
