import { formatNumber } from './number.ts';

type StepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Read by screen readers: what the number is. */
  label: string;
};

/** A number with − and + on either side. */
export function Stepper({ value, min, max, onChange, label }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="ناقص" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <output aria-live="polite">{formatNumber(value)}</output>
      <button type="button" aria-label="زائد" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

type SegmentedProps<T extends string | number> = {
  options: { value: T; label: string }[];
  /** Null while nothing is chosen yet. */
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
};

/** A choice between a few options. Choosing the one already chosen does nothing. */
export function Segmented<T extends string | number>({ options, value, onChange, label, disabled }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={disabled}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
