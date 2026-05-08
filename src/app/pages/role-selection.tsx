import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  ClipboardList,
  FileText,
  FolderOpen,
  Menu,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const LOGO_SRC = '/logo.png';
const LANDING_PREVIEW_SRC = '/clinickalogo.png';
const FORM_PREVIEW_SRC = new URL('../../../exports/figma/05-student-medical-form.png', import.meta.url).href;
const CAMPUS_PREVIEW_SRC = '/backdrop.jpg';

const navLinks = [
  { label: 'Records', target: 'features' },
  { label: 'Health Forms', target: 'workflow' },
  { label: 'Clearance', target: 'clearance' },
  { label: 'Resources', target: 'resources' },
];

const workflowHighlights = [
  {
    title: 'Instant submissions',
    description: 'Upload records and complete medical histories without chasing physical forms.',
  },
  {
    title: 'Real-time tracking',
    description: 'See clearance status updates right from your portal dashboard.',
  },
  {
    title: 'Direct clinic feedback',
    description: 'Get secure messages from clinic staff if anything needs review.',
  },
];

export default function RoleSelection() {
  const navigate = useNavigate();
  const { requiresPasswordSetup } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [logoVisible, setLogoVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (requiresPasswordSetup) {
      navigate('/auth?mode=signin', { replace: true });
    }
  }, [requiresPasswordSetup, navigate]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNavClick = (sectionId: string) => {
    scrollToSection(sectionId);
    setIsMenuOpen(false);
  };

  return (
    <div
      className="relative min-h-screen bg-[linear-gradient(180deg,#f8f9ff_0%,#eff4ff_42%,#edf7f1_100%)] text-[#0b1c30]"
      style={{ fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif' }}
    >
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-8rem] top-20 h-80 w-80 rounded-full bg-[#d9e8ff] blur-3xl" />
        <div className="absolute right-[-10rem] top-12 h-[28rem] w-[28rem] rounded-full bg-[#d4f0e2] blur-3xl" />
      </div>

      <nav
        className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
          isScrolled
            ? 'border-[#d8e6ea] bg-white/90 shadow-[0_4px_20px_-4px_rgba(6,95,70,0.08)] backdrop-blur-xl'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-20 w-full max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-10">
          <button
            type="button"
            onClick={() => scrollToSection('hero')}
            className="flex items-center gap-3 text-left"
          >
            {logoVisible ? (
              <img
                src={LOGO_SRC}
                alt="ClinicKa logo"
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
          </button>

          <div className="hidden items-center gap-8 text-sm font-medium text-[#5b6670] md:flex">
            {navLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => handleNavClick(link.target)}
                className="transition hover:text-[#065f46]"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth?mode=signin"
              className="hidden md:inline-flex h-11 items-center justify-center rounded-full bg-[#004532] px-5 text-sm font-semibold text-white transition hover:bg-[#065f46]"
            >
              Sign In
            </Link>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d8e6ea] bg-white/85 text-[#004532] shadow-sm transition hover:bg-white"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-dropbar"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <div
          id="mobile-dropbar"
          className={`md:hidden overflow-hidden border-b border-[#d8e6ea] bg-white/95 shadow-[0_16px_40px_rgba(6,95,70,0.08)] backdrop-blur-xl transition-[max-height,opacity,transform] duration-300 ease-out ${
            isMenuOpen
              ? 'max-h-[360px] opacity-100 translate-y-0 pointer-events-auto'
              : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-4 py-6">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => handleNavClick(link.target)}
                  className="rounded-2xl border border-[#e0e8e7] bg-white/80 px-4 py-3 text-left text-base font-semibold text-[#0b1c30] shadow-sm transition hover:bg-white"
                >
                  {link.label}
                </button>
              ))}
              <Link
                to="/auth?mode=signin"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#004532] px-5 text-sm font-semibold text-white transition hover:bg-[#065f46]"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <section
          id="hero"
          className="relative overflow-hidden"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(111, 121, 115, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(111, 121, 115, 0.05) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        >
          <div className="absolute right-0 top-0 h-[34rem] w-[34rem] translate-x-1/4 -translate-y-1/4 rounded-full bg-[#cfeee0]/55 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-[28rem] w-[28rem] -translate-x-1/4 translate-y-1/4 rounded-full bg-[#d8e6ff]/55 blur-3xl" />

          <div className="relative mx-auto grid w-full max-w-[90rem] gap-10 px-5 pb-16 pt-28 sm:px-8 md:gap-12 md:pb-20 md:pt-36 lg:grid-cols-12 lg:items-center lg:px-10 lg:pb-24 lg:pt-44">
            <div className="space-y-6 md:space-y-8 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c9d9dd] bg-white/78 px-4 py-2 text-sm font-semibold text-[#065f46] shadow-[0_10px_35px_rgba(11,28,48,0.05)] backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[#065f46]" />
                Secure scholarly clinic management
              </div>

              <div className="space-y-5">
                <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] tracking-[-0.04em] text-[#0b1c30] md:text-5xl lg:text-6xl xl:text-[4.2rem]">
                  Your Academic Health Journey, <span className="text-[#065f46]">Streamlined.</span>
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[#4a5b68] md:text-lg md:leading-8">
                  ClinicKa! brings Gordon College clinic services into a calmer, clearer digital workflow. Submit medical
                  records, complete health forms, and track clearance progress without the paperwork pileup.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/auth?mode=signin"
                  className="inline-flex h-14 items-center justify-center rounded-full bg-[#004532] px-8 text-sm font-semibold text-white transition hover:bg-[#065f46]"
                >
                  Student Login
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection('workflow')}
                  className="inline-flex h-14 items-center justify-center rounded-full border border-[#6d8b81] bg-white/72 px-8 text-sm font-semibold text-[#0b1c30] transition hover:bg-white"
                >
                  View Clearance Requirements
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-white/80 bg-white/74 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Submission flow</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#0b1c30]">Digital-first</p>
                  <p className="mt-2 text-sm leading-6 text-[#4a5b68]">
                    From intake to approval, every step stays visible.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/74 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Access model</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#0b1c30]">Role-based</p>
                  <p className="mt-2 text-sm leading-6 text-[#4a5b68]">
                    Students, clinic staff, and admins get the right tools.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/74 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Privacy posture</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#0b1c30]">Protected</p>
                  <p className="mt-2 text-sm leading-6 text-[#4a5b68]">
                    Records stay within controlled clinic workflows.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative lg:col-span-5 lg:pl-2">
              <div className="flex items-center justify-center">
                <img
                  src={LANDING_PREVIEW_SRC}
                  alt="ClinicKa logo"
                  className="w-full max-w-[520px] object-contain drop-shadow-[0_18px_45px_rgba(11,28,48,0.12)]"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-16 md:py-20">
          <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-10">
            <div className="mx-auto mb-10 max-w-3xl text-center md:mb-12">
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#0b1c30] md:text-4xl">Comprehensive care ecosystem</h2>
              <p className="mt-3 text-base leading-7 text-[#4a5b68] md:mt-4 md:text-lg">
                Four pillars designed to simplify clinic operations and empower student wellness.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-[28px] border border-white/80 bg-white/78 p-8 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur lg:col-span-2">
                <div className="flex items-start gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f5ed] text-[#065f46]">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[#0b1c30]">User management</h3>
                    <p className="mt-3 text-sm leading-7 text-[#4a5b68]">
                      Secure, role-based accounts ensure that students and clinic staff see only what they need.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col justify-between rounded-[28px] bg-[#004532] p-8 text-white shadow-[0_18px_45px_rgba(11,28,48,0.12)]">
                <div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">Medical clearance</h3>
                  <p className="mt-3 text-sm leading-7 text-white/85">
                    Automated workflows for reviewing and approving health requirements before enrollment.
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/80 bg-white/78 p-8 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d9f3e4] text-[#065f46]">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-[#0b1c30]">Health forms</h3>
                <p className="mt-3 text-sm leading-7 text-[#4a5b68]">
                  Digital intake forms replace paper packets and capture accurate medical histories online.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/80 bg-white/78 p-8 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur lg:col-span-2">
                <div className="flex flex-col gap-8 md:flex-row">
                  <div className="flex-1">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f5ed] text-[#065f46]">
                      <FolderOpen className="h-6 w-6" />
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-[#0b1c30]">Record management</h3>
                    <p className="mt-3 text-sm leading-7 text-[#4a5b68]">
                      Centralized record storage for quick retrieval, updates, and long-term compliance.
                    </p>
                  </div>
                  <div className="hidden flex-1 rounded-2xl border border-[#dde7e6] bg-white/70 p-4 md:block">
                    <div className="h-4 w-2/3 rounded bg-[#e6edf5]" />
                    <div className="mt-3 h-4 w-1/2 rounded bg-[#e6edf5]" />
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center gap-3 rounded-xl border border-[#e0e8e7] bg-white px-3 py-2">
                        <div className="h-7 w-7 rounded bg-[#d9f3e4]" />
                        <div className="h-2 w-1/3 rounded bg-[#dfe7ee]" />
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-[#e0e8e7] bg-white px-3 py-2">
                        <div className="h-7 w-7 rounded bg-[#d9f3e4]" />
                        <div className="h-2 w-1/2 rounded bg-[#dfe7ee]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-t border-[#e2ebe7] bg-white/70 py-16 md:py-20">
          <div className="mx-auto grid max-w-[90rem] items-center gap-10 px-5 sm:px-8 md:gap-16 lg:grid-cols-2 lg:px-10">
            <div className="order-2 lg:order-1">
              <div className="relative">
                <div className="absolute inset-0 -translate-x-6 translate-y-6 rounded-full bg-[#cfeee0]/35 blur-3xl" />
                <img
                  src={FORM_PREVIEW_SRC}
                  alt="Student medical form workflow preview"
                  className="relative z-10 w-full rounded-2xl border border-white/80 shadow-[0_24px_60px_rgba(11,28,48,0.12)]"
                />
              </div>
            </div>

            <div className="order-1 space-y-5 lg:order-2 md:space-y-6">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#0b1c30] md:text-4xl">
                Goodbye paperwork.<br />Hello clarity.
              </h2>
              <p className="max-w-xl text-base leading-7 text-[#4a5b68] md:text-lg md:leading-8">
                Health requirements should not feel like guesswork. ClinicKa! turns the paper-heavy routine into a guided
                digital process that is easier to finish and easier to review.
              </p>
              <div className="space-y-6 pt-2">
                {workflowHighlights.map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#d9f3e4] text-[#065f46]">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-[#0b1c30]">{item.title}</h4>
                      <p className="mt-2 text-sm leading-7 text-[#4a5b68]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="clearance" className="py-16">
          <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-10">
            <div className="flex flex-col items-start gap-6 rounded-[2rem] border border-[#dfe9e6] bg-white/80 p-6 shadow-[0_20px_60px_rgba(11,28,48,0.08)] md:flex-row md:items-center md:justify-between md:p-8">
              <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-5">
                <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-[#e8f5ed] text-[#065f46] shrink-0">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.03em] text-[#0b1c30]">Uncompromising security</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[#4a5b68]">
                    Student health records are sensitive. ClinicKa! uses controlled access, school-managed workflows,
                    and privacy-aware handling to protect data with care.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#d9f3e4] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#065f46]">
                Privacy-first
              </span>
            </div>
          </div>
        </section>

        <section className="border-t border-[#e2ebe7] bg-white/60 py-16 md:py-20">
          <div className="mx-auto grid max-w-[90rem] items-center gap-10 px-5 sm:px-8 md:gap-12 lg:grid-cols-2 lg:px-10">
            <div className="space-y-4 md:space-y-5">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#0b1c30] md:text-4xl">Your records, always within reach.</h2>
              <p className="text-base leading-7 text-[#4a5b68] md:text-lg md:leading-8">
                ClinicKa! keeps medical forms, submissions, and approvals in one place so students and clinic teams can
                work with confidence.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-[#4a5b68]">
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">Role-based access</span>
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">Clear audit trails</span>
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">Secure storage</span>
              </div>
            </div>
            <div className="relative">
              <img
                src={CAMPUS_PREVIEW_SRC}
                alt="Gordon College campus"
                className="w-full rounded-2xl border border-white/80 object-cover shadow-[0_24px_60px_rgba(11,28,48,0.12)]"
              />
              <div className="absolute -bottom-6 left-6 rounded-[1.5rem] border border-white/80 bg-white/90 px-4 py-3 text-sm text-[#4a5b68] shadow-[0_18px_40px_rgba(11,28,48,0.12)]">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-[#065f46]" />
                  <span>Unified medical submission dashboard</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer id="resources" className="border-t border-[#e2ebe7] bg-white/70 py-12">
        <div className="mx-auto grid max-w-[90rem] grid-cols-1 gap-8 px-5 sm:px-8 md:grid-cols-2 md:items-center lg:px-10">
          <div>
            <div className="text-lg font-bold text-[#0b1c30]">ClinicKa!</div>
            <p className="mt-2 text-sm text-[#4a5b68]">Gordon College Health Services</p>
            <p className="mt-4 text-sm text-[#60717e]">Copyright 2026 ClinicKa. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-[#60717e] md:justify-end">
            <Link className="transition hover:text-[#065f46]" to="/auth?mode=signup">
              Privacy policy
            </Link>
            <Link className="transition hover:text-[#065f46]" to="/auth?mode=signup">
              Terms of service
            </Link>
            <Link className="transition hover:text-[#065f46]" to="/auth?mode=signin">
              Help desk
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
