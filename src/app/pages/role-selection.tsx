import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
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
const FORM_PREVIEW_SRC = '/previews/student-medical-form-preview.png';
const CAMPUS_PREVIEW_SRC = '/backdrop.jpg';

const navLinks = [
  { label: 'Services', target: 'features' },
  { label: 'Submissions', target: 'workflow' },
  { label: 'Records', target: 'clearance' },
  { label: 'FAQ', target: 'faq' },
];

const workflowHighlights = [
  {
    title: 'Guided student submissions',
    description:
      'Complete the yearly medical form, privacy waiver, health history, and required file uploads in one portal.',
  },
  {
    title: 'Clear status tracking',
    description:
      'Follow records as they move through pending, in review, returned, resubmitted, physical exam done, and approved states.',
  },
  {
    title: 'Clinic review workflow',
    description:
      'Clinic staff can verify submissions, save review notes, return records for correction, and prepare approved clearances.',
  },
];

const studentFaqs = [
  {
    value: 'faq-get-started',
    question: 'How do I start my yearly medical submission in ClinicKa!?',
    answer:
      'Sign in to the portal, choose your school year, complete the privacy waiver, then fill out the medical form and upload the required files before submitting.',
  },
  {
    value: 'faq-requirements',
    question: 'What should I prepare before I fill out the form?',
    answer:
      'Have your updated student details ready along with the clinic requirements for your intake, such as your signed waiver, medical history information, and any requested lab results or supporting documents.',
  },
  {
    value: 'faq-statuses',
    question: 'What do the submission statuses mean?',
    answer:
      'Pending means your submission was received, in review means clinic staff are checking it, returned means corrections are needed, resubmitted means you sent an updated version, physical exam done means your exam was recorded, and approved means your record is cleared for the current workflow.',
  },
  {
    value: 'faq-returned',
    question: 'What should I do if my record is returned for correction?',
    answer:
      'Open your submission, review the clinic notes, update the answers or files they flagged, and resubmit through the same portal so the staff can continue the review without starting over.',
  },
  {
    value: 'faq-clearance',
    question: 'When can I view my medical clearance or certificate?',
    answer:
      'Once the clinic finishes reviewing your submission and marks it approved, you can return to your student record and clearance pages to view the latest cleared information available to you.',
  },
  {
    value: 'faq-privacy',
    question: 'Who can view my medical information?',
    answer:
      'ClinicKa! uses role-based access, so students, clinic staff, and administrators only see the parts of the system needed for their responsibilities inside the Gordon College clinic workflow.',
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
      navigate('/create-password', { replace: true });
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
                Gordon College clinic records portal
              </div>

              <div className="space-y-5">
                <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] tracking-[-0.04em] text-[#0b1c30] md:text-5xl lg:text-6xl xl:text-[4.2rem]">
                  ClinicKa! Clinic Management Portal
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[#4a5b68] md:text-lg md:leading-8">
                  A role-based system for Gordon College students, clinic staff, and administrators to submit medical
                  requirements, review health records, issue clearances, and manage clinic operations online.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/auth?mode=signin"
                  className="inline-flex h-14 items-center justify-center rounded-full bg-[#004532] px-8 text-sm font-semibold text-white transition hover:bg-[#065f46]"
                >
                  Sign In to Portal
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection('features')}
                  className="inline-flex h-14 items-center justify-center rounded-full border border-[#6d8b81] bg-white/72 px-8 text-sm font-semibold text-[#0b1c30] transition hover:bg-white"
                >
                  View Services
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-white/80 bg-white/74 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Student service</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#0b1c30]">Submit</p>
                  <p className="mt-2 text-sm leading-6 text-[#4a5b68]">
                    Complete yearly forms and upload medical requirements.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/74 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Clinic service</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#0b1c30]">Review</p>
                  <p className="mt-2 text-sm leading-6 text-[#4a5b68]">
                    Verify records, update statuses, and manage clearances.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/74 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60717e]">Admin service</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#0b1c30]">Manage</p>
                  <p className="mt-2 text-sm leading-6 text-[#4a5b68]">
                    Maintain users, staff access, reports, and settings.
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
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#0b1c30] md:text-4xl">Services available in ClinicKa!</h2>
              <p className="mt-3 text-base leading-7 text-[#4a5b68] md:mt-4 md:text-lg">
                The portal supports the clinic record services Gordon College users need from submission to approval.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-[28px] border border-white/80 bg-white/78 p-8 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur lg:col-span-2">
                <div className="flex items-start gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f5ed] text-[#065f46]">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[#0b1c30]">Student medical requirement submission</h3>
                    <p className="mt-3 text-sm leading-7 text-[#4a5b68]">
                      Students can manage their profile, complete the privacy waiver and yearly medical form, and upload
                      required files such as chest X-ray, CBC, urinalysis, signatures, and supporting documents.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col justify-between rounded-[28px] bg-[#004532] p-8 text-white shadow-[0_18px_45px_rgba(11,28,48,0.12)]">
                <div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">Medical clearance processing</h3>
                  <p className="mt-3 text-sm leading-7 text-white/85">
                    Clinic personnel review submissions, mark physical examination completion, approve records, and
                    prepare clearance details for eligible students.
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/80 bg-white/78 p-8 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d9f3e4] text-[#065f46]">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-[#0b1c30]">Status updates and corrections</h3>
                <p className="mt-3 text-sm leading-7 text-[#4a5b68]">
                  Students can track pending, in-review, returned, resubmitted, physical-exam-done, and approved records
                  while clinic staff request corrections when needed.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/80 bg-white/78 p-8 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur lg:col-span-2">
                <div className="flex flex-col gap-8 md:flex-row">
                  <div className="flex-1">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f5ed] text-[#065f46]">
                      <FolderOpen className="h-6 w-6" />
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-[#0b1c30]">Records, certificates, and reports</h3>
                    <p className="mt-3 text-sm leading-7 text-[#4a5b68]">
                      Approved medical records can be accessed through student and staff portals, certificates can be
                      managed by clinic staff, and reports help administrators monitor clinic activity.
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
                From student submission<br />to clinic decision.
              </h2>
              <p className="max-w-xl text-base leading-7 text-[#4a5b68] md:text-lg md:leading-8">
                ClinicKa! guides students through medical record submission, then gives clinic staff the tools to review,
                return, approve, and document each record with a visible status history.
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
                    ClinicKa! separates access for students, clinic staff, and administrators so medical submissions,
                    review notes, certificates, and reports stay inside controlled Gordon College clinic workflows.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#d9f3e4] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#065f46]">
                Role-based access
              </span>
            </div>
          </div>
        </section>

        <section className="border-t border-[#e2ebe7] bg-white/60 py-16 md:py-20">
          <div className="mx-auto grid max-w-[90rem] items-center gap-10 px-5 sm:px-8 md:gap-12 lg:grid-cols-2 lg:px-10">
            <div className="space-y-4 md:space-y-5">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#0b1c30] md:text-4xl">Clinic records, clearances, and reports in one system.</h2>
              <p className="text-base leading-7 text-[#4a5b68] md:text-lg md:leading-8">
                Students can revisit submitted records and approved clearances, while clinic staff and administrators can
                monitor submissions, certificates, user accounts, and operational reports.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-[#4a5b68]">
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">Student records</span>
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">Staff review queue</span>
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">Admin reports</span>
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
                  <span>Unified clinic management dashboard</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-[#e2ebe7] py-16 md:py-20">
          <div className="mx-auto grid max-w-[90rem] gap-10 px-5 sm:px-8 md:gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:px-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c9d9dd] bg-white/78 px-4 py-2 text-sm font-semibold text-[#065f46] shadow-[0_10px_35px_rgba(11,28,48,0.05)] backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[#065f46]" />
                Student FAQ
              </div>
              <div className="space-y-4">
                <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] text-[#0b1c30] md:text-4xl">
                  Questions students usually ask before they submit.
                </h2>
                <p className="max-w-xl text-base leading-7 text-[#4a5b68] md:text-lg md:leading-8">
                  These quick answers cover the most common student concerns about starting a submission, preparing
                  requirements, tracking status updates, and checking approved records in ClinicKa!.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[28px] border border-white/80 bg-white/78 p-6 shadow-[0_18px_45px_rgba(11,28,48,0.06)] backdrop-blur">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f5ed] text-[#065f46]">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-[#0b1c30]">Before you begin</h3>
                  <p className="mt-3 text-sm leading-7 text-[#4a5b68]">
                    Prepare your school year selection, medical history details, and the files required by the clinic
                    so your submission is easier to complete in one sitting.
                  </p>
                </div>

                <div className="rounded-[28px] bg-[#004532] p-6 text-white shadow-[0_18px_45px_rgba(11,28,48,0.12)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/18">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em]">Need more help?</h3>
                  <p className="mt-3 text-sm leading-7 text-white/85">
                    Students can sign in to check submission updates, review returned notes, and revisit approved
                    clearance details from one secure portal.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_60px_rgba(11,28,48,0.08)] backdrop-blur md:p-7">
              <Accordion type="single" collapsible defaultValue={studentFaqs[0]?.value}>
                {studentFaqs.map((item) => (
                  <AccordionItem key={item.value} value={item.value} className="border-[#dfe9e6]">
                    <AccordionTrigger className="py-5 text-base font-semibold text-[#0b1c30] hover:no-underline md:text-lg">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 pr-6 text-sm leading-7 text-[#4a5b68] md:pr-10 md:text-base">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
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
