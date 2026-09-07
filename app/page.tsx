import { redirect } from 'next/navigation';

/**
 * 루트로 오는 건 주최자뿐입니다. 참가자는 QR로 `/e/[code]`에 바로 들어오고,
 * 발표자는 세션 링크를 따로 받습니다.
 *
 * 로그인 여부는 안 봅니다. 이미 로그인했으면 `proxy.ts`가 `/login`에서 `/events`로
 * 다시 보냅니다.
 */
const Home = () => redirect('/login');

export default Home;
