import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  XIcon,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  getPasswordResetCooldownRemaining,
  PASSWORD_RESET_COOLDOWN_SECONDS,
  sendPasswordResetEmail,
  signInWithGoogle,
} from '../lib/api';
import {
  inferRoleFromEmail,
  prefetchLikelyPortalRoutes,
  prefetchPortalExperience,
} from '../lib/login-prefetch';
import { useAuth } from '../lib/auth';

const GC_DOMAIN = 'gordoncollege.edu.ph';
const POLICY_UPDATED_AT = 'April 29, 2026';
const AUTH_LOGO_SRC = '/logo.png';
const DASHBOARD_PREVIEW_SRC = new URL('../../../exports/figma/02-student-dashboard.png', import.meta.url).href;
const CONTACT_EMAIL = 'digitalduo.clinicka@gmail.com';

function deriveStudentIdFromEmail(email?: string | null) {
  const localPart = (email || '').trim().toLowerCase().split('@')[0] || '';
  const match = localPart.match(/^(\d{9})/);
  return match?.[1] || null;
}

type LegalSection = {
  title: string;
  body: string;
  bullets?: string[];
};

const termsSections: LegalSection[] = [
  {
    title: 'Who may use the portal',
    body:
      'The Clinic Management System is intended for Gordon College students, clinic staff, and authorized administrators handling school health records and related transactions.',
    bullets: [
      'Access is limited to users with a valid Gordon College account.',
      'Clinic workflows and records may only be handled by authorized personnel.',
    ],
  },
  {
    title: 'Account responsibility',
    body:
      'You are responsible for protecting your password and for all actions performed under your account.',
    bullets: [
      'Do not share credentials or allow another person to use your account.',
      'Report suspected account compromise or unauthorized access immediately.',
    ],
  },
  {
    title: 'Accurate submissions',
    body:
      'All information and uploaded files submitted through the portal must be truthful, complete, and reasonably current.',
    bullets: [
      'Use your real student details and current contact information.',
      'Do not upload altered, misleading, or unrelated medical documents.',
    ],
  },
  {
    title: 'Acceptable use',
    body:
      'The portal must not be used in a way that harms the system, other users, or Gordon College operations.',
    bullets: [
      "Malicious files, impersonation, and misuse of another person's records are prohibited.",
      'Users must follow applicable school policies, privacy rules, and law.',
    ],
  },
  {
    title: 'Clinic review',
    body:
      'Submitted records may be reviewed, returned for correction, or processed by authorized clinic personnel as part of health compliance and school record management.',
  },
  {
    title: 'Service changes',
    body:
      'Gordon College may update the portal, its workflows, and related rules when needed for operations, security, or compliance.',
  },
];

const privacySections: LegalSection[] = [
  {
    title: 'Overview',
    body:
      'This notice explains how personal data is handled in the Gordon College Clinic Management System. It reflects the Gordon College General Privacy Notice and applies to account registration, record submission, and clinic-related workflows in the portal.',
  },
  {
    title: 'Information we collect',
    body:
      'The portal may collect personal, academic, contact, and medical information needed to manage clinic transactions and student health requirements.',
    bullets: [
      'Identity details such as name, birth date, sex, civil status, and affiliations.',
      'Contact details such as address, email address, and mobile number.',
      'Academic details such as course, department, year level, and school-related standing.',
      'Medical details such as history, physical measurements, laboratory files, and clinic submissions.',
    ],
  },
  {
    title: 'Why we process your data',
    body:
      'Gordon College processes personal data to support its obligations as a higher education institution and to administer clinic-related services and compliance requirements.',
    bullets: [
      'To manage medical record submissions and clinic review workflows.',
      'To support school health requirements, documentation, and follow-up.',
      'To comply with academic, administrative, legal, and regulatory obligations.',
    ],
  },
  {
    title: 'How data is collected',
    body:
      'Personal data may be collected through online forms, uploaded files, email-based registration, and related supporting documents submitted through the portal or school processes.',
  },
  {
    title: 'Storage, transfer, and retention',
    body:
      'Records may be stored in physical or electronic systems managed or controlled by Gordon College. Data may be retained and transferred in accordance with school policy and applicable privacy rules.',
    bullets: [
      'Electronic records may be stored in secure cloud-based or institution-managed systems.',
      'Retention periods follow applicable Gordon College records management practices.',
    ],
  },
  {
    title: 'Your rights as a data subject',
    body:
      'Subject to school policy and applicable law, data subjects may exercise rights over their personal data.',
    bullets: [
      'Right to be informed.',
      'Right to access and request correction of personal data.',
      'Right to object where applicable.',
      'Right to erasure or blocking where legally permitted.',
    ],
  },
  {
    title: 'Data Privacy Office',
    body:
      'For privacy-related concerns, requests, or questions, you may contact Gordon College through its Data Privacy Office.',
    bullets: [
      `Email: ${CONTACT_EMAIL}`,
      'Phone: (047) 222-4080',
      'Address: Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City 2200',
    ],
  },
];

type LegalDialogProps = {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  meta: string[];
  sections: LegalSection[];
  footer?: string;
};

function LegalDialog({ label, eyebrow, title, description, meta, sections, footer }: LegalDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="font-semibold text-[#065f46] underline underline-offset-4 transition-colors hover:text-[#004532]"
        >
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="legal-dialog-native-scroll flex h-[100dvh] max-h-[100dvh] max-w-none flex-col overflow-y-auto rounded-none border-0 bg-[linear-gradient(180deg,#f8fbf8_0%,#f5f9ff_100%)] p-0 shadow-none sm:h-[92vh] sm:max-h-[92vh] sm:max-w-[95vw] sm:rounded-[2rem] sm:border sm:border-white/70 sm:shadow-[0_30px_90px_rgba(11,28,48,0.18)] xl:max-w-6xl [&_[data-dialog-close=default]]:hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[-8rem] top-[-7rem] h-64 w-64 rounded-full bg-[#d9f3e4]/70 blur-3xl" />
          <div className="absolute right-[-7rem] top-12 h-72 w-72 rounded-full bg-[#d9e8ff]/75 blur-3xl" />
        </div>

        <div className="sticky top-4 z-20 flex justify-end px-5 sm:top-6 sm:px-8">
          <DialogClose className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#0b1c30] shadow-[0_14px_32px_rgba(11,28,48,0.16)] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#065f46]/30 focus:ring-offset-2 focus:ring-offset-white">
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="relative flex flex-col">
          <div className="border-b border-emerald-950/10 bg-[linear-gradient(135deg,#f8fcf9_0%,#eef7f1_52%,#edf4ff_100%)]">
            <DialogHeader className="px-5 py-6 sm:px-8 sm:py-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c8ddd2] bg-white/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-[#065f46] shadow-[0_10px_30px_rgba(11,28,48,0.05)]">
                <Sparkles className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <DialogTitle className="text-3xl font-semibold tracking-[-0.05em] text-[#0b1c30] sm:text-[2.6rem]">
                    {title}
                  </DialogTitle>
                  <DialogDescription className="mt-4 max-w-2xl text-base leading-8 text-[#425468]">
                    {description}
                  </DialogDescription>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:w-[27rem] lg:grid-cols-1">
                  {meta.map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.35rem] border border-[#e6eeea] bg-white px-4 py-3 text-sm font-medium leading-6 text-[#0b1c30] shadow-[0_12px_26px_rgba(11,28,48,0.05)]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-8 sm:py-8">
            {sections.map((section, index) => (
              <section
                key={section.title}
                className="overflow-hidden rounded-[1.7rem] border border-[#e6eeea] bg-white shadow-[0_22px_60px_rgba(11,28,48,0.06)]"
              >
                <div className="h-1.5 bg-[linear-gradient(90deg,rgba(6,95,70,0.95)_0%,rgba(74,163,138,0.75)_45%,rgba(145,219,193,0.45)_100%)]" />
                <div className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d9f3e4] text-sm font-semibold text-[#065f46] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#0b1c30]">{section.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-[#425468]">{section.body}</p>
                      {section.bullets?.length ? (
                        <ul className="mt-5 space-y-3">
                          {section.bullets.map((bullet) => (
                            <li
                              key={bullet}
                              className="flex items-start gap-3 rounded-2xl border border-[#e4ece8] bg-[#fcfefd] px-4 py-3 text-sm leading-6 text-[#3f4944]"
                            >
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#4aa38a]" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            ))}

            {footer ? (
              <div className="rounded-[1.7rem] border border-[#bbe4d0] bg-[linear-gradient(135deg,#ecfaf2_0%,#f7fcff_100%)] p-5 shadow-[0_20px_45px_rgba(11,28,48,0.05)] sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#065f46] shadow-[0_10px_24px_rgba(11,28,48,0.08)]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#065f46]">Key acknowledgement</p>
                    <p className="mt-2 text-sm leading-7 text-emerald-950/85">{footer}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.35rem] border border-[#d5e7de] bg-[linear-gradient(135deg,#edf9f2_0%,#f7fcff_100%)] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#065f46] shadow-[0_10px_24px_rgba(11,28,48,0.08)]">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0b1c30]">Need help?</p>
                  <p className="mt-1 text-sm leading-6 text-[#425468]">
                    Contact the support team at <span className="font-semibold text-[#065f46]">{CONTACT_EMAIL}</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getHomePath(role: 'student' | 'staff' | 'admin') {
  if (role === 'staff') return '/staff';
  if (role === 'admin') return '/admin';
  return '/student';
}

export default function AuthAccessPage() {
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
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    verifiedFromEmail ? 'Email verified. You can now sign in with your account.' : null,
  );
  const [logoVisible, setLogoVisible] = useState(true);
  const [panelDirection, setPanelDirection] = useState<'left' | 'right'>('right');

  const [signInForm, setSignInForm] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [signUpForm, setSignUpForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [signUpAgreementAccepted, setSignUpAgreementAccepted] = useState(false);
  const [passwordSetupForm, setPasswordSetupForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [forgotPasswordDialogOpen, setForgotPasswordDialogOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);

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
    if (mode !== 'signin') return;
    prefetchLikelyPortalRoutes(signInForm.email);
  }, [mode, signInForm.email]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const fallbackRole = inferRoleFromEmail(signInForm.email);
    prefetchLikelyPortalRoutes(signInForm.email);

    try {
      const me = await signIn(signInForm.email, signInForm.password);
      const role = me.profile.role ?? fallbackRole;
      prefetchPortalExperience(role, me);
      navigate(fromPath || getHomePath(role), { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Invalid login credentials.');
    }
  }

  function handleGoogleAuth() {
    setError(null);
    setSuccessMessage(null);
    if (mode === 'signup' && !signUpAgreementAccepted) {
      setError('Please accept the Terms & Conditions and Privacy Policy before continuing.');
      return;
    }
    if (mode === 'signin') {
      prefetchLikelyPortalRoutes(signInForm.email);
    }
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

  function formatCooldown(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!signUpForm.firstName.trim()) {
      setError('Please enter your first name.');
      return;
    }
    if (!signUpForm.lastName.trim()) {
      setError('Please enter your last name.');
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
    if (!deriveStudentIdFromEmail(signUpForm.email)) {
      setError(`Use your 9-digit school ID email in the format yourschoolid@${GC_DOMAIN}.`);
      return;
    }
    if (signUpForm.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (signUpForm.password !== signUpForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!signUpAgreementAccepted) {
      setError('Please accept the Terms & Conditions and Privacy Policy before creating an account.');
      return;
    }

    try {
      prefetchLikelyPortalRoutes(signUpForm.email);
      const result = await signUp(
        signUpForm.firstName.trim(),
        signUpForm.lastName.trim(),
        signUpForm.email,
        signUpForm.password,
      );
      if (result.emailConfirmationRequired) {
        navigate(`/check-email?email=${encodeURIComponent(signUpForm.email)}`, { replace: true });
        return;
      }

      if (result.me) {
        prefetchPortalExperience(result.me.profile.role, result.me);
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
      navigate('/auth?mode=signin', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to set password.');
    }
  }

  const googleErrorMessage =
    googleError === 'invalid_domain'
      ? `Only @${GC_DOMAIN} Google accounts are allowed. Non-Gordon Google accounts are blocked and not registered in the system.`
      : googleError === 'invalid_token'
        ? 'Google sign-in failed. Please try again.'
        : googleError === 'account_load_failed'
          ? 'Google sign-in succeeded, but your account could not be loaded from the database. Please try again.'
        : null;

  const inputClassName =
    'h-12 w-full rounded-2xl border border-[#c8d6d1] bg-white/92 px-4 text-sm text-[#0b1c30] outline-none transition focus:border-[#065f46] focus:ring-4 focus:ring-[#065f46]/10';
  const iconInputClassName =
    'h-12 w-full rounded-2xl border border-[#c8d6d1] bg-white/92 pl-11 pr-4 text-sm text-[#0b1c30] outline-none transition focus:border-[#065f46] focus:ring-4 focus:ring-[#065f46]/10';
  const authPanelBodyClassName =
    `animate-in fade-in-0 duration-300 motion-reduce:animate-none ${
      panelDirection === 'right' ? 'slide-in-from-right-6' : 'slide-in-from-left-6'
    }`;
  const authTextTransitionClassName =
    `animate-in fade-in-0 duration-300 motion-reduce:animate-none ${
      panelDirection === 'right' ? 'slide-in-from-right-3' : 'slide-in-from-left-3'
    }`;
  const authModeLayoutClassName = `${authPanelBodyClassName} flex min-h-0 flex-col justify-between gap-5 pt-5 sm:min-h-[38rem] sm:pt-6`;
  const hasAcceptedPolicies = signUpAgreementAccepted;

  function switchMode(nextMode: 'signin' | 'signup') {
    if (nextMode === mode) return;

    setPanelDirection(nextMode === 'signup' ? 'right' : 'left');
    setMode(nextMode);
    setError(null);
    setSuccessMessage(null);
  }

  if (requiresPasswordSetup) {
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
                Complete your account setup
              </div>
              <h1 className="max-w-xl text-4xl font-bold tracking-[-0.04em] text-[#0b1c30] xl:text-5xl">
                Finish securing your ClinicKa! access.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-[#425468]">
                You signed in with Google successfully. Set a password so your Gordon College account can also use manual sign-in whenever needed.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[28px] border border-white/70 bg-white/72 p-5 shadow-[0_24px_60px_rgba(11,28,48,0.08)] backdrop-blur">
                  <Lock className="h-6 w-6 text-[#065f46]" />
                  <p className="mt-4 text-base font-semibold text-[#0b1c30]">Backup access</p>
                  <p className="mt-2 text-sm leading-6 text-[#425468]">
                    Keep both Google sign-in and email/password available for the same account.
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
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#0b1c30] sm:text-3xl">Set your password</h2>
              <p className="mt-2 text-sm leading-7 text-[#425468]">
                Choose a password with at least 6 characters to complete your account setup.
              </p>

              <form className="mt-8 space-y-5" onSubmit={handlePasswordSetup}>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                    New password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordSetupForm.password}
                    onChange={(event) =>
                      setPasswordSetupForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                    placeholder="At least 6 characters"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordSetupForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordSetupForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    placeholder="Re-enter password"
                    className={inputClassName}
                  />
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
                  {loading ? 'Saving password...' : 'Save password'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#f8f9ff_0%,#eff4ff_42%,#edf7f1_100%)] text-[#0b1c30]"
      style={{ fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif' }}
    >
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-8rem] top-24 h-80 w-80 rounded-full bg-[#d9e8ff] blur-3xl" />
        <div className="absolute right-[-10rem] top-12 h-[28rem] w-[28rem] rounded-full bg-[#d4f0e2] blur-3xl" />
      </div>

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
              <p className="text-lg font-bold tracking-[-0.03em] text-[#0b1c30]">ClinicKa!</p>
              <p className="text-xs uppercase tracking-[0.18em] text-[#60717e]">Gordon College Health Services</p>
            </div>
          </Link>

          <Link
            to="/"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[#cad8d5] bg-white/74 px-5 text-sm font-semibold text-[#0b1c30] transition hover:bg-white sm:w-auto"
          >
            Back to Homepage
          </Link>
        </div>

        <div className="flex flex-col-reverse gap-8 py-8 sm:gap-10 sm:py-10 lg:grid lg:flex-none lg:grid-cols-[1fr_0.96fr] lg:items-center">
          <div className="space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c8ddd2] bg-white/74 px-4 py-2 text-xs font-semibold text-[#065f46] shadow-[0_14px_36px_rgba(11,28,48,0.05)] sm:text-sm">
              <CheckCircle2 className="h-4 w-4" />
              School clinic portal access
            </div>

            <div className="space-y-4 sm:space-y-5">
              <h1 className="max-w-xl text-4xl font-bold tracking-[-0.05em] text-[#0b1c30] sm:text-5xl lg:text-6xl">
                Access your clinic workflow with clarity.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#4a5b68] sm:text-lg sm:leading-8">
                Sign in with your Gordon College account to submit records, complete forms, and keep track of your medical clearance progress in one secure place.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Students</p>
                <p className="mt-3 text-sm leading-7 text-[#4a5b68]">Submit requirements, track status, and manage records.</p>
              </div>
              <div className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Clinic Staff</p>
                <p className="mt-3 text-sm leading-7 text-[#4a5b68]">Review submissions and maintain the clinic workflow.</p>
              </div>
              <div className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Administrators</p>
                <p className="mt-3 text-sm leading-7 text-[#4a5b68]">Manage access, reports, and system oversight.</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/76 p-3 shadow-[0_30px_80px_rgba(11,28,48,0.1)] backdrop-blur sm:rounded-[2rem] sm:p-4">
              <img
                src={DASHBOARD_PREVIEW_SRC}
                alt="ClinicKa! student dashboard preview"
                className="h-full w-full rounded-[1.4rem] border border-[#d7e4ec] object-cover object-left-top"
              />
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/80 bg-white/84 p-4 shadow-[0_30px_80px_rgba(11,28,48,0.12)] backdrop-blur sm:min-h-[48.5rem] sm:rounded-[2rem] sm:p-8">
            <div className="flex flex-col gap-4 border-b border-[#dfebea] pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="sm:min-h-[7.5rem]">
                <div key={mode} className={authTextTransitionClassName}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Secure account access</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#0b1c30] sm:text-3xl">
                    {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[#4a5b68]">
                    {mode === 'signin'
                      ? 'Sign in to your Gordon College clinic account.'
                      : 'Use your Gordon College email to register and start your clinic workflow.'}
                  </p>
                </div>
              </div>

              <div className="relative grid w-full shrink-0 grid-cols-2 rounded-full border border-[#d7e4e0] bg-[#f5f8ff] p-1 sm:w-auto">
                <div
                  className="absolute bottom-1 left-1 top-1 rounded-full bg-[#004532] shadow-[0_10px_30px_rgba(0,69,50,0.24)] transition-transform duration-300 ease-out"
                  style={{
                    width: 'calc(50% - 4px)',
                    transform: mode === 'signin' ? 'translateX(0)' : 'translateX(100%)',
                  }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className={`relative z-10 flex-1 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors duration-300 sm:px-4 sm:text-sm ${mode === 'signin' ? 'text-white' : 'text-[#4a5b68] hover:text-[#0b1c30]'}`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`relative z-10 flex-1 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors duration-300 sm:px-4 sm:text-sm ${mode === 'signup' ? 'text-white' : 'text-[#4a5b68] hover:text-[#0b1c30]'}`}
                >
                  Sign up
                </button>
              </div>
            </div>

            {mode === 'signin' ? (
              <div key="signin" className={authModeLayoutClassName}>
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
                      className="font-semibold text-[#065f46] hover:text-[#004532] disabled:cursor-not-allowed disabled:opacity-70"
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
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#004532] text-sm font-semibold text-white transition hover:bg-[#065f46] disabled:opacity-70"
                  >
                    {loading ? 'Signing in...' : 'Sign in'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-xs leading-5 text-[#60717e]">
                    By clicking the login button, you recognize the authority of Gordon College Clinic to process your
                    personal and sensitive information, pursuant to the Gordon College General Privacy Notice and
                    applicable laws.
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
                        className={inputClassName}
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
                          className="rounded-full border border-[#c8d6d1] px-4 py-2 text-sm font-semibold text-[#4a5b68] transition hover:bg-[#f7fbff] disabled:opacity-70"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={sendingResetEmail || resetCooldown > 0}
                          className="rounded-full bg-[#004532] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#065f46] disabled:opacity-70"
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

                <div className="space-y-5">
                  <div className="relative py-1">
                    <div className="h-px bg-[#dbe5e4]" />
                    <span className="absolute inset-x-0 -top-2 mx-auto w-fit bg-white px-3 text-xs text-[#60717e]">
                      Or continue with
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#c9d9dd] bg-white text-sm font-semibold text-[#0b1c30] transition hover:bg-[#f7fbff]"
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
                    Need a new account?{' '}
                    <button
                      type="button"
                      className="font-semibold text-[#065f46]"
                      onClick={() => switchMode('signup')}
                    >
                      Create one here
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              <div key="signup" className={authModeLayoutClassName}>
                <form className="space-y-4" onSubmit={handleSignUp}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                        First name
                      </label>
                      <input
                        required
                        value={signUpForm.firstName}
                        onChange={(event) =>
                          setSignUpForm((prev) => ({ ...prev, firstName: event.target.value }))
                        }
                        placeholder="First name"
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                        Last name
                      </label>
                      <input
                        required
                        value={signUpForm.lastName}
                        onChange={(event) =>
                          setSignUpForm((prev) => ({ ...prev, lastName: event.target.value }))
                        }
                        placeholder="Last name"
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                      Gordon College email
                    </label>
                    <input
                      type="email"
                      required
                      value={signUpForm.email}
                      onChange={(event) =>
                        setSignUpForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder={`yourschoolid@${GC_DOMAIN}`}
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#70808b]" />
                      <input
                        type={showSignUpPassword ? 'text' : 'password'}
                        required
                        value={signUpForm.password}
                        onChange={(event) =>
                          setSignUpForm((prev) => ({ ...prev, password: event.target.value }))
                        }
                        placeholder="At least 6 characters"
                        className={`${iconInputClassName} pr-12`}
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#70808b]"
                        onClick={() => setShowSignUpPassword((prev) => !prev)}
                        aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                      >
                        {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#425468]">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#70808b]" />
                      <input
                        type={showSignUpConfirmPassword ? 'text' : 'password'}
                        required
                        value={signUpForm.confirmPassword}
                        onChange={(event) =>
                          setSignUpForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                        }
                        placeholder="Re-enter password"
                        className={`${iconInputClassName} pr-12`}
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#70808b]"
                        onClick={() => setShowSignUpConfirmPassword((prev) => !prev)}
                        aria-label={showSignUpConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showSignUpConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-[#d7e4df] bg-[#f4faf7] p-3.5">
                    <input
                      id="signupPolicyAgreement"
                      type="checkbox"
                      checked={signUpAgreementAccepted}
                      onChange={(event) => setSignUpAgreementAccepted(event.target.checked)}
                      aria-labelledby="signupPolicyAgreementLabel"
                      className="mt-1 h-5 w-5 flex-shrink-0 cursor-pointer rounded border border-[#9fb2aa] bg-white accent-[#0a7a43]"
                    />
                    <div id="signupPolicyAgreementLabel" className="text-sm leading-6 text-[#4a5b68]">
                      I agree to the{' '}
                      <LegalDialog
                        label="terms & conditions"
                        eyebrow="Portal Terms"
                        title="Terms & Conditions"
                        description="These terms govern access to the Gordon College Clinic Management System and the submission of records through the portal."
                        meta={[
                          'Applies to student and clinic portal use',
                          `Last updated ${POLICY_UPDATED_AT}`,
                          'Covers account use, submissions, and access',
                        ]}
                        sections={termsSections}
                        footer="By creating an account, you acknowledge that records submitted through the portal may be reviewed and managed by authorized Gordon College personnel as part of official clinic operations."
                      />{' '}
                      and{' '}
                      <LegalDialog
                        label="privacy policy"
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
                    </div>
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
                    disabled={loading || !hasAcceptedPolicies}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#004532] text-sm font-semibold text-white transition hover:bg-[#065f46] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? 'Creating account...' : 'Create account'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="space-y-5">
                  <div className="relative py-1">
                    <div className="h-px bg-[#dbe5e4]" />
                    <span className="absolute inset-x-0 -top-2 mx-auto w-fit bg-white px-3 text-xs text-[#60717e]">
                      Or continue with
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={!hasAcceptedPolicies}
                    className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#c9d9dd] bg-white text-sm font-semibold text-[#0b1c30] transition hover:bg-[#f7fbff] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </button>

                  <p className="text-center text-sm text-[#4a5b68]">
                    Already registered?{' '}
                    <button
                      type="button"
                      className="font-semibold text-[#065f46]"
                      onClick={() => switchMode('signin')}
                    >
                      Sign in instead
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
