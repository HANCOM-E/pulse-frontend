import { EventStatus } from '@/lib/schemas/api';
import { Chip } from '@/components/ui/Chip';

export type EventStatusFilter = EventStatus | 'ALL';

export type EventStatusFilterTabsProps = {
  selectedStatus: EventStatusFilter;
  onChange: (status: EventStatusFilter) => void;
};

const TABS: { label: string; value: EventStatusFilter }[] = [
  { label: '전체', value: 'ALL' },
  { label: 'DRAFT', value: 'DRAFT' },
  { label: 'LIVE', value: 'LIVE' },
  { label: 'ENDED', value: 'ENDED' },
];

const EventStatusFilterTabs = ({ selectedStatus, onChange }: EventStatusFilterTabsProps) => {
  // 지금 선택된 탭이 뭔지(selectedStatus)와
  // 사용자가 다른 탭을 눌렀을 때 부모에게 알리는 콜백(onChange)만 props로 받는
  // 순수 표시용 컴포넌트이다.
  // 상태를 직접 들고 있지 않고, 부모(page.tsx)가 상태를 관리하며, 이 컴포넌트는 보여주기만 한다.

  return (
    <>
      {TABS.map((tab) => (
        <Chip
          key={tab.label}
          selected={tab.value === selectedStatus}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </Chip>
      ))}
    </>
  );
};

export default EventStatusFilterTabs;
