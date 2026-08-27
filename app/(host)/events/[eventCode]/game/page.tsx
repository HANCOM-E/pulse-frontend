import { GameHostView } from '@/components/game/host/GameHostView';

/**
 * 행사장 프로젝터에 띄우는 화면입니다. 주최자 노트북에서 엽니다.
 *
 * 화면 전체가 클라이언트 아일랜드라 서버가 미리 받을 게 없습니다. `(host)` 그룹에 있어서
 * 주최자 헤더가 붙고, 결과 확정 API가 요구하는 인증도 같은 경계에서 해결됩니다.
 *
 * 대시보드와 달리 `md:px-20`을 쓰지 않습니다. 멀리서 보는 화면이라 여백보다 글자 크기가
 * 중요하고, 안쪽 컴포넌트가 각자 폭을 정합니다.
 */
const GameHostPage = () => {
  return (
    <main className="flex flex-col gap-6 p-5 py-10">
      <GameHostView />
    </main>
  );
};

export default GameHostPage;
