import { useEffect, useState } from 'react';
import { ArrowRight, MailCheck, ShieldCheck, Stethoscope, RefreshCw } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { resendVerificationEmail } from '../lib/api';
import { toast } from 'sonner';

const AUTH_LOGO_SRC = '/logo.png';
const COOLDOWN_SECONDS = 300;

export default function CheckEmailPage() {
  const params = new URLSearchParams(useLocation().search);
  const email = params.get('email');
  const [logoVisible, setLogoVisible] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email) return;
    const storageKey = `lastVerificationEmailSent_${email}`;
    const lastSent = localStorage.getItem(storageKey);
    if (lastSent) {
      const elapsed = Math.floor((Date.now() - parseInt(lastSent, 10)) / 1000);
      if (elapsed < COOLDOWN_SECONDS) {
        setCooldown(COOLDOWN_SECONDS - elapsed);
      }
    } else {
      localStorage.setItem(storageKey, Date.now().toString());
      setCooldown(COOLDOWN_SECONDS);
    }
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendVerificationEmail(email);
      toast.success('Verification email sent again!');
      const storageKey = `lastVerificationEmailSent_${email}`;
      localStorage.setItem(storageKey, Date.now().toString());
      setCooldown(COOLDOWN_SECONDS);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend email');
    } finally {
      setResending(false);
    }
  };

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#fffeff] px-4 py-6 text-[#161d18] sm:px-8 sm:py-8 lg:py-10">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="inline-flex items-center gap-3">
            {logoVisible ? (
              <img
                src={AUTH_LOGO_SRC}
                alt="ClinicKa! logo"
                className="h-11 w-11 rounded-full object-cover"
                onError={() => setLogoVisible(false)}
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d9f3e4] text-[#065f46]">
                <Stethoscope className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="text-lg font-semibold tracking-[-0.02em] text-[#161d18]">ClinicKa!</p>
              <p className="text-xs uppercase tracking-[0.18em] text-[#60717e]">Gordon College Health Services</p>
            </div>
          </Link>

          <Link
            to="/auth?mode=signin"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[#d8e4d7] bg-white px-5 text-sm font-normal text-[#161d18] transition active:scale-95 hover:bg-[#eef6ec] sm:w-auto"
          >
            Back to sign in
          </Link>
        </div>

        <div className="grid flex-1 gap-8 py-8 sm:gap-10 sm:py-10 lg:grid-cols-[1fr_0.96fr] lg:items-center">
          <div className="space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8e4d7] bg-white px-4 py-2 text-xs font-normal text-[#006d3c] sm:text-sm">
              <MailCheck className="h-4 w-4" />
              Verification email sent
            </div>

            <div className="space-y-4 sm:space-y-5">
              <h1 className="max-w-xl text-4xl font-semibold leading-[1.07] tracking-[-0.025em] text-[#161d18] sm:text-5xl lg:text-6xl">
                Check your inbox and confirm your account.
              </h1>
              <p className="max-w-xl text-[17px] leading-7 text-[#3d4a3f] sm:text-xl sm:leading-8">
                Your sign-up is almost done. Open the verification link we sent so your Gordon College account can start
                using ClinicKa! right away.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[18px] border border-[#d8e4d7] bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Step 1</p>
                <p className="mt-3 text-base font-semibold text-[#161d18]">Open your email</p>
                <p className="mt-2 text-sm leading-7 text-[#3d4a3f]">
                  Look for the verification message in your inbox, updates, or spam folder.
                </p>
              </div>
              <div className="rounded-[18px] border border-[#d8e4d7] bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Step 2</p>
                <p className="mt-3 text-base font-semibold text-[#161d18]">Tap the link</p>
                <p className="mt-2 text-sm leading-7 text-[#3d4a3f]">
                  Once verified, you will be redirected to sign in and continue your setup.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-[#d8e4d7] bg-white p-5 sm:p-8">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef6ec] text-[#006d3c]">
              <MailCheck className="h-6 w-6" />
            </div>

            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#161d18] sm:text-3xl">Verification in progress</h2>
            <p className="mt-2 text-sm leading-7 text-[#425468]">
              We sent a secure confirmation link{email ? ' to this address:' : '.'}
            </p>

            {email ? (
              <div className="mt-5 rounded-full border border-[#d8e4d7] bg-[#fffeff] px-4 py-3 text-sm font-semibold text-[#161d18]">
                {email}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3 rounded-[18px] border border-[#d8e4d7] bg-[#fffeff] px-4 py-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#065f46]" />
                <p className="text-sm leading-7 text-[#425468]">
                  Email verification protects student and clinic records by confirming account ownership first.
                </p>
              </div>
              <div className="rounded-[18px] border border-[#d8e4d7] bg-white px-4 py-4 text-sm leading-7 text-[#425468]">
                If the email does not arrive after a few minutes, you can request a new verification link below.
              </div>
            </div>

            {email && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#d8e4d7] bg-white px-5 text-sm font-normal text-[#161d18] transition active:scale-95 hover:bg-[#eef6ec] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
                  {resending
                    ? 'Sending...'
                    : cooldown > 0
                      ? `Resend available in ${formatCooldown(cooldown)}`
                      : 'Resend Verification Email'}
                </button>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth?mode=signin"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#006d3c] px-5 text-sm font-normal text-white transition active:scale-95 hover:bg-[#005f34]"
              >
                Go to sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[#d8e4d7] bg-white px-5 text-sm font-normal text-[#161d18] transition active:scale-95 hover:bg-[#eef6ec]"
              >
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
