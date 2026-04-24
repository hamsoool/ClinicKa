import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/auth';

function getHomePath(role: 'student' | 'staff' | 'admin') {
  if (role === 'staff') return '/staff';
  if (role === 'admin') return '/admin';
  return '/student';
}

export default function RoleSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, loading } = useAuth();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const startsInSignInMode = query.get('mode') === 'signin';
  const verifiedFromEmail = query.get('verified') === '1';

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

  return (
    <div className="min-h-screen bg-[#17810f] px-4 py-8 sm:px-6 md:py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-center text-3xl font-semibold text-white sm:text-4xl">
          Gordon College Student Portal
        </h1>

        <div className="mt-6 overflow-hidden border border-[#3f8f3b] bg-[#4f9a47] shadow-xl">
          <div className="grid min-h-[520px] grid-cols-1 md:grid-cols-2">
            {mode === 'signup' ? (
              <>
                <div className="hidden border-r-2 border-[#2f99ff] bg-[#4a9543] md:block" />
                <section className="bg-[#78bd6f] p-6 sm:p-8">
                  <h2 className="text-2xl font-bold text-[#102410]">Create an account</h2>
                  <p className="mt-1 text-sm text-[#1f3b1b]">Provide your details.</p>

                  <form className="mt-6 space-y-4" onSubmit={handleSignUp}>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#183015]">Your name</label>
                      <input
                        required
                        value={signUpForm.name}
                        onChange={(event) =>
                          setSignUpForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="First Last"
                        className="h-10 w-full rounded-sm border border-black/20 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#36f13c]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#183015]">Email</label>
                      <input
                        type="email"
                        required
                        value={signUpForm.email}
                        onChange={(event) =>
                          setSignUpForm((prev) => ({ ...prev, email: event.target.value }))
                        }
                        placeholder="you@email.com"
                        className="h-10 w-full rounded-sm border border-black/20 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#36f13c]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#183015]">Password</label>
                      <div className="relative">
                        <input
                          type={showSignUpPassword ? 'text' : 'password'}
                          required
                          value={signUpForm.password}
                          onChange={(event) =>
                            setSignUpForm((prev) => ({ ...prev, password: event.target.value }))
                          }
                          placeholder="At least 6 characters"
                          className="h-10 w-full rounded-sm border border-black/20 bg-white px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#36f13c]"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-2 text-[#496046]"
                          onClick={() => setShowSignUpPassword((prev) => !prev)}
                          aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                        >
                          {showSignUpPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#274824]">
                      By signing up I agree to the <span className="font-semibold underline">terms & conditions</span> and <span className="font-semibold underline">privacy policy</span>
                    </p>

                    {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
                    {successMessage ? <p className="text-sm font-semibold text-green-800">{successMessage}</p> : null}

                    <button
                      type="submit"
                      disabled={loading}
                      className="h-10 w-full rounded-sm bg-[#3bf839] font-semibold text-[#173312] transition hover:bg-[#35e134] disabled:opacity-70"
                    >
                      {loading ? 'Creating Account...' : 'Create Account'}
                    </button>

                    <div className="relative">
                      <div className="h-px bg-[#588c53]" />
                      <p className="absolute inset-x-0 -top-2 mx-auto w-fit bg-[#78bd6f] px-2 text-xs text-[#2f4f2b]">OR</p>
                    </div>

                    <button
                      type="button"
                      className="mx-auto flex h-9 w-20 items-center justify-center rounded-sm bg-white text-sm font-semibold text-[#3b4953]"
                    >
                      G
                    </button>

                    <p className="pt-2 text-center text-sm text-[#31572d]">
                      Already a Member?{' '}
                      <button
                        type="button"
                        className="font-semibold text-[#1f7f1e]"
                        onClick={() => {
                          setError(null);
                          setMode('signin');
                        }}
                      >
                        Sign In.
                      </button>
                    </p>
                  </form>
                </section>
              </>
            ) : (
              <>
                <section className="bg-[#78bd6f] p-6 sm:p-8">
                  <h2 className="text-2xl font-bold text-[#102410]">Welcome</h2>
                  <p className="mt-1 text-sm text-[#1f3b1b]">Track your Medical Forms</p>

                  <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#183015]">Email</label>
                      <input
                        type="email"
                        required
                        value={signInForm.email}
                        onChange={(event) =>
                          setSignInForm((prev) => ({ ...prev, email: event.target.value }))
                        }
                        placeholder="Enter your email"
                        className="h-10 w-full rounded-sm border border-black/20 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#36f13c]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#183015]">Password</label>
                      <div className="relative">
                        <input
                          type={showSignInPassword ? 'text' : 'password'}
                          required
                          value={signInForm.password}
                          onChange={(event) =>
                            setSignInForm((prev) => ({ ...prev, password: event.target.value }))
                          }
                          placeholder="Password"
                          className="h-10 w-full rounded-sm border border-black/20 bg-white px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#36f13c]"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-2 text-[#496046]"
                          onClick={() => setShowSignInPassword((prev) => !prev)}
                          aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                        >
                          {showSignInPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <label className="flex items-center gap-2 text-[#274824]">
                        <input
                          type="checkbox"
                          checked={signInForm.remember}
                          onChange={(event) =>
                            setSignInForm((prev) => ({ ...prev, remember: event.target.checked }))
                          }
                        />
                        Remember me
                      </label>
                      <button type="button" className="font-semibold text-[#f24141]">
                        Forgot Password?
                      </button>
                    </div>

                    {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
                    {successMessage ? <p className="text-sm font-semibold text-green-800">{successMessage}</p> : null}

                    <button
                      type="submit"
                      disabled={loading}
                      className="h-10 w-full rounded-sm bg-[#3bf839] font-semibold text-[#173312] transition hover:bg-[#35e134] disabled:opacity-70"
                    >
                      {loading ? 'Signing In...' : 'Sign In'}
                    </button>

                    <div className="relative">
                      <div className="h-px bg-[#588c53]" />
                      <p className="absolute inset-x-0 -top-2 mx-auto w-fit bg-[#78bd6f] px-2 text-xs text-[#2f4f2b]">OR</p>
                    </div>

                    <button
                      type="button"
                      className="mx-auto flex h-9 w-20 items-center justify-center rounded-sm bg-white text-sm font-semibold text-[#3b4953]"
                    >
                      G
                    </button>

                    <p className="pt-2 text-center text-sm text-[#31572d]">
                      Don't have an account?{' '}
                      <button
                        type="button"
                        className="font-semibold text-[#1f7f1e]"
                        onClick={() => {
                          setError(null);
                          setSuccessMessage(null);
                          setMode('signup');
                        }}
                      >
                        Sign Up
                      </button>
                    </p>
                  </form>
                </section>
                <div className="hidden bg-[#4a9543] md:block" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
