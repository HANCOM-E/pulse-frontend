const EventLayout = ({ children }: { children: React.ReactNode }) => {
  // 참가자 공개 화면 공통 레이아웃(Header 등). live/report가 이 레이아웃을 공유합니다.
  return <div>{children}</div>;
};

export default EventLayout;
