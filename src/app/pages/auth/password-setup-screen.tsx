import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import PasswordStrengthMeter from '../../components/password-strength-meter';
import type { PasswordPolicyUserInputs } from '../../lib/password-policy';
import { MIN_PASSWORD_LENGTH } from '../../lib/password-policy';

type PasswordSetupScreenProps = {
  mode: 'setup' | 'recovery';
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  userInputs: PasswordPolicyUserInputs;
};

export function PasswordSetupScreen({
  mode,
  loading,
  error,
  successMessage,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  userInputs,
}: PasswordSetupScreenProps) {
  const isRecovery = mode === 'recovery';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const inputClassName =
    'h-12 w-full rounded-2xl border border-[#c8d6d1] bg-white/92 px-4 pr-12 text-sm text-[#0b1c30] outline-none transition focus:border-[#065f46] focus:ring-4 focus:ring-[#065f46]/10';
  const toggleClassName =
    'absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-[#60717e] transition hover:text-[#065f46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#065f46]/20';

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#f8f9ff_0%,#edf5ff_48%,#e3f2ec_100%)] px-5 py-6 sm:px-6 sm:py-10"
      style={{ fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center sm:min-h-[calc(100vh-5rem)]">
        <div className="grid w-full gap-6 sm:gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="hidden space-y-5 lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c8ddd2] bg-white/72 px-4 py-2 text-sm font-semibold text-[#065f46] shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
              <Sparkles className="h-4 w-4" />
              {isRecovery ? 'Confirm your new password' : 'Complete your account setup'}
            </div>
            <h1 className="max-w-xl text-4xl font-bold tracking-[-0.04em] text-[#0b1c30] xl:text-5xl">
              {isRecovery ? 'Reset your ClinicKa! password.' : 'Finish securing your ClinicKa! access.'}
            </h1>
            <p className="max-w-xl text-lg leading-8 text-[#425468]">
              {isRecovery
                ? 'Choose a new password to regain access to your Gordon College clinic account.'
                : 'You signed in with Google successfully. Set a password so your Gordon College account can also use manual sign-in whenever needed.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-white/70 bg-white/72 p-5 shadow-[0_24px_60px_rgba(11,28,48,0.08)] backdrop-blur">
                <Lock className="h-6 w-6 text-[#065f46]" />
                <p className="mt-4 text-base font-semibold text-[#0b1c30]">
                  {isRecovery ? 'Fresh credentials' : 'Backup access'}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#425468]">
                  {isRecovery
                    ? 'Replace the old password with a new one that only you know.'
                    : 'Keep both Google sign-in and email/password available for the same account.'}
                </p>
              </div>
              <div className="rounded-[28px] border border-white/70 bg-white/72 p-5 shadow-[0_24px_60px_rgba(11,28,48,0.08)] backdrop-blur">
                <ShieldCheck className="h-6 w-6 text-[#065f46]" />
                <p className="mt-4 text-base font-semibold text-[#0b1c30]">Protected records</p>
                <p className="mt-2 text-sm leading-6 text-[#425468]">
                  Password-protected access helps keep clinic data and student records safer.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/70 bg-white/78 p-5 shadow-[0_28px_80px_rgba(11,28,48,0.12)] backdrop-blur sm:rounded-[2rem] sm:p-8">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e2f5ea] text-[#065f46]">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#0b1c30] sm:text-3xl">
              {isRecovery ? 'Create a new password' : 'Set your password'}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[#425468]">
              {isRecovery
                ? `Choose a new password with at least ${MIN_PASSWORD_LENGTH} characters for your account.`
                : `Choose a password with at least ${MIN_PASSWORD_LENGTH} characters to complete your account setup.`}
            </p>

            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    className={inputClassName}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className={toggleClassName}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrengthMeter password={password} userInputs={userInputs} className="mt-3" />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(event) => onConfirmPasswordChange(event.target.value)}
                    placeholder="Re-enter password"
                    className={inputClassName}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className={toggleClassName}
                    aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-2xl border border-[#ffd8d1] bg-[#fff2ef] px-4 py-3 text-sm font-medium text-[#93000a]">
                  {error}
                </p>
              ) : null}
              {successMessage ? (
                <p className="rounded-2xl border border-[#bee6d3] bg-[#edf9f2] px-4 py-3 text-sm font-medium text-[#065f46]">
                  {successMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#004532] text-sm font-semibold text-white transition hover:bg-[#065f46] disabled:opacity-70"
              >
                {loading
                  ? isRecovery
                    ? 'Resetting password...'
                    : 'Saving password...'
                  : isRecovery
                    ? 'Reset password'
                    : 'Save password'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
