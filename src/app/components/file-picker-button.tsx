import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from './ui/utils';

type FilePickerButtonProps = {
  accept?: string;
  ariaLabel: string;
  capture?: InputHTMLAttributes<HTMLInputElement>['capture'];
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  inputClassName?: string;
  multiple?: boolean;
  onFileSelected: (file: File | null) => void;
};

export default function FilePickerButton({
  accept,
  ariaLabel,
  capture,
  children,
  className,
  disabled = false,
  inputClassName,
  multiple = false,
  onFileSelected,
}: FilePickerButtonProps) {
  return (
    <label
      className={cn(
        'relative inline-flex h-10 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-outline-variant/40 bg-white px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="pointer-events-none inline-flex items-center justify-center">{children}</span>
      <input
        type="file"
        accept={accept}
        aria-label={ariaLabel}
        capture={capture}
        disabled={disabled}
        multiple={multiple}
        className={cn(
          'absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed',
          inputClassName,
        )}
        onClick={(event) => {
          event.currentTarget.value = '';
        }}
        onChange={(event) => {
          onFileSelected(event.currentTarget.files?.[0] || null);
        }}
      />
    </label>
  );
}
