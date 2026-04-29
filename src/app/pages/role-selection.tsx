import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Activity, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { signInWithGoogle } from '../lib/api';
import { useAuth } from '../lib/auth';

const GC_DOMAIN = 'gordoncollege.edu.ph';

function getHomePath(role: 'student' | 'staff' | 'admin') {
  if (role === 'staff') return '/staff';
  if (role === 'admin') return '/admin';
  return '/student';
}

export default function RoleSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, loading, requiresPasswordSetup, completePasswordSetup } = useAuth();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const startsInSignInMode = query.get('mode') === 'signin';
  const verifiedFromEmail = query.get('verified') === '1';
  const googleError = query.get('google_error');

  const [mode, setMode] = useState<'signin' | 'signup'>(startsInSignInMode ? 'signin' : 'signup');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    verifiedFromEmail ? 'Email verified. You can now sign in with your account.' : null,
  );

  const [signInForm, setSignInForm] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [signUpForm, setSignUpForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [passwordSetupForm, setPasswordSetupForm] = useState({
    password: '',
    confirmPassword: '',
  });

  const fromPath = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from;
  }, [location.state]);

  useEffect(() => {
    if (startsInSignInMode) {
      setMode('signin');
    }
  }, [startsInSignInMode]);

  useEffect(() => {
    if (verifiedFromEmail) {
      setMode('signin');
      setSuccessMessage('Email verified. You can now sign in with your account.');
    }
  }, [verifiedFromEmail]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      const me = await signIn(signInForm.email, signInForm.password);
      const fallbackRole = signInForm.email.toLowerCase().includes('admin')
        ? 'admin'
        : signInForm.email.toLowerCase().includes('staff')
          ? 'staff'
          : 'student';
      const role = me.profile.role ?? fallbackRole;
      navigate(fromPath || getHomePath(role), { replace: true });
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : 'Unable to sign in. Please try again.';
      if (message.toLowerCase().includes('invalid login credentials')) {
        setError('Invalid login credentials. Verify email confirmation first, then recheck email/password.');
        return;
      }
      setError(message);
    }
  }

  function handleGoogleSignIn() {
    setError(null);
    setSuccessMessage(null);
    signInWithGoogle();
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!signUpForm.name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!signUpForm.email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (!signUpForm.email.trim().toLowerCase().endsWith(`@${GC_DOMAIN}`)) {
      setError(`Please register using your @${GC_DOMAIN} email address.`);
      return;
    }
    if (signUpForm.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      const result = await signUp(signUpForm.name, signUpForm.email, signUpForm.password);
      if (result.emailConfirmationRequired) {
        navigate(`/check-email?email=${encodeURIComponent(signUpForm.email)}`, { replace: true });
        return;
      }

      if (result.me) {
        navigate(getHomePath(result.me.profile.role), { replace: true });
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create account.');
    }
  }

  async function handlePasswordSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (passwordSetupForm.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (passwordSetupForm.password !== passwordSetupForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await completePasswordSetup(passwordSetupForm.password);
      setSuccessMessage('Password set successfully. You can now sign in manually.');
      navigate('/', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to set password.');
    }
  }

  const googleErrorMessage =
    googleError === 'invalid_domain'
      ? `Only @${GC_DOMAIN} Google accounts are allowed.`
      : googleError === 'invalid_token'
        ? 'Google sign-in failed. Please try again.'
        : null;

  if (requiresPasswordSetup) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-semibold text-on-surface">Set Your Password</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              You signed in with Google. Set a password now so manual sign-in will work too.
            </p>

            <form className="mt-6 space-y-5" onSubmit={handlePasswordSetup}>
              <div>
                <label className="mb-2 block text-xs font-semibold text-on-surface">New password</label>
                <input
                  type="password"
                  required
                  value={passwordSetupForm.password}
                  onChange={(event) =>
                    setPasswordSetupForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder="At least 6 characters"
                  className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-on-surface">Confirm password</label>
                <input
                  type="password"
                  required
                  value={passwordSetupForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordSetupForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  placeholder="Re-enter password"
                  className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {error ? <p className="text-sm font-semibold text-on-error-container">{error}</p> : null}
              {successMessage ? (
                <p className="text-sm font-semibold text-on-primary-container">{successMessage}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:opacity-70"
              >
                {loading ? 'Saving Password...' : 'Save Password'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <div className="relative hidden w-full items-center justify-center overflow-hidden bg-surface-container lg:flex lg:w-1/2">
          <img
            className="absolute inset-0 h-full w-full object-cover opacity-80"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAd3VwXj5OK8iMBqqOqTv48Fh_xNptG3ee5ZdqghkjB8IaP3a5YLn-71b7Gxl4Fw_9PUNwxunKhkfKLRl_aFnPgYGh7-GHSU1lva8H-qtjbTwMNSmkeCUU3Q2l-MQTDTE8FHOkwbZ2eqqno2VJLejqHilJbTswkVkX5OnnF01j8CzM0EttphMup6DGf8yxbYlihttn0ZdnOs5gqs1LT6WIFeYP0tIjczjOR_0Il6ElGeUkO7TfoIQwaoR7r5UBJX4b71OYdanswMx4"
            alt="Gordon College campus"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-tertiary to-transparent opacity-70" />
          <div className="relative z-10 max-w-lg px-12 text-center text-inverse-on-surface">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-surface-container-lowest text-primary shadow-lg">
              <Activity className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-semibold text-surface-container-lowest">Clinic Management System</h2>
            <p className="mt-3 text-base text-inverse-on-surface">
              Streamlining health records and clinical administrative tasks for the Gordon College student body.
            </p>
          </div>
        </div>

        <div className="flex w-full items-center justify-center bg-surface-container-lowest px-6 py-10 sm:px-10 lg:w-1/2">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center lg:hidden">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <Activity className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-on-surface">Gordon College</h2>
            </div>

            {mode === 'signin' ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-semibold text-on-surface">Welcome Back</h1>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Sign in to your Gordon College clinic account.
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleSignIn}>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-on-surface">Gordon College Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                      <input
                        type="email"
                        required
                        value={signInForm.email}
                        onChange={(event) =>
                          setSignInForm((prev) => ({ ...prev, email: event.target.value }))
                        }
                        placeholder={`name@${GC_DOMAIN}`}
                        className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-4 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-on-surface">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                      <input
                        type={showSignInPassword ? 'text' : 'password'}
                        required
                        value={signInForm.password}
                        onChange={(event) =>
                          setSignInForm((prev) => ({ ...prev, password: event.target.value }))
                        }
                        placeholder="••••••••"
                        className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-10 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-outline"
                        onClick={() => setShowSignInPassword((prev) => !prev)}
                        aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                      >
                        {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={signInForm.remember}
                        onChange={(event) =>
                          setSignInForm((prev) => ({ ...prev, remember: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      Remember me
                    </label>
                    <button type="button" className="font-semibold text-primary">
                      Forgot Password?
                    </button>
                  </div>

                  {error ? <p className="text-sm font-semibold text-on-error-container">{error}</p> : null}
                  {googleErrorMessage ? (
                    <p className="text-sm font-semibold text-on-error-container">{googleErrorMessage}</p>
                  ) : null}
                  {successMessage ? (
                    <p className="text-sm font-semibold text-on-primary-container">{successMessage}</p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:opacity-70"
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="relative py-2">
                  <div className="h-px bg-outline-variant" />
                  <span className="absolute inset-x-0 -top-2 mx-auto w-fit bg-surface-container-lowest px-3 text-xs text-on-surface-variant">
                    Or continue with
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest py-3 text-xs font-semibold text-on-surface hover:bg-surface-container-low"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Sign in with Google
                </button>

                <p className="text-center text-sm text-on-surface-variant">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    className="font-semibold text-primary"
                    onClick={() => {
                      setError(null);
                      setSuccessMessage(null);
                      setMode('signup');
                    }}
                  >
                    Sign Up
                  </button>
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-semibold text-on-surface">Create an account</h1>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Register with your Gordon College email to get started.
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleSignUp}>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-on-surface">Your name</label>
                    <input
                      required
                      value={signUpForm.name}
                      onChange={(event) =>
                        setSignUpForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="First Last"
                      className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-on-surface">Email</label>
                    <input
                      type="email"
                      required
                      value={signUpForm.email}
                      onChange={(event) =>
                        setSignUpForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder={`name@${GC_DOMAIN}`}
                      className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-on-surface">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                      <input
                        type={showSignUpPassword ? 'text' : 'password'}
                        required
                        value={signUpForm.password}
                        onChange={(event) =>
                          setSignUpForm((prev) => ({ ...prev, password: event.target.value }))
                        }
                        placeholder="At least 6 characters"
                        className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-10 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-outline"
                        onClick={() => setShowSignUpPassword((prev) => !prev)}
                        aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                      >
                        {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-on-surface-variant">
                    By signing up I agree to the <span className="font-semibold underline">terms & conditions</span> and{' '}
                    <span className="font-semibold underline">privacy policy</span>.
                  </p>

                  {error ? <p className="text-sm font-semibold text-on-error-container">{error}</p> : null}
                  {googleErrorMessage ? (
                    <p className="text-sm font-semibold text-on-error-container">{googleErrorMessage}</p>
                  ) : null}
                  {successMessage ? (
                    <p className="text-sm font-semibold text-on-primary-container">{successMessage}</p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:opacity-70"
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="relative py-2">
                  <div className="h-px bg-outline-variant" />
                  <span className="absolute inset-x-0 -top-2 mx-auto w-fit bg-surface-container-lowest px-3 text-xs text-on-surface-variant">
                    Or continue with
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest py-3 text-xs font-semibold text-on-surface hover:bg-surface-container-low"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>

                <p className="text-center text-sm text-on-surface-variant">
                  Already a member?{' '}
                  <button
                    type="button"
                    className="font-semibold text-primary"
                    onClick={() => {
                      setError(null);
                      setSuccessMessage(null);
                      setMode('signin');
                    }}
                  >
                    Sign In
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
