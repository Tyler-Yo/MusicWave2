/** Accessible native range input with a filled track (see `.mw-range` in index.css). */
import type { CSSProperties, InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  valueText?: string;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}

export function Slider({ value, min = 0, max = 1, step = 0.01, label, valueText, onChange, onCommit, className, style, ...rest }: SliderProps) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className={cn('mw-range', className)}
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      aria-valuetext={valueText}
      style={{ '--fill': `${Math.max(0, Math.min(100, fill))}%`, ...style } as CSSProperties}
      onChange={(e) => onChange(Number(e.currentTarget.value))}
      onPointerUp={(e) => onCommit?.(Number(e.currentTarget.value))}
      onKeyUp={(e) => onCommit?.(Number(e.currentTarget.value))}
      {...rest}
    />
  );
}
