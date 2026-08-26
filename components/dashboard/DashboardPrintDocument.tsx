'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { KeywordCard } from '@/components/dashboard/KeywordCard';
import { buildPrintPages } from '@/components/dashboard/printPages';
import { SentimentTrendCard } from '@/components/dashboard/SentimentTrendCard';
import { Donut } from '@/components/feedback/Donut';
import { Badge } from '@/components/ui/Badge';
import { Stat } from '@/components/ui/Stat';
import formatEventDate from '@/lib/formatEventDate';
import type { Feedback, PulseEvent, SessionView } from '@/lib/schemas/api';

/**
 * PDF로 나갈 문서입니다(#268). 칩 순서대로 "전체" 한 칸 + 세션마다 한 칸, 마지막이 AI 요약
 * 리포트입니다. 언제 붙었다 사라지는지는 `hooks/useDashboardPrint.ts`가 정합니다.
 *
 * 한 장에 두 칸씩 앉힙니다. 목 데이터(세션 2개)로 치면 [전체 · 오전] [오후 · 요약] 두 장입니다.
 * 그래서 아래 `SECTION_*`은 "장"이 아니라 "칸"입니다 — 종이를 넘기는 건 짝수 번째 칸뿐입니다.
 *
 * 소감 원문 목록(실시간 피드·모더레이션 큐)은 넣지 않습니다. 건수는 스탯 타일에 이미 숫자로
 * 있고, 소감이 많은 이벤트에서는 그 두 카드 때문에 문서가 수십 장이 됩니다. 사후 보고서에
 * 운영용 작업 목록이 들어갈 이유도 없습니다.
 *
 * 화면 밖(`-left-[200vw]`)에 두고 인쇄할 때만 종이 위로 올립니다. `display: none`으로 숨기면
 * 안 됩니다 — 그 이유는 `useDashboardPrint.ts`의 `SETTLE_FRAMES` 주석에 적어뒀습니다.
 *
 * `body` 바로 아래로 보내는 이유는 인쇄할 때 나머지를 걷어내는 규칙(`app/globals.css`)이
 * 이 문서를 `body`의 형제로 보기 때문입니다. 대시보드 안에 두면 이 문서를 살리려다
 * 조상들까지 함께 살려야 합니다.
 */

/* 카드 모양이 대시보드의 다른 섹션과 같습니다. `components/ui/`에 카드 프리미티브가 아직 없습니다. */
const CARD = 'flex flex-col gap-3 rounded-xl border border-border-subtle p-4';
const CARD_TITLE = 'text-xs font-normal leading-4 text-text-tertiary';

/**
 * A4 세로의 내용 폭입니다(210mm - `@page`의 좌우 여백 12mm씩).
 *
 * 길이 단위 규칙(CLAUDE.md)에서 벗어난 자리입니다. 여기서 정하는 건 화면 요소의 크기가 아니라
 * 종이 크기라, 종이를 재는 단위를 그대로 씁니다. 화면 밖에 있는 동안에도 이 폭을 지켜야
 * 인쇄 순간에 폭이 바뀌지 않고, 그래야 추이 차트가 다시 크기를 재려다 빈칸으로 나가지 않습니다.
 */
const PAGE_WIDTH = 'w-[186mm]';

/**
 * 한 장에 앉히는 칸 수입니다. 늘리려면 아래 `SECTION_HEIGHT`를 함께 줄여야 합니다 —
 * A4 한 장의 내용 높이(297mm - 위아래 12mm = 273mm)를 이 수로 나눈 값이어야 합니다.
 */
const SECTIONS_PER_SHEET = 2;

/**
 * 칸 하나의 높이입니다. 273mm를 둘로 나눈 값에서 조금 덜어냈습니다.
 *
 * 딱 절반(136.5mm)으로 잡으면 반올림 한 번에 두 번째 칸이 다음 장으로 밀리고, 그러면 장마다
 * 반쯤 빈 종이가 한 장씩 더 나옵니다. 높이를 고정하는 이유는 두 번째 칸이 늘 같은 자리에서
 * 시작하게 하려는 것입니다 — 키워드가 한 줄 늘었다고 아래 칸이 따라 내려가면 장마다 경계가
 * 달라집니다.
 */
const SECTION_HEIGHT = 'h-[133mm]';

const SECTION = `flex flex-col gap-3 ${SECTION_HEIGHT}`;

interface PrintSection {
  key: string;
  /** 칩 이름이거나 「AI 요약 리포트」입니다. */
  label: string;
  body: ReactNode;
}

interface DashboardPrintDocumentProps {
  event: PulseEvent;
  /** 칩 줄과 같은 순서여야 합니다. 이 순서가 곧 칸 순서입니다. */
  sessions: SessionView[];
  /**
   * 이벤트 전체 소감입니다. 세션별로 거른 목록을 넘기면 그 세션 칸만 채워지고 나머지는
   * 빈 칸이 됩니다(`useDashboardPrint`가 "전체" 한 벌을 받아 넘깁니다).
   */
  feedbacks: Feedback[];
  /** 마지막 칸의 본문입니다. `GENERATED`인데 본문이 비어 오는 응답이 있어 `null`을 받습니다. */
  summaryText: string | null;
}

const DashboardPrintDocument = ({
  event,
  sessions,
  feedbacks,
  summaryText,
}: DashboardPrintDocumentProps) => {
  const sections: PrintSection[] = [
    ...buildPrintPages(feedbacks, sessions).map((page) => ({
      key: String(page.sessionId ?? 'all'),
      label: page.title,
      body: (
        <>
          {/* 대시보드 상단 타일과 같은 값·같은 순서입니다. */}
          <div className="grid shrink-0 grid-cols-4 gap-3">
            <Stat label="총 소감" value={`${page.visibleCount}`} />
            <Stat label="긍정 비율" value={`${page.summary.positiveRate}%`} tone="positive" />
            <Stat label="독성 플래그" value={`${page.toxicCount}`} tone="toxic" />
            <Stat label="미분류" value={`${page.summary.unclassified}`} tone="muted" />
          </div>

          <div className="grid shrink-0 grid-cols-[14rem_1fr] gap-3">
            <section className={CARD}>
              <h2 className={CARD_TITLE}>감정 분포</h2>
              {/* 종이에는 좁은 화면이 없어서 온도계 쪽은 쓰지 않습니다. */}
              <Donut
                positive={page.summary.positive}
                neutral={page.summary.neutral}
                negative={page.summary.negative}
                className="py-1"
              />
            </section>

            {/*
             * 「실시간 갱신 중」도 선이 그려지는 애니메이션도 종이에서는 뜻이 없습니다.
             * 애니메이션은 켜두면 선이 통째로 빠진 채 인쇄됩니다(`SentimentTrendChart`).
             */}
            <SentimentTrendCard
              trend={page.trend}
              positive={page.summary.positive}
              neutral={page.summary.neutral}
              negative={page.summary.negative}
              isLive={false}
              isAnimated={false}
            />
          </div>

          {/*
           * 칸 안에서 유일하게 높이가 변하는 자리입니다(배지가 늘면 줄이 늘어납니다). 남는
           * 높이를 이 카드가 받게 두고, 모자라면 여기만 줄어들어 잘립니다 — 위 세 덩어리에
           * `shrink-0`을 건 이유입니다. 칸 높이가 고정이라 이 안전장치가 없으면 키워드가
           * 두세 줄로 늘어난 칸이 아래 칸 위로 넘쳐 글자가 겹칩니다.
           */}
          <div className="min-h-0 overflow-hidden">
            <KeywordCard keywords={page.keywords} />
          </div>
        </>
      ),
    })),
    {
      key: 'report',
      label: 'AI 요약 리포트',
      body:
        (
          /*
           * 줄바꿈을 살립니다. 요약은 서버가 만든 문단이라 여러 줄로 옵니다.
           * 본문이 비어 오는 경우의 문구는 리포트 카드(`ReportSection`)와 같이 갑니다.
           */
          <p className="text-sm leading-6 font-normal whitespace-pre-line text-text-secondary">
            {summaryText ?? '요약 본문을 받지 못했어요'}
          </p>
        ),
    },
  ];

  /**
   * 종이를 넘길 자리입니다. 장의 마지막 칸마다 넘기되 문서의 마지막 칸에서는 넘기지 않습니다 —
   * 거기서 넘기면 빈 종이가 한 장 더 딸려 나옵니다.
   *
   * `even:`·`last:` 변형을 겹쳐 쓰지 않고 여기서 셉니다. 그 둘은 같은 명시도라 어느 쪽이
   * 이기는지가 Tailwind가 뽑아내는 순서에 달리는데, 그건 여기서 읽히지 않습니다.
   */
  const isSheetEnd = (index: number) =>
    index % SECTIONS_PER_SHEET === SECTIONS_PER_SHEET - 1 && index !== sections.length - 1;

  /*
   * `document`를 바로 읽습니다. 이 컴포넌트는 주최자가 버튼을 누른 뒤에만 트리에 들어오므로
   * 서버 렌더에서는 여기까지 오지 않습니다(대시보드 자체가 CSR입니다).
   */
  return createPortal(
    <div
      data-print-document
      /* 화면에 보이지 않는 사본입니다. 스크린리더가 대시보드를 두 번 읽지 않게 합니다. */
      aria-hidden
      className={`absolute top-0 -left-[200vw] flex flex-col bg-background-default print:static ${PAGE_WIDTH}`}
    >
      {sections.map((section, index) => (
        <article
          key={section.key}
          className={`${SECTION} ${isSheetEnd(index) ? 'break-after-page' : ''}`}
        >
          {/*
           * 칸마다 이벤트 제목을 답니다. 낱장으로 흩어지거나 다른 보고서에 섞여도 어느 행사
           * 것인지 남아야 합니다. 바로 옆 배지가 이 칸의 범위(칩 이름)입니다.
           *
           * 제목과 배지를 한 줄에 세우는 건 높이 때문이기도 합니다. 두 줄로 쌓으면 30px쯤
           * 더 먹는데, 칸 높이가 고정이라 그만큼이 아래 키워드 카드에서 빠집니다.
           */}
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-default pb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xl leading-7 font-semibold text-text-primary">{event.title}</h1>
              <Badge tone="info">{section.label}</Badge>
            </div>
            <span className="shrink-0 text-xs leading-4 font-normal text-text-tertiary">
              {formatEventDate(event.eventDate)}
            </span>
          </header>

          {section.body}
        </article>
      ))}
    </div>,
    document.body,
  );
};

export { DashboardPrintDocument };
