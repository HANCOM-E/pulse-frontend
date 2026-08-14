import { HostHeader } from '@/components/layout/HostHeader';

interface HostLayoutProps {
  children: React.ReactNode;
}

const HostLayout = ({ children }: HostLayoutProps) => {
  return (
    <>
      <HostHeader />
      {children}
    </>
  );
};

export default HostLayout;
