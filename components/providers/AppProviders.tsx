import type { ReactNode } from 'react';
import MswProvider from '@/components/providers/MswProvider';
import QueryProvider from '@/components/providers/QueryProvider';
import ToastViewport from '@/components/ui/ToastViewport';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * 앱 전역 프로바이더 묶음입니다. 루트 레이아웃에서 한 번만 씁니다.
 *
 * 순서가 중요합니다. 목 워커가 준비된 뒤에 쿼리가 나가야 첫 요청이 목을 통과하지 않습니다.
 */
const AppProviders = ({ children }: AppProvidersProps) => (
  <MswProvider>
    <QueryProvider>
      {children}
      <ToastViewport />
    </QueryProvider>
  </MswProvider>
);

export default AppProviders;
