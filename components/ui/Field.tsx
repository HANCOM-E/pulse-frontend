'use client';

import { useId } from 'react';

import { Input, type InputProps } from '@/components/ui/Input';

interface FieldProps extends Omit<InputProps, 'id' | 'aria-describedby'> {
  label: string;
  error?: string;
}

const Field = ({ label, error, invalid = false, className = '', ...props }: FieldProps) => {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-normal leading-4 text-text-secondary">
        {label}
      </label>
      <Input
        {...props}
        id={id}
        invalid={invalid || Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="text-xs font-normal leading-4 text-negative-darker">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export { Field };
