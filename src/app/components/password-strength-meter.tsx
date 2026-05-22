import { cn } from './ui/utils';
import {
  getPasswordGuidanceMessage,
  getPasswordPolicyMessage,
  getPasswordStrengthResult,
  MIN_PASSWORD_LENGTH,
  MIN_REGISTRATION_PASSWORD_LENGTH,
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

const barClasses = [
  'bg-[#d77a70]',
  'bg-[#ebad57]',
  'bg-[#d8c252]',
  'bg-[#47a76b]',
] as const;

const progressWidths = ['18%', '36%', '58%', '78%', '100%'] as const;

export default function PasswordStrengthMeter({
  password,
  userInputs,
  className,
  mode = 'strict',
}: PasswordStrengthMeterProps) {
  const result = getPasswordStrengthResult(password, userInputs);
  const filledBars = password ? Math.max(1, Math.min(4, result.score + 1)) : 0;
  const requirements = [
    {
      label: `${MIN_PASSWORD_LENGTH}+ characters`,
      met: result.meetsLength,
    },
    {
      label: 'Not based on personal details',
      met: result.avoidsPersonalInfo,
    },
    {
      label: 'Hard to guess',
      met: result.meetsScore,
    },
  ];
  const helperMessage = password
    ? result.isStrongEnough
      ? 'This password meets the current security policy.'
      : getPasswordPolicyMessage(result)
    : getPasswordGuidanceMessage();

  if (mode === 'registration') {
    if (!password) return null;
    const registrationLabel =
      result.length < MIN_REGISTRATION_PASSWORD_LENGTH ? 'Too short' : result.label;
    const progressWidth =
      result.length < MIN_REGISTRATION_PASSWORD_LENGTH
        ? `${Math.max(10, Math.min(26, Math.round((result.length / MIN_REGISTRATION_PASSWORD_LENGTH) * 26)))}%`
        : progressWidths[result.score];

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
            {registrationLabel}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-[#dfe7e5]">
          <div
            className={cn(
              'h-full rounded-full transition-[width,background-color] duration-300 ease-out',
              toneClasses[result.score].split(' ')[0],
            )}
            style={{ width: progressWidth }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border border-[#d7e4df] bg-[#f7fbf9] p-3.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">Password strength</p>
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
            toneClasses[result.score],
          )}
        >
          {password ? result.label : 'Start typing'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {barClasses.map((barClassName, index) => (
          <div
            key={barClassName}
            className={cn(
              'h-1.5 rounded-full transition',
              index < filledBars ? barClassName : 'bg-[#d7e4df]',
            )}
          />
        ))}
      </div>

      <div className="mt-3 grid gap-2 text-xs text-[#425468]">
        {requirements.map((requirement) => (
          <div key={requirement.label} className="flex items-center gap-2">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full transition',
                requirement.met ? 'bg-[#0a7a43]' : 'bg-[#b8c7c3]',
              )}
            />
            <span>{requirement.label}</span>
          </div>
        ))}
      </div>

      <p aria-live="polite" className="mt-3 text-xs leading-5 text-[#425468]">
        {helperMessage}
      </p>
    </div>
  );
}
