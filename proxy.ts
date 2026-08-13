import { NextRequest, NextResponse } from 'next/server';

/**
 * HttpOnly 쿠키라 값을 읽고 검증할 수 없습니다(2026-08-07 명세). 존재 여부만 보는
 * 낙관적 체크입니다. 실제 유효성(위조·만료 여부)은 각 요청에서 서버가 검증합니다 —
 * 이 Proxy는 비로그인 사용자를 화면 진입 전에 걸러내는 1차 방어선일 뿐입니다.
 */
const ACCESS_TOKEN_COOKIE = 'accessToken';

export default function proxy(request: NextRequest) {
  const hasAccessToken = request.cookies.has(ACCESS_TOKEN_COOKIE);

  if (!hasAccessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/events/:path*'],
};
