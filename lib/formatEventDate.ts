/**
 * 이벤트 카드의 행사 날짜입니다. 입력은 시각이 없는 `YYYY-MM-DD`(API 명세의 `eventDate`)입니다.
 *
 * `Date`로 파싱하지 않습니다. 날짜만 있는 문자열은 UTC 자정으로 읽히는데, 그걸 다시 지역
 * 시간으로 그리면 UTC보다 서쪽인 타임존에서 하루가 밀립니다. 브라우저 타임존은 사용자 것이라
 * 서버를 한국으로 맞춰도 막을 수 없습니다.
 */
const formatEventDate = (eventDate: string) => eventDate.replaceAll('-', '. ');

export default formatEventDate;
