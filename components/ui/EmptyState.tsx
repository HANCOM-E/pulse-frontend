import type { ComponentProps } from 'react';

interface EmptyStateProps extends ComponentProps<'div'> {
  title: string;
  description?: string;
}

/**
 * 본문 대신 상황을 알리는 카드입니다.
 *
 * 없는 이벤트·시작 전·종료 후처럼 보여줄 내용이 없을 때 씁니다.
 * `children`은 카드 안 버튼 자리이고, 다음 행동이 있을 때만 넘깁니다.
 */
const EmptyState = ({
  title,
  description,
  className = '',
  children,
  ...props
}: EmptyStateProps) => {
  return (
    <div
      className={`flex flex-col items-center gap-4 rounded-xl border border-border-subtle px-5 py-10 ${className}`}
      {...props}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-base font-medium leading-6 text-text-primary">{title}</p>
        {description ? (
          <p className="whitespace-pre-line text-sm font-normal leading-5 text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
};

export { EmptyState };
