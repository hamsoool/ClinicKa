import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, Stethoscope } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  getPasswordResetCooldownRemaining,
  PASSWORD_RESET_COOLDOWN_SECONDS,
  sendPasswordResetEmail,
  signInWithGoogle,
  type UserRole,
} from '../lib/api';
import { inferRoleFromEmail, prefetchLikelyPortalRoutes, prefetchPortalExperience } from '../lib/login-prefetch';
import { getPasswordPolicyMessage, getPasswordStrengthResult } from '../lib/password-policy';
import { useAuth } from '../lib/auth';
import { LegalDialog } from './auth/legal-dialog';
import { PasswordSetupScreen } from './auth/password-setup-screen';
import { CONTACT_EMAIL, POLICY_UPDATED_AT, privacySections, termsSections } from './auth/legal-content';

const GC_DOMAIN = 'gordoncollege.edu.ph';
const AUTH_LOGO_SRC = '/logo.png';
const DASHBOARD_PREVIEW_SRC = '/previews/student-dashboard-preview.png';

function getHomePath(role: UserRole) {
  if (role === 'super_admin') return '/super-admin';
  if (role === 'staff') return '/staff';
  if (role === 'admin') return '/admin';
  return '/student';
}

export default function AuthAccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    me,
    signIn,
    loading,
    requiresPasswordSetup,
    isPasswordRecovery,
    completePasswordRecovery,
  } = useAuth();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const verifiedFromEmail = query.get('verified') === '1';
  const resetCompleted = query.get('reset') === '1';
  const googleError = query.get('google_error');
  const authReason = query.get('reason');

  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    verifiedFromEmail
      ? 'Email verified. You can now sign in with your account.'
      : resetCompleted
        ? 'Password reset successful. You can now sign in with your new password.'
        : null,
  );
  const [logoVisible, setLogoVisible] = useState(true);
  const [signInForm, setSignInForm] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [passwordRecoveryForm, setPasswordRecoveryForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [forgotPasswordDialogOpen, setForgotPasswordDialogOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);

  const passwordRecoveryInputs = useMemo(
    () => ({
      email: me?.profile?.email,
      firstName: me?.profile?.first_name,
      lastName: me?.profile?.last_name,
      studentId: me?.profile?.student_id,
    }),
    [me],
  );
  const passwordRecoveryResult = useMemo(
    () => getPasswordStrengthResult(passwordRecoveryForm.password, passwordRecoveryInputs),
    [passwordRecoveryForm.password, passwordRecoveryInputs],
  );
  const fromPath = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from;
  }, [location.state]);

  useEffect(() => {
    if (verifiedFromEmail) {
      setSuccessMessage('Email verified. You can now sign in with your account.');
    }
  }, [verifiedFromEmail]);

  useEffect(() => {
    if (resetCompleted) {
      setSuccessMessage('Password reset successful. You can now sign in with your new password.');
    }
  }, [resetCompleted]);

  useEffect(() => {
    if (authReason !== 'idle_timeout') return;
    setError('Your session expired due to inactivity. Please sign in again.');
  }, [authReason]);

  useEffect(() => {
    if (!forgotPasswordDialogOpen) return;

    const remaining = getPasswordResetCooldownRemaining(forgotPasswordEmail);
    setResetCooldown(remaining);
  }, [forgotPasswordDialogOpen, forgotPasswordEmail]);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResetCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  useEffect(() => {
    prefetchLikelyPortalRoutes(signInForm.email);
  }, [signInForm.email]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const fallbackRole = inferRoleFromEmail(signInForm.email);
    prefetchLikelyPortalRoutes(signInForm.email);

    try {
      const resolvedMe = await signIn(signInForm.email, signInForm.password);
      const role = resolvedMe.profile.role ?? fallbackRole;
      prefetchPortalExperience(role, resolvedMe);
      navigate(fromPath || getHomePath(role), { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Invalid login credentials.');
    }
  }

  function handleGoogleAuth() {
    setError(null);
    setSuccessMessage(null);
    prefetchLikelyPortalRoutes(signInForm.email);
    signInWithGoogle();
  }

  function openForgotPasswordDialog() {
    setError(null);
    setSuccessMessage(null);
    const nextEmail = signInForm.email.trim();
    setForgotPasswordEmail(nextEmail);
    setResetCooldown(getPasswordResetCooldownRemaining(nextEmail));
    setForgotPasswordDialogOpen(true);
  }

  async function handleForgotPassword() {
    setError(null);
    setSuccessMessage(null);

    if (!forgotPasswordEmail.trim()) {
      setError('Please enter your email first.');
      return;
    }

    if (resetCooldown > 0) {
      setError(`Please wait ${formatCooldown(resetCooldown)} before requesting another password reset email.`);
      return;
    }

    setSendingResetEmail(true);
    try {
      await sendPasswordResetEmail(forgotPasswordEmail);
      setResetCooldown(getPasswordResetCooldownRemaining(forgotPasswordEmail));
      setForgotPasswordDialogOpen(false);
      setSuccessMessage('If the account exists, password reset instructions have been sent to your email.');
    } catch (nextError) {
      setResetCooldown(getPasswordResetCooldownRemaining(forgotPasswordEmail));
      setError(nextError instanceof Error ? nextError.message : 'Unable to send password reset email. Please try again.');
    } finally {
      setSendingResetEmail(false);
    }
  }

  async function handlePasswordRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!passwordRecoveryResult.isStrongEnough) {
      setError(getPasswordPolicyMessage(passwordRecoveryResult));
      return;
    }
    if (passwordRecoveryForm.password !== passwordRecoveryForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await completePasswordRecovery(passwordRecoveryForm.password);
      navigate('/auth?mode=signin&reset=1', { replace: true });
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Unable to reset password. Please try again.',
      );
    }
  }

  function formatCooldown(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  const googleErrorMessage =
    googleError === 'invalid_domain'
      ? `Only @${GC_DOMAIN} Google accounts are allowed. Non-Gordon Google accounts are blocked and not registered in the system.`
      : googleError === 'invalid_token'
        ? 'Google sign-in failed. Please try again.'
        : googleError === 'archived_account'
          ? 'This account is not available. Contact the administrator for assistance.'
          : googleError === 'account_load_failed'
            ? 'Google sign-in succeeded, but your account could not be loaded from the database. Please try again.'
            : null;

  const iconInputClassName =
    'h-12 w-full rounded-full border border-[#d8e4d7] bg-white pl-11 pr-4 text-sm text-[#161d18] outline-none transition focus:border-[#006d3c] focus:ring-2 focus:ring-[#006d3c]/18';

  if (requiresPasswordSetup) {
    return <Navigate to="/create-password" replace />;
  }

  if (isPasswordRecovery) {
    return (
      <PasswordSetupScreen
        mode="recovery"
        loading={loading}
        error={error}
        successMessage={successMessage}
        password={passwordRecoveryForm.password}
        confirmPassword={passwordRecoveryForm.confirmPassword}
        onPasswordChange={(value) => setPasswordRecoveryForm((prev) => ({ ...prev, password: value }))}
        onConfirmPasswordChange={(value) =>
          setPasswordRecoveryForm((prev) => ({ ...prev, confirmPassword: value }))
        }
        onSubmit={handlePasswordRecovery}
        userInputs={passwordRecoveryInputs}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fffeff] text-[#161d18]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-8 sm:py-8 lg:py-10">
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
            to="/"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[#d8e4d7] bg-white px-5 text-sm font-normal text-[#161d18] transition active:scale-95 hover:bg-[#eef6ec] sm:w-auto"
          >
            Back to Homepage
          </Link>
        </div>

        <div className="flex flex-col-reverse gap-8 py-8 sm:gap-10 sm:py-10 lg:grid lg:flex-none lg:grid-cols-[1fr_0.96fr] lg:items-center">
          <div className="space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8e4d7] bg-white px-4 py-2 text-xs font-normal text-[#006d3c] sm:text-sm">
              <CheckCircle2 className="h-4 w-4" />
              School clinic portal access
            </div>

            <div className="space-y-4 sm:space-y-5">
              <h1 className="max-w-xl text-4xl font-semibold leading-[1.07] tracking-[-0.025em] text-[#161d18] sm:text-5xl lg:text-6xl">
                Access your clinic workflow with clarity.
              </h1>
              <p className="max-w-xl text-[17px] leading-7 text-[#3d4a3f] sm:text-xl sm:leading-8">
                Sign in with your Gordon College email and password. First-time account creation starts with your Gordon College Google sign-in.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[18px] border border-[#d8e4d7] bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Students</p>
                <p className="mt-3 text-sm leading-7 text-[#3d4a3f]">Submit requirements, track status, and manage records.</p>
              </div>
              <div className="rounded-[18px] border border-[#d8e4d7] bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Clinic Staff</p>
                <p className="mt-3 text-sm leading-7 text-[#3d4a3f]">Review submissions and maintain the clinic workflow.</p>
              </div>
              <div className="rounded-[18px] border border-[#d8e4d7] bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Administrators</p>
                <p className="mt-3 text-sm leading-7 text-[#3d4a3f]">Manage access, reports, and system oversight.</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[18px] border border-[#d8e4d7] bg-white p-3 sm:p-4">
              <img
                src={DASHBOARD_PREVIEW_SRC}
                alt="ClinicKa! student dashboard preview"
                className="h-full w-full rounded-[12px] border border-[#d8e4d7] object-cover object-left-top drop-shadow-[3px_5px_30px_rgba(0,0,0,0.16)]"
              />
            </div>
          </div>

          <div className="self-start rounded-[18px] border border-[#d8e4d7] bg-white p-4 sm:p-8">
            <div className="border-b border-[#dfebea] pb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Secure account access</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#161d18] sm:text-3xl">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#3d4a3f]">
                Sign in to your Gordon College clinic account.
              </p>
            </div>

            <div className="flex min-h-0 flex-col gap-8 pt-5 sm:pt-6">
              <form className="space-y-4" onSubmit={handleSignIn}>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                    Gordon College email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#70808b]" />
                    <input
                      type="email"
                      required
                      value={signInForm.email}
                      onChange={(event) =>
                        setSignInForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder={`name@${GC_DOMAIN}`}
                      className={iconInputClassName}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#70808b]" />
                    <input
                      type={showSignInPassword ? 'text' : 'password'}
                      required
                      value={signInForm.password}
                      onChange={(event) =>
                        setSignInForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      placeholder="••••••••"
                      className={`${iconInputClassName} pr-12`}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#70808b]"
                      onClick={() => setShowSignInPassword((prev) => !prev)}
                      aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#4a5b68]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={signInForm.remember}
                      onChange={(event) =>
                        setSignInForm((prev) => ({ ...prev, remember: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-[#b8c7c3] text-[#065f46] focus:ring-[#065f46]"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      openForgotPasswordDialog();
                    }}
                    disabled={loading || sendingResetEmail}
                    className="font-normal text-[#006d3c] hover:text-[#004532] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Forgot password?
                  </button>
                </div>

                {error ? (
                  <p className="rounded-2xl border border-[#ffd8d1] bg-[#fff2ef] px-4 py-3 text-sm font-medium text-[#93000a]">
                    {error}
                  </p>
                ) : null}
                {googleErrorMessage ? (
                  <p className="rounded-2xl border border-[#ffd8d1] bg-[#fff2ef] px-4 py-3 text-sm font-medium text-[#93000a]">
                    {googleErrorMessage}
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
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#006d3c] text-sm font-normal text-white transition active:scale-95 hover:bg-[#005f34] disabled:opacity-70"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-xs leading-6 text-[#60717e]">
                  By signing in, you agree to our{' '}
                  <LegalDialog
                    label="Terms & Conditions"
                    eyebrow="Portal Terms"
                    title="Terms & Conditions"
                    description="These terms govern access to the Gordon College Clinic Management System and the submission of records through the portal."
                    meta={[
                      'Applies to student and clinic portal use',
                      `Last updated ${POLICY_UPDATED_AT}`,
                      'Covers account use, submissions, and access',
                    ]}
                    sections={termsSections}
                    footer="By using the portal, you acknowledge that records submitted through the system may be reviewed and managed by authorized Gordon College personnel as part of official clinic operations."
                  />{' '}
                  and{' '}
                  <LegalDialog
                    label="Privacy Policy"
                    eyebrow="Data Privacy Notice"
                    title="Privacy Policy"
                    description="How Gordon College collects, uses, stores, and protects personal data in the Clinic Management System."
                    meta={[
                      'Data controller: Gordon College',
                      `Last updated ${POLICY_UPDATED_AT}`,
                      `Contact: ${CONTACT_EMAIL}`,
                    ]}
                    sections={privacySections}
                    footer="This policy presentation is aligned with the Gordon College General Privacy Notice and is intended to help users understand how personal data is handled inside the clinic portal."
                  />
                  .
                </p>
              </form>

              <Dialog open={forgotPasswordDialogOpen} onOpenChange={setForgotPasswordDialogOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Reset password</DialogTitle>
                    <DialogDescription>
                      Enter your email and we will send you a password reset link.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleForgotPassword();
                    }}
                  >
                    <input
                      type="email"
                      required
                      value={forgotPasswordEmail}
                      onChange={(event) => {
                        const nextEmail = event.target.value;
                        setForgotPasswordEmail(nextEmail);
                        setResetCooldown(getPasswordResetCooldownRemaining(nextEmail));
                      }}
                      placeholder={`name@${GC_DOMAIN}`}
                      className="h-12 w-full rounded-full border border-[#d8e4d7] bg-white px-4 text-sm text-[#161d18] outline-none transition focus:border-[#006d3c] focus:ring-2 focus:ring-[#006d3c]/18"
                    />
                    <p className="text-xs leading-6 text-[#4a5b68]">
                      {resetCooldown > 0
                        ? `You can request another reset link in ${formatCooldown(resetCooldown)}.`
                        : `You can request one reset email every ${Math.floor(PASSWORD_RESET_COOLDOWN_SECONDS / 60)} minutes.`}
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setForgotPasswordDialogOpen(false)}
                        disabled={sendingResetEmail}
                        className="rounded-full border border-[#d8e4d7] px-4 py-2 text-sm font-normal text-[#3d4a3f] transition hover:bg-[#eef6ec] disabled:opacity-70"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={sendingResetEmail || resetCooldown > 0}
                        className="rounded-full bg-[#006d3c] px-4 py-2 text-sm font-normal text-white transition active:scale-95 hover:bg-[#005f34] disabled:opacity-70"
                      >
                        {sendingResetEmail
                          ? 'Sending...'
                          : resetCooldown > 0
                            ? `Try again in ${formatCooldown(resetCooldown)}`
                            : 'Send reset link'}
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <div className="space-y-4">
                <div className="relative py-1">
                  <div className="h-px bg-[#dbe5e4]" />
                  <span className="absolute inset-x-0 -top-2 mx-auto w-fit bg-white px-3 text-xs text-[#60717e]">
                    Or continue with
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#d8e4d7] bg-white text-sm font-normal text-[#161d18] transition active:scale-95 hover:bg-[#eef6ec]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Sign in with Google
                </button>

                <p className="text-center text-sm text-[#4a5b68]">
                  New to ClinicKa!? Use your Gordon College Domain to sign up and create your account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
