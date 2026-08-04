import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/v1/auth/login', () => {
    return HttpResponse.json({ accessToken: 'mock-token', expiresIn: 3600 });
  }),

  // 각 축이 자기 화면에 필요한 엔드포인트를 여기에 추가합니다.
];
