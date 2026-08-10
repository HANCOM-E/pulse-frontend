import { Chip } from '@/components/ui/Chip';
import { Textarea } from '@/components/ui/Textarea';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';

const EventEntryPage = () => {
  // API(openapi v0.3): GET /events/{eventCode}(이벤트 상세), GET /events/{eventCode}/sessions(세션 목록),
  // POST /events/{eventCode}/feedbacks(소감 제출, X-Client-Id 헤더 포함).
  // lib/api/endpoints.ts의 fetchSessionsByEventCode·submitFeedback이 이미 구현·테스트돼 있습니다(PR #12).
  // submitFeedback은 getClientId()로 X-Client-Id 헤더를 이미 붙여서 보냅니다.
  // 소감 제출에 성공하면 pulse_submitted_{sessionId}(제안값, 팀 확인 필요)를 저장해 /live 접근 제어에 씁니다.
  return (
    <main className="flex flex-col gap-6 p-5">
      <section className="flex flex-col gap-1">
        <p className="text-ts font-normal leading-4 text-text-tertiary">이벤트</p>
        <h1 className="text-xl font-semibold leading-7 text-text-primary">
          2026 프론트엔드 컨퍼런스
        </h1>
        <p className="text-sm font-normal leading-5 text-text-secondary">
          오늘 들은 세션에 한줄 소감을 남겨주세요
        </p>
      </section>
      <section className="flex flex-col gap-1">
        <p className="text-xs font-normal leading-4 text-text-tertiary">세션 선택</p>
        <div className="flex flex-wrap gap-2">
          <Chip selected>세션 A</Chip>
          <Chip>세션 B</Chip>
          <Chip>세션 C</Chip>
        </div>
      </section>
      <section className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-normal leading-4 text-text-tertiary">한줄 소감</p>
          <p className="text-xs font-normal leading-4 text-text-tertiary">0/200</p>
        </div>
        <Textarea placeholder="이번 세션은 어떠셨나요?" maxLength={200} />
      </section>
      <Banner type="info" className="w-full">
        제출하면 브라우저에서 감정을 자동 분석해요
      </Banner>
      <Button size="lg" className="w-full">
        소감 남기기
      </Button>
    </main>
  );
};

export default EventEntryPage;
