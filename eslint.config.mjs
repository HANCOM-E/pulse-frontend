import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Prettier와 충돌하는 ESLint 스타일 규칙을 꺼줍니다. 배열 마지막에 와야 합니다.
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // `npx msw init public/`이 생성하는 서비스 워커. 우리가 고치는 파일이 아닙니다.
    'public/mockServiceWorker.js',
  ]),
]);

export default eslintConfig;
