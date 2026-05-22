import { cn } from './ui/utils';
import {
  getPasswordStrengthResult,
  MIN_PASSWORD_LENGTH,
  type PasswordPolicyUserInputs,
} from '../lib/password-policy';

type PasswordStrengthMeterProps = {
  password: string;
  userInputs?: PasswordPolicyUserInputs;
  className?: string;
  mode?: 'strict' | 'registration';
};

const toneClasses = [
  'bg-[#f5d6d2] text-[#8a1f17]',
  'bg-[#ffe3c1] text-[#8d4b00]',
  'bg-[#fff1b6] text-[#725400]',
  'bg-[#d7f0de] text-[#0f5c2d]',
  'bg-[#c8efe4] text-[#0b5d55]',
] as const;

const fillClasses = [
  'bg-[#d77a70]',
  'bg-[#e59a41]',
  'bg-[#d0b53f]',
  'bg-[#6bb16f]',
  'bg-[#3f9c68]',
] as const;

const progressWidths = ['14%', '30%', '52%', '76%', '100%'] as const;

export default function PasswordStrengthMeter({
  password,
  userInputs,
  className,
}: PasswordStrengthMeterProps) {
  if (!password) return null;

  const result = getPasswordStrengthResult(password, userInputs);
  const label = result.meetsLength ? result.label : 'Too short';
  const progressWidth = result.meetsLength
    ? progressWidths[result.score]
    : `${Math.max(10, Math.min(24, Math.round((result.length / MIN_PASSWORD_LENGTH) * 24)))}%`;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-[#60717e]">Password strength</span>
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
            toneClasses[result.score],
          )}
        >
          {label}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#dfe7e5]">
        <div
          className={cn(
            'h-full rounded-full transition-[width,background-color] duration-300 ease-out',
            fillClasses[result.score],
          )}
          style={{ width: progressWidth }}
        />
      </div>
    </div>
  );
}
