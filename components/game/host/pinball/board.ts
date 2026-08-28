/**
 * 핀볼 보드의 모양입니다. 시뮬레이션과 렌더링이 같은 좌표계를 봐야 해서 상수를 한곳에 둡니다.
 *
 * 좌표는 보드 안쪽 기준이고 단위는 없습니다. 캔버스가 그릴 때 실제 픽셀로 늘립니다 —
 * 프로젝터 해상도가 제각각이라 보드를 픽셀로 정하면 화면마다 물리가 달라집니다.
 */

/** 보드 안쪽 크기입니다. 프로젝터가 16:9라 가로를 넓게 씁니다. */
const BOARD = { width: 1400, height: 1000 } as const;

/** 결승선입니다. 구슬 중심이 이 값을 넘으면 완주로 봅니다. */
const FINISH_Y = 920;

/** 구슬이 출발하는 높이입니다. 보드 위쪽에 흩뿌립니다. */
const START_Y = 50;

/**
 * 구슬이 출발하는 가로 폭입니다. 보드 전체가 아니라 가운데 60%만 씁니다.
 *
 * 전체 폭에 흩뿌리면 벽 근처 구슬이 못을 한 번도 안 만나고 흘러내립니다(측정값: 최소
 * 충돌 0회). 그 구슬은 레이스에 참여하지 않고 순위만 차지해서 긴장감을 깎습니다.
 *
 * 60%면 최소 충돌이 14회 이상입니다. 실제 핀볼도 위쪽 한 지점에서 떨어뜨립니다.
 */
const START_SPREAD = 0.6;

const PEG_RADIUS = 9;

/**
 * 못을 지그재그로 놓습니다. 줄마다 반 칸씩 어긋나야 구슬이 좌우로 갈립니다.
 *
 * 줄 수가 레이스 길이를 정합니다. 지금 값으로 30초~1분을 노렸고, 실제로 띄워보고
 * `GRAVITY`와 같이 조정합니다.
 */
const PEG_ROWS = 20;
const PEG_COLUMNS = 15;
const PEG_TOP = 140;
const PEG_BOTTOM = 840;
const PEG_MARGIN = 90;

/**
 * 못 좌표를 미리 계산해 둡니다. 매 프레임 다시 만들면 47개 구슬 × 108개 못을 곱한 만큼
 * 객체가 새로 생깁니다.
 */
const PEGS: readonly { x: number; y: number }[] = Array.from({ length: PEG_ROWS }, (_, row) => {
  const y = PEG_TOP + ((PEG_BOTTOM - PEG_TOP) / (PEG_ROWS - 1)) * row;
  // 홀수 줄을 반 칸 밀어 지그재그를 만듭니다. 밀린 줄은 못이 하나 적습니다.
  const isOffset = row % 2 === 1;
  const count = isOffset ? PEG_COLUMNS - 1 : PEG_COLUMNS;
  const gap = (BOARD.width - PEG_MARGIN * 2) / (PEG_COLUMNS - 1);
  const left = isOffset ? PEG_MARGIN + gap / 2 : PEG_MARGIN;

  return Array.from({ length: count }, (_, column) => ({
    x: left + gap * column,
    y,
  }));
}).flat();

/**
 * 구슬 반지름입니다. 인원과 무관하게 고정입니다.
 *
 * 처음엔 인원이 적을 때 크게 그리려 했는데, 큰 구슬은 못 사이를 잘 못 빠져나가서
 * 12명 레이스가 47명보다 5배 오래 걸렸습니다(측정값). 물리가 인원에 따라 달라지면
 * 레이스 길이를 예측할 수 없습니다.
 *
 * 47개가 폭 1000에 나란히 서려면 하나가 10 이하여야 하지만, 출발 위치를 흩뿌리므로
 * 겹쳐도 됩니다.
 */
const BALL_RADIUS = 16;

/** 이름표를 다는 최대 인원입니다. `GameRecruiting`과 같은 기준입니다(#243·#288). */
const NAME_TAG_LIMIT = 30;

export { BOARD, FINISH_Y, START_Y, START_SPREAD, PEGS, PEG_RADIUS, NAME_TAG_LIMIT, BALL_RADIUS };
