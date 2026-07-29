# 프로젝트 규칙 (CLAUDE.md) — 프론트엔드 레포

> 이 파일은 매 세션 자동 로드되는 AI 가이드입니다.
> **강제되는 규칙(lint/hook)은 여기 중복 기재하지 않습니다.** 아래는 툴로 못 잡는 규칙 + 문서 링크만 다룹니다.
> 진실의 원천: ESLint / Prettier / commitlint입니다. 상세 컨벤션은 링크 문서를 참고해야 합니다.
> 백엔드는 별도 레포(`CLAUDE.backend.md` 참고)에서 관리합니다. 이 문서는 프론트엔드 레포에만 적용됩니다.
> `create-next-app`이 자동 생성한 `AGENTS.md`에 이 Next.js 버전(16.2.12)이 학습 데이터와 다를 수 있다는 경고가 있습니다. Next.js API 관련 작업 전 반드시 `AGENTS.md`와 `node_modules/next/dist/docs/`를 확인해야 합니다.

## 프로젝트 개요

**Pulse** — 실시간 이벤트 피드백 모니터링 서비스입니다. 참가자 피드백을 실시간 대시보드·백오피스·SSR 공개 페이지로 보여줍니다.

## 확정된 기술 스택 (프론트엔드)

| 레이어 | 선택 | 비고 |
|---|---|---|
| 프론트 | Next.js (React + TypeScript) | 공개 페이지는 SSR/SSG, 대시보드는 CSR |
| 클라 AI | Transformers.js (Web Worker) | 감정/독성 분석, 비용 0 |
| 실시간 (클라이언트) | 폴링 → SSE 승급 | 훅으로 격리해서 나중에 전환합니다. 백엔드가 SSE 엔드포인트를 제공하는 시점에 맞춰 전환해야 합니다. |
| 서버 상태 관리 | TanStack Query | 캐시 무효화·폴링 간격 관리 |
| API 목킹 | MSW | 계약 우선 개발, 프론트/백 독립 진행. 이 목 스키마가 백엔드 연동의 단일 소스입니다. |
| 배포 | Vercel | 비용 0 유지가 원칙 |

## 개발 환경 설정 (두 팀원 초안 기준 제안값)

`docs/environment-setup.md` 회의를 맨땅에서 시작하지 않도록, 김효인·안치호 두 팀원의 CLAUDE.md 초안에 이미 나온 값을 근거로 제안값을 채웠습니다. 두 초안 모두 언급이 없는 항목은 별도 표로 분리했습니다.

### 초안에 근거가 있는 항목 — 회의에서는 확인만 하면 됩니다

| 항목 | 제안값 | 근거 |
|---|---|---|
| 패키지 매니저 | npm | 김효인 초안의 `명령어` 섹션이 `npm run test`/`npm run lint`/`npm run build`로 명시돼 있습니다. 안치호 초안은 패키지 매니저를 언급하지 않아 상충하지 않습니다. |
| ESLint 설정 | `next/core-web-vitals` + `@typescript-eslint` | 안치호 초안의 "린트 & 포맷" 절에 명시돼 있습니다. |
| import 정렬 도구 ✅ 확정 (2026-07-29) | `eslint-plugin-import` | 안치호 초안이 제시한 두 옵션(`eslint-plugin-import`/`@trivago/prettier-plugin-sort-imports`) 중 팀 회의에서 `eslint-plugin-import`로 확정했습니다. |
| Prettier 설정 | 아래 `.prettierrc` 값 | 안치호 초안에 그대로 명시돼 있습니다. |
| Husky + lint-staged | 도입 | 안치호 초안의 "커밋훅" 항목이 staged 파일만 검사하는 방식을 전제로 설명하고 있습니다. |
| `.editorconfig`의 들여쓰기 | `indent_size = 2` | 안치호 초안 `.prettierrc`의 `tabWidth: 2`에서 간접적으로 도출한 값입니다. `.editorconfig` 파일 자체를 직접 언급한 초안은 없습니다. |

```json
// .prettierrc (안치호 초안 원본)
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "all",
  "arrowParens": "always"
}
```

### Claude 제안 항목 — 두 초안 모두 근거 없음, 웹 검색 기반으로 Claude가 채움

> **주의:** 아래 항목은 김효인·안치호 두 팀원의 CLAUDE.md 초안 어디에도 없던 내용입니다. 팀원 의견이 아니라 Claude가 웹 검색으로 확인한 일반적인 관례를 근거로 제안한 값이므로, 팀 초안과 동일한 무게로 받아들이면 안 됩니다.
>
> 팀 구성(Windows/macOS 혼용, VS Code/IntelliJ IDEA/WebStorm 혼용)을 고려해서 특정 OS·에디터에서만 동작하는 선택은 배제했습니다.

| 항목 | Claude 제안값 | 웹 검색 근거 |
|---|---|---|
| Node 버전 고정 방식 | **Volta로 Node 24(LTS) 고정** | nvm은 Windows를 네이티브 지원하지 않아 WSL이 필요하지만, Volta는 Rust로 작성되어 Windows/macOS/Linux를 모두 네이티브로 지원하고 `package.json`에 버전을 고정합니다. Node 24는 2026년 7월 기준 Active LTS이며, Next.js 최소 요구 버전(20.9)을 여유 있게 충족합니다. ([techearl.com](https://techearl.com/nvm-vs-fnm-vs-volta), [leapcell.io](https://leapcell.io/blog/navigating-node-js-versions-a-deep-dive-into-nvm-volta-and-fnm), [endoflife.date/nodejs](https://endoflife.date/nodejs), [nextjs.org 설치 가이드](https://nextjs.org/docs/app/getting-started/installation)) |
| `.editorconfig` (에디터 호환) | 도입 + 아래 내용 | WebStorm은 EditorConfig 지원이 기본 활성화, IntelliJ IDEA도 내장 지원됩니다. VS Code만 "EditorConfig for VS Code" 확장 프로그램을 팀원이 직접 설치해야 합니다. ([JetBrains WebStorm 문서](https://www.jetbrains.com/help/webstorm/editorconfig.html), [JetBrains IntelliJ 문서](https://www.jetbrains.com/help/idea/editorconfig.html), [VS Code 확장](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)) |
| `.gitattributes` | 도입 + 아래 내용 | `* text=auto`로 개행을 자동 정규화하고, 소스 코드는 `eol=lf`로 통일하며 Windows 전용 스크립트만 `eol=crlf`로 강제하는 방식이 Node.js 프로젝트의 일반적 관례입니다. ([rehansaeed.com](https://rehansaeed.com/gitattributes-best-practices/), [dev.to](https://dev.to/ramunarasinga-11/-textauto-in-gitattributes-file-4ba5)) |
| `.gitignore` 세부 항목 ✅ 적용됨 (2026-07-29) | `create-next-app`이 자동 생성한 기본값 사용 | 스캐폴딩 시 GitHub 공식 Node 템플릿 대신 `create-next-app`이 생성한 `.gitignore`를 그대로 채택했습니다. `node_modules`, `.next/`, `build`, `.env*`, `.vercel` 등을 포함합니다. |
| 환경 변수 관리 방식 | `.env.example`은 커밋, `.env`/`.env.local`은 금지 | 위 GitHub 공식 템플릿과 동일한 근거입니다. |
| CSS 방법론 ✅ 확정 (2026-07-29) | **Tailwind CSS** (shadcn/ui 등 외부 컴포넌트 라이브러리는 당장 사용하지 않습니다) | 한 정리 글 기준 2025년 신규 프로젝트의 68%가 Tailwind CSS를 채택했다고 보고합니다. 다만 이 수치는 State of CSS 공식 설문 원본이 아니라 이를 인용한 2차 블로그 글에서 확인한 것이라 신뢰도가 원 설문보다 낮습니다. Next.js 공식 SSR/SSG 페이지와도 궁합이 좋다는 점(런타임 CSS-in-JS 대비 서버 컴포넌트 호환)도 근거로 참고했습니다. ([jeffbruchado.com.br](https://jeffbruchado.com.br/en/blog/css-in-js-2025-tailwind-styled-components-trends)) 팀 회의에서 Tailwind CSS 도입은 확정했고, shadcn/ui 같은 외부 컴포넌트 라이브러리 도입은 일단 보류했습니다. |
| 폴더 구조 | `app/`, `components/`, `lib/`, `hooks/` | Next.js 공식 문서가 제시하는 App Router 프로젝트 구조 컨벤션입니다. ([nextjs.org 공식 문서](https://nextjs.org/docs/app/getting-started/project-structure)) |

```gitattributes
# .gitattributes (Claude 제안)
* text=auto
*.js text eol=lf
*.jsx text eol=lf
*.ts text eol=lf
*.tsx text eol=lf
*.json text eol=lf
*.md text eol=lf
*.sh text eol=lf
*.cmd text eol=crlf
*.bat text eol=crlf
```

```ini
# .editorconfig (Claude 제안, VS Code는 "EditorConfig for VS Code" 확장 설치 필요)
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

## 명령어

- 테스트: `npm run test`
- 린트: `npm run lint`
- 빌드: `npm run build`

---

## 코드 규칙 (린트로 못 잡는 것만 — 반드시 준수)

- 컴포넌트는 **화살표 함수형**으로 선언하고, 파일명은 컴포넌트명(PascalCase)과 일치시켜야 합니다.
- 핸들러 함수는 `handle*`, 컴포넌트 prop 콜백은 `on*`으로 명명해야 합니다 (예: `<Btn onClick={handleClick} />`).
- import는 **절대경로 `@/`**를 사용해야 합니다. 2단계 이상 상대경로(`../../`)는 금지합니다.
- CSS 길이 단위: 폰트·간격은 `rem`, 비율은 `%`, 풀스크린 섹션만 `dvh`를 사용해야 합니다. `px`은 1px 고정값(border 등)에만 사용합니다.
- 타입은 `interface`(props)/`type`(유니온·유틸)로 구분해야 합니다. `any`는 금지하며, 불가피하면 `unknown` + 좁히기를 사용해야 합니다.
- **SSR/CSR 경계**: Transformers.js는 SSR과 상극이므로 반드시 `'use client'` + 동적 import로 클라이언트 경계를 분리해야 합니다. 공개 페이지는 SSR/SSG, 대시보드는 CSR로 구성합니다.

> 네이밍(camel/Pascal/UPPER)·포맷·세미콜론은 ESLint/Prettier가 강제하므로 여기 나열하지 않습니다.

## 백엔드 연동 원칙

- 계약 우선 개발이 원칙입니다. MSW 목 스키마가 단일 소스이며, 실제 Spring 응답은 이 스키마를 따라야 합니다.
- 백엔드 담당이 1명뿐이라 크리티컬 패스가 좁습니다. 백엔드 API 스펙 변경을 제안할 때는 반드시 담당자 확인을 먼저 거쳐야 합니다.
- 백엔드는 별도 레포에서 관리되므로, API 계약 변경은 두 레포 모두에 반영돼야 합니다.

---

## Git 규칙

- **main/dev 직접 커밋·push는 금지합니다.** 항상 `feature/…`·`fix/…` 브랜치에서 작업 후 PR을 올려야 합니다.
- 커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/) 형식을 따라야 합니다.

  ```
  <type>(<scope>): <subject>

  <body>

  <footer>
  ```

  - **type**: 아래 표를 따르며 소문자로 작성해야 합니다.
  - **scope**: 변경 범위(예: `auth`, `dashboard`, `feedback`)이며 선택 사항입니다.
  - **subject**: 50자 이내, 명령문(imperative mood)으로 작성하고 마침표는 붙이지 않습니다.
  - **body**: 무엇을 왜 바꿨는지, 그리고 세션 중 겪은 애로사항·트러블슈팅을 기재해야 합니다.
  - **footer**: `BREAKING CHANGE:` 또는 이슈 참조(`Refs #123`)를 기재합니다.

  | type | 의미 |
  |---|---|
  | `feat` | 새로운 기능 추가 |
  | `fix` | 버그 수정 |
  | `docs` | 문서 변경 (코드 변경 없음) |
  | `style` | 포맷팅 등 코드 동작에 영향 없는 변경 |
  | `refactor` | 기능 변경 없는 코드 구조 개선 |
  | `perf` | 성능 개선 |
  | `test` | 테스트 추가/수정 |
  | `build` | 빌드 시스템, 의존성 변경 |
  | `ci` | CI 설정 변경 |
  | `chore` | 그 외 잡다한 변경 |
  | `revert` | 이전 커밋 되돌리기 |

  예시:
  ```
  feat(dashboard): 실시간 감정 온도계 컴포넌트 추가

  SSE 연결 전 폴링 기반으로 우선 구현. 5초 간격으로 집계 API 호출.

  Refs #12
  ```

- 하나의 커밋은 하나의 논리적 변경만 포함해야 합니다(기능 추가와 리팩토링을 한 커밋에 섞지 않습니다).
- 커밋 전 diff를 확인하고, 의도하지 않은 파일(로그, 임시파일, `.env` 등)이 포함되지 않았는지 점검해야 합니다.
- 작업 전 `git pull --rebase origin dev`로 최신화해야 합니다.

## PR 규칙

- PR을 열기 전 브랜치가 최신 base 브랜치를 기준으로 하는지 확인해야 합니다.
- `.github/PULL_REQUEST_TEMPLATE.md`가 존재하면 반드시 해당 양식을 채워서 사용해야 합니다.
- PR 제목도 커밋 컨벤션과 동일한 `type: subject` 형식을 따라야 합니다.
- 관련 이슈가 있으면 본문에 `Closes #번호`/`Fixes #번호`/`Refs #번호`로 명시해야 합니다.
- 하나의 PR은 하나의 목적만 다뤄야 합니다. 여러 기능/수정이 섞여 있으면 분리를 제안해야 합니다.
- PR 생성은 `gh pr create`를 사용해야 합니다(웹 UI로 유도하지 않습니다).
- 아래의 경우 PR을 열기 전 사용자에게 먼저 확인해야 합니다.
  - draft로 열지 여부
  - base 브랜치가 `main`/`dev`가 아닌 경우
  - 리뷰어/라벨 지정 여부

## 브랜치 네이밍

```
feature/<설명>
fix/<설명>
hotfix/<설명>
chore/<설명>
```

kebab-case를 사용하며, 이슈 번호가 있으면 `fix/12-sse-connection-leak`처럼 포함해야 합니다.

---

## AI 작업 시 주의

- 커밋·push·PR 생성은 **사용자 승인 후** 진행해야 합니다.
- `.env` 등 시크릿 파일 접근은 금지합니다.
- 요청 범위 밖 코드는 건드리지 않아야 합니다(surgical change).
