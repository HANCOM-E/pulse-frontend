/**
 * 참가자 공개 화면(`/e/[code]`, `/live`, `/report`, `/game`)의 공통 레이아웃입니다.
 *
 * 헤더는 여기 없습니다. 화면마다 모양이 달라야 해서 각 페이지가 `EventHeader`를
 * 직접 부릅니다(#308). 남은 건 바깥 틀뿐입니다.
 */
const EventLayout = ({ children }: LayoutProps<'/e/[code]'>) => {
  return <div className="flex flex-1 flex-col">{children}</div>;
};

export default EventLayout;
