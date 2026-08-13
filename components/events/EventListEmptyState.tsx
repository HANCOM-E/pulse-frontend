import { InfoIcon } from '@/components/ui/icons';

export interface EventListEmptyStateProps {
  title: string;
  description: string;
}

const EventListEmptyState = ({ title, description }: EventListEmptyStateProps) => {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border-strong px-10 py-5 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-background-muted">
        <InfoIcon className="h-6 w-6 text-text-tertiary" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-base font-medium leading-6 text-text-primary">{title}</p>
        <p className="text-sm font-normal leading-5 text-text-secondary">{description}</p>
      </div>
    </div>
  );
};

export default EventListEmptyState;
