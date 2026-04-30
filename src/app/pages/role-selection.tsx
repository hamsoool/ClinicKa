import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileHeart,
  FolderKanban,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

const AUTH_LOGO_SRC = '/logo.png';
const HERO_BACKDROP_SRC = '/backdrop.jpg';
const DASHBOARD_PREVIEW_SRC = new URL('../../../exports/figma/02-student-dashboard.png', import.meta.url).href;
const MEDICAL_FORM_PREVIEW_SRC = new URL('../../../exports/figma/05-student-medical-form.png', import.meta.url).href;

const featureCards = [
  {
    title: 'User Management',
    description:
      'Secure, role-based access keeps student, staff, and administrator workflows separated while maintaining a shared source of truth.',
    icon: UsersRound,
    className: 'lg:col-span-2',
    iconWrapClassName: 'bg-[#dfeafd] text-[#004532]',
    panelClassName: 'bg-white/76',
  },
  {
    title: 'Medical Clearance',
    description:
      'Track health compliance from submission to approval with a workflow that makes status updates and staff review easier to follow.',
    icon: ShieldCheck,
    className: '',
    iconWrapClassName: 'bg-white/18 text-white',
    panelClassName: 'bg-[#004532] text-white',
  },
  {
    title: 'Health Forms',
    description:
      'Digital intake forms replace paper packets, helping students submit accurate records from any device with less friction.',
    icon: FileHeart,
    className: '',
    iconWrapClassName: 'bg-[#d9f3e4] text-[#065f46]',
    panelClassName: 'bg-white/76',
  },
  {
    title: 'Record Management',
    description:
      'A centralized record system gives the clinic reliable access to submissions, health details, and supporting files when they matter.',
    icon: FolderKanban,
    className: 'lg:col-span-2',
    iconWrapClassName: 'bg-[#dfeafd] text-[#004532]',
    panelClassName: 'bg-[linear-gradient(135deg,rgba(255,255,255,0.78)_0%,rgba(239,244,255,0.94)_100%)]',
  },
];

export default function RoleSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const [logoVisible, setLogoVisible] = useState(true);

  function scrollToSection(id: string) {
    const section = document.getElementById(id);
    if (!section) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const navOffset = window.innerWidth >= 640 ? 104 : 92;
    const top = section.getBoundingClientRect().top + window.scrollY - navOffset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }

  function openAuth(mode: 'signin' | 'signup') {
    navigate(`/auth?mode=${mode}`, { state: location.state });
  }

  return (
    <div
      className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]"
      style={{ fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif' }}
    >
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#d8e6ea] bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <button
            type="button"
            onClick={() => scrollToSection('hero')}
            className="flex items-center gap-3 text-left"
          >
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
          </button>

          <div className="hidden items-center gap-8 text-sm font-medium text-[#5b6670] md:flex">
            <button type="button" onClick={() => scrollToSection('features')} className="transition hover:text-[#065f46]">
              Records
            </button>
            <button type="button" onClick={() => scrollToSection('workflow')} className="transition hover:text-[#065f46]">
              Health Forms
            </button>
            <button type="button" onClick={() => scrollToSection('security')} className="transition hover:text-[#065f46]">
              Clearance
            </button>
            <button type="button" onClick={() => scrollToSection('access')} className="transition hover:text-[#065f46]">
              Resources
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#004532] px-5 text-sm font-semibold text-white transition hover:bg-[#065f46]"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      <main className="overflow-hidden pt-20">
        <section
          id="hero"
          className="relative isolate min-h-[900px] scroll-mt-24 border-b border-[#e0e9f4] bg-[#f8f9ff] sm:scroll-mt-28"
        >
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(111,121,115,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(111,121,115,0.06) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="absolute right-[-16rem] top-[-16rem] h-[44rem] w-[44rem] rounded-full bg-[#cfeee0]/65 blur-3xl" />
          <div className="absolute bottom-[-15rem] left-[-10rem] h-[32rem] w-[32rem] rounded-full bg-[#d9e8ff]/90 blur-3xl" />

          <div className="relative mx-auto grid w-full max-w-7xl gap-14 px-5 py-20 sm:px-8 lg:grid-cols-12 lg:items-center lg:py-24">
            <div className="space-y-8 lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c9d9dd] bg-white/78 px-4 py-2 text-sm font-semibold text-[#065f46] shadow-[0_10px_35px_rgba(11,28,48,0.05)] backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[#065f46]" />
                Secure scholarly clinic management
              </div>

              <div className="space-y-5">
                <h1 className="max-w-xl text-5xl font-bold leading-[1.05] tracking-[-0.05em] text-[#0b1c30] sm:text-6xl">
                  Your Academic Health Journey, <span className="text-[#065f46]">Streamlined.</span>
                </h1>
                <p className="max-w-xl text-lg leading-8 text-[#4a5b68]">
                  ClinicKa! brings Gordon College clinic services into a calmer, clearer digital workflow. Submit medical records, complete health forms, and track clearance progress without the paperwork pileup.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => openAuth('signin')}
                  className="inline-flex h-14 items-center justify-center rounded-full bg-[#004532] px-8 text-sm font-semibold text-white transition hover:bg-[#065f46]"
                >
                  Student Login
                </button>
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
                  <p className="mt-2 text-sm leading-6 text-[#4a5b68]">From intake to approval, every step stays visible.</p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/74 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Access model</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#0b1c30]">Role-based</p>
                  <p className="mt-2 text-sm leading-6 text-[#4a5b68]">Students, clinic staff, and admins each get the right tools.</p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/74 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Privacy posture</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#0b1c30]">Protected</p>
                  <p className="mt-2 text-sm leading-6 text-[#4a5b68]">Records stay within controlled clinic workflows.</p>
                </div>
              </div>
            </div>

            <div className="relative lg:col-span-6">
              <div className="absolute inset-x-8 top-6 h-[78%] rounded-[2rem] bg-[linear-gradient(135deg,rgba(217,243,228,0.86)_0%,rgba(237,244,255,0.92)_100%)] blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/78 p-4 shadow-[0_30px_80px_rgba(11,28,48,0.14)] backdrop-blur md:p-5">
                <div className="mb-4 flex items-center justify-between rounded-[1.5rem] border border-[#d9e5e3] bg-white/86 px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Student portal preview</p>
                    <p className="mt-1 text-sm font-semibold text-[#0b1c30]">Unified medical submission dashboard</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-[#e2f5ea] px-3 py-1 text-xs font-semibold text-[#065f46]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Live workflow
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.6rem] border border-[#d8e3ea] bg-[#eef4ff]">
                  <div className="relative h-[420px] overflow-hidden bg-[#eef4ff]">
                    <img
                      src={DASHBOARD_PREVIEW_SRC}
                      alt="ClinicKa! student dashboard preview"
                      className="h-full w-full object-cover object-left-top"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0)_22%,rgba(248,249,255,0.14)_100%)]" />
                  </div>
                </div>

                <div className="pointer-events-none absolute -bottom-7 left-4 max-w-[19rem] rounded-[1.5rem] border border-white/85 bg-white/88 p-4 shadow-[0_24px_60px_rgba(11,28,48,0.12)] backdrop-blur sm:-left-8 sm:max-w-[18rem]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d9f3e4] text-[#065f46]">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0b1c30]">Clearance status</p>
                      <p className="mt-1 text-sm leading-6 text-[#4a5b68]">Approved requirements and visible progress for the current school cycle.</p>
                    </div>
                  </div>
                </div>

                <div className="pointer-events-none absolute -right-4 top-5 hidden w-40 overflow-hidden rounded-[1.4rem] border border-white/75 bg-white/70 p-2 shadow-[0_22px_60px_rgba(11,28,48,0.12)] backdrop-blur sm:block">
                  <img
                    src={HERO_BACKDROP_SRC}
                    alt="Gordon College campus"
                    className="h-28 w-full rounded-[1rem] object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="relative z-10 scroll-mt-24 bg-[#f8f9ff] py-24 sm:scroll-mt-28">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="text-4xl font-semibold tracking-[-0.04em] text-[#0b1c30]">Comprehensive Care Ecosystem</h2>
              <p className="mt-4 text-lg leading-8 text-[#4a5b68]">
                Four connected pillars that simplify clinic operations while making student wellness requirements easier to complete.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featureCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.title}
                    className={`rounded-[1.75rem] border border-white/75 p-8 shadow-[0_22px_60px_rgba(11,28,48,0.06)] backdrop-blur ${card.className} ${card.panelClassName}`}
                  >
                    <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full ${card.iconWrapClassName}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className={`text-2xl font-semibold tracking-[-0.03em] ${card.title === 'Medical Clearance' ? 'text-white' : 'text-[#0b1c30]'}`}>
                      {card.title}
                    </h3>
                    <p className={`mt-4 max-w-xl text-sm leading-7 ${card.title === 'Medical Clearance' ? 'text-white/84' : 'text-[#4a5b68]'}`}>
                      {card.description}
                    </p>

                    {card.title === 'Record Management' ? (
                      <div className="mt-8 grid gap-3 rounded-[1.35rem] border border-[#d5e0f2] bg-white/72 p-4 sm:grid-cols-[1.3fr_1fr]">
                        <div className="space-y-3">
                          <div className="h-3 w-3/4 rounded-full bg-[#d3e4fe]" />
                          <div className="h-3 w-1/2 rounded-full bg-[#d3e4fe]" />
                          <div className="space-y-2 pt-2">
                            <div className="flex items-center gap-3 rounded-2xl border border-[#e1e7f0] bg-white p-3">
                              <div className="h-8 w-8 rounded-xl bg-[#d9f3e4]" />
                              <div className="h-2 w-1/2 rounded-full bg-[#d3e4fe]" />
                            </div>
                            <div className="flex items-center gap-3 rounded-2xl border border-[#e1e7f0] bg-white p-3">
                              <div className="h-8 w-8 rounded-xl bg-[#d9f3e4]" />
                              <div className="h-2 w-2/3 rounded-full bg-[#d3e4fe]" />
                            </div>
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-[1.15rem] border border-[#d8e3ea] bg-[#eef4ff]">
                          <img
                            src={MEDICAL_FORM_PREVIEW_SRC}
                            alt="Medical form preview"
                            className="h-full w-full object-cover object-left-top"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-24 border-y border-[#e3ebf1] bg-white/55 py-24 sm:scroll-mt-28">
          <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(210,240,229,0.88)_0%,rgba(220,233,255,0.82)_100%)] blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-[0_28px_70px_rgba(11,28,48,0.08)] backdrop-blur">
                <div className="overflow-hidden rounded-[1.6rem] border border-[#d8e3ea] bg-[#eef4ff]">
                  <img
                    src={MEDICAL_FORM_PREVIEW_SRC}
                    alt="Student medical form workflow preview"
                    className="h-full w-full object-cover object-left-top"
                  />
                </div>
              </div>
            </div>

            <div className="order-1 space-y-6 lg:order-2">
              <h2 className="text-4xl font-semibold tracking-[-0.04em] text-[#0b1c30]">
                Goodbye Paperwork.
                <br />
                Hello Clarity.
              </h2>
              <p className="max-w-xl text-lg leading-8 text-[#4a5b68]">
                Health requirements should not feel like guesswork. ClinicKa! transforms the old paper-heavy routine into a guided digital process that is easier for students to finish and easier for clinic staff to review.
              </p>

              <div className="space-y-6 pt-2">
                {[
                  {
                    title: 'Instant submissions',
                    body: 'Upload records and complete medical histories from your device instead of relying on physical handoffs.',
                  },
                  {
                    title: 'Real-time tracking',
                    body: 'See whether a record is pending, returned, or approved from the same portal you used to submit it.',
                  },
                  {
                    title: 'Direct clinic follow-through',
                    body: 'Staff can review records, request updates, and keep the workflow moving without fragmented communication.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d9f3e4] text-[#065f46]">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#0b1c30]">{item.title}</h3>
                      <p className="mt-1 text-sm leading-7 text-[#4a5b68]">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="access" className="relative scroll-mt-24 bg-[#f8f9ff] py-24 sm:scroll-mt-28">
          <div className="absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(211,228,254,0.45)_0%,rgba(248,249,255,0)_100%)]" />
          <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c8ddd2] bg-white/80 px-4 py-2 text-sm font-semibold text-[#065f46] shadow-[0_14px_36px_rgba(11,28,48,0.05)]">
                <FileCheck2 className="h-4 w-4" />
                Portal access
              </div>
              <h2 className="max-w-lg text-4xl font-semibold tracking-[-0.04em] text-[#0b1c30]">
                One entry point for every clinic workflow.
              </h2>
              <p className="max-w-xl text-lg leading-8 text-[#4a5b68]">
                Sign in with your Gordon College account to submit records, review requirements, or manage clinic operations. Student, staff, and admin access all begin in the dedicated account page.
              </p>

              <div className="grid gap-4">
                {[
                  'Students can submit records, complete forms, and monitor clearance progress in one place.',
                  'Clinic staff can review submissions, validate requirements, and keep records current.',
                  'Administrators can oversee staff access, reporting, and system-wide account management.',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-[1.6rem] border border-white/80 bg-white/78 p-5 shadow-[0_20px_50px_rgba(11,28,48,0.06)] backdrop-blur"
                  >
                    <p className="text-sm leading-7 text-[#4a5b68]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/80 bg-white/82 p-6 shadow-[0_30px_80px_rgba(11,28,48,0.1)] backdrop-blur sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Dedicated access page</p>
              <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#0b1c30]">Login and sign-up now live separately.</h3>
              <p className="mt-4 text-sm leading-7 text-[#4a5b68]">
                We moved account access into its own route so the landing page stays focused on the product story while authentication gets its own cleaner flow.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => openAuth('signin')}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#004532] px-6 text-sm font-semibold text-white transition hover:bg-[#065f46]"
                >
                  Go to sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('signup')}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[#cad8d5] bg-white px-6 text-sm font-semibold text-[#0b1c30] transition hover:bg-[#f7fbff]"
                >
                  Create account
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="scroll-mt-24 bg-[#dbe8ff] py-16 sm:scroll-mt-28">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col gap-6 rounded-[1.75rem] border border-white/78 bg-white/88 p-6 shadow-[0_24px_60px_rgba(11,28,48,0.08)] backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:p-8">
              <div className="flex items-start gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#065f46]">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#0b1c30]">Uncompromising security</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[#4a5b68]">
                    Student health records are sensitive. ClinicKa! uses controlled account access, school-managed workflows, and privacy-aware handling to support the Gordon College clinic team and protect student data with care.
                  </p>
                </div>
              </div>

              <div className="inline-flex h-fit items-center rounded-full bg-[#d9f3e4] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#065f46]">
                Privacy-first
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
