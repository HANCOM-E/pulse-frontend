import type { ComponentProps } from 'react';

interface ChipProps extends Omit<ComponentProps<'button'>, 'aria-pressed'> {
  selected?: boolean;
}

const BASE = [
  'inline-flex h-8 items-center justify-center gap-2.5',
  'rounded-full border px-3.5',
  'text-sm leading-5',
  'transition-colors',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-default',
  'disabled:cursor-not-allowed disabled:border-border-subtle',
  'disabled:bg-background-muted disabled:font-normal disabled:text-text-disabled',
].join(' ');

const SELECTED =
  'border-primary-default bg-primary-subtle font-medium text-primary-darker hover:border-primary-darker';

const UNSELECTED =
  'border-border-default bg-background-default font-normal text-text-secondary hover:bg-background-muted';

const Chip = ({ selected = false, type = 'button', className = '', ...props }: ChipProps) => {
  return (
    <button
      type={type}
      className={`${BASE} ${selected ? SELECTED : UNSELECTED} ${className}`}
      {...props}
      aria-pressed={selected}
    />
  );
};

export { Chip };
