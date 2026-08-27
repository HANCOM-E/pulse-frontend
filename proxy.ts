import { NextRequest, NextResponse } from 'next/server';

/**
 * HttpOnly는 브라우저 JS(`document.cookie`)의 접근만 막습니다(2026-08-07 명세). Proxy는
 * 서버에서 도는 코드라 `request.cookies.get()`/`has()`로 값 자체는 읽을 수 있습니다.
 *
 * 다만 이 토큰이 진짜 유효한지(위조·만료 여부)는 여기서 검증할 수단이 없어서, 존재
 * 여부만 보는 낙관적 체크로 그칩니다. 실제 유효성 검증은 데이터에 가까운 서버 로직
 * (각 API 요청)이 맡습니다 — 이 Proxy는 비로그인 사용자를 화면 진입 전에 걸러내는
 * 1차 방어선일 뿐입니다.
 */
const ACCESS_TOKEN_COOKIE = 'accessToken';

export default function proxy(request: NextRequest) {
  const hasAccessToken = request.cookies.has(ACCESS_TOKEN_COOKIE);

  const isAuthPage =
    request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup';

  if (isAuthPage) {
    if (hasAccessToken) {
      return NextResponse.redirect(new URL('/events', request.url));
    }
    return NextResponse.next();
  }

  if (!hasAccessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/events/:path*', '/signup', '/login'],
};
