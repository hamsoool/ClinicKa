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
  loading?: boolean;
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
  loading = false,
  multiple = false,
  onFileSelected,
}: FilePickerButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <label
      className={cn(
        'relative inline-flex h-10 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-outline-variant/40 bg-white px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        isDisabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      aria-busy={loading || undefined}
      data-loading={loading ? 'true' : undefined}
    >
      <span className="pointer-events-none inline-flex items-center justify-center">{children}</span>
      {loading ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-2 bottom-1 h-1 overflow-hidden rounded-full bg-current/20"
        >
          <span className="gc-loading-indicator absolute inset-y-0 left-0 w-1/2 rounded-full bg-current/70" />
        </span>
      ) : null}
      <input
        type="file"
        accept={accept}
        aria-label={ariaLabel}
        capture={capture}
        disabled={isDisabled}
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
