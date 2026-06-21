import type { CSSProperties } from 'react';
import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import {
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  CornerDownRight,
  Facebook,
  FileText,
  FolderOpen,
  Instagram,
  Mail,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { LegalDialog } from './auth/legal-dialog';
import { POLICY_UPDATED_AT, CONTACT_EMAIL, privacySections, termsSections } from './auth/legal-content';

const LOGO_SRC = '/logo.png';
const LANDING_PREVIEW_SRC = '/clinickalogo.png';
const FORM_PREVIEW_SRC = '/previews/student-medical-form-preview.png';
const CAMPUS_PREVIEW_SRC = '/backdrop.jpg';

const baseGridStyle: CSSProperties = {
  backgroundImage: [
    'linear-gradient(rgba(0, 109, 60, 0.08) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(0, 109, 60, 0.08) 1px, transparent 1px)',
    'linear-gradient(rgba(216, 228, 215, 0.32) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(216, 228, 215, 0.32) 1px, transparent 1px)',
  ].join(', '),
  backgroundPosition: '-1px -1px, -1px -1px, -1px -1px, -1px -1px',
  backgroundSize: '96px 96px, 96px 96px, 24px 24px, 24px 24px',
};

const activeGridStyle: CSSProperties = {
  backgroundImage: [
    'linear-gradient(rgba(0, 109, 60, 0.35) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(0, 109, 60, 0.35) 1px, transparent 1px)',
    'linear-gradient(rgba(0, 109, 60, 0.22) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(0, 109, 60, 0.22) 1px, transparent 1px)',
  ].join(', '),
  backgroundPosition: '-1px -1px, -1px -1px, -1px -1px, -1px -1px',
  backgroundSize: '96px 96px, 96px 96px, 24px 24px, 24px 24px',
  maskImage: 'radial-gradient(circle 240px at var(--mouse-x, 0px) var(--mouse-y, 0px), black 20%, transparent 100%)',
  WebkitMaskImage: 'radial-gradient(circle 240px at var(--mouse-x, 0px) var(--mouse-y, 0px), black 20%, transparent 100%)',
  opacity: 'var(--mouse-opacity, 0)',
  transition: 'opacity 0.4s ease-out',
};

const spotlightStyle: CSSProperties = {
  background: 'radial-gradient(circle 400px at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(0, 109, 60, 0.09), transparent 80%)',
  opacity: 'var(--mouse-opacity, 0)',
  transition: 'opacity 0.4s ease-out',
};

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
      'Follow records as they move through pending, in review, returned, resubmitted, and approved states.',
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
      'Pending means your submission was received, in review means clinic staff are checking it, returned means corrections are needed, resubmitted means you sent an updated version, and approved means your record is cleared for the current workflow.',
  },
  {
    value: 'faq-returned',
    question: 'What should I do if my record is returned for correction?',
    answer:
      'Open your submission, review the clinic notes, update the answers or files they flagged, and resubmit through the same portal so the staff can continue the review without starting over.',
  },
  {
    value: 'faq-clearance',
    question: 'When can I view my medical certificate?',
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
  const [activeHighlightIndex, setActiveHighlightIndex] = useState<number | null>(0);
  const [studentImageIndex, setStudentImageIndex] = useState(0);

  const studentPreviews = [
    '/previews/student_preview.png',
    '/previews/student_preview1.png',
    '/previews/student_preview2.png',
  ];

  let targetImageSrc = FORM_PREVIEW_SRC;
  if (activeHighlightIndex === 0) {
    targetImageSrc = studentPreviews[studentImageIndex];
  }

  const [imageSrc, setImageSrc] = useState(targetImageSrc);
  const [fade, setFade] = useState(true);

  // Cycle student images
  useEffect(() => {
    if (activeHighlightIndex !== 0) return;
    const interval = setInterval(() => {
      setStudentImageIndex((prev) => (prev + 1) % studentPreviews.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [activeHighlightIndex]);

  // Smooth fade transition when target image changes
  useEffect(() => {
    setFade(false);
    const timer = setTimeout(() => {
      setImageSrc(targetImageSrc);
      setFade(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [targetImageSrc]);

  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      hero.style.setProperty('--mouse-x', `${x}px`);
      hero.style.setProperty('--mouse-y', `${y}px`);
      hero.style.setProperty('--mouse-opacity', '1');
    };

    const handleMouseLeave = () => {
      hero.style.setProperty('--mouse-opacity', '0');
    };

    hero.addEventListener('mousemove', handleMouseMove);
    hero.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      hero.removeEventListener('mousemove', handleMouseMove);
      hero.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

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
    <div className="min-h-screen bg-[#fffeff] text-[#161d18]">
      <style>{`
        .ecg-container {
          position: absolute;
          top: 20%;
          transform: translateY(-50%);
          left: 0;
          right: 0;
          height: 128px;
          overflow: hidden;
          pointer-events: none;
          opacity: 0.2;
          z-index: 10;
        }

        .ecg-line {
          filter: drop-shadow(0 0 3px rgba(0, 109, 60, 0.5));
          mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,0.1) 15%, rgba(0,0,0,1) 85%, rgba(0,0,0,1) 95%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,0.1) 15%, rgba(0,0,0,1) 85%, rgba(0,0,0,1) 95%, transparent 100%);
          mask-size: 500px 100%;
          -webkit-mask-size: 500px 100%;
          mask-repeat: no-repeat;
          -webkit-mask-repeat: no-repeat;
          animation: ecg-sweep 7s linear infinite;
        }

        .ecg-hover-box {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 500px;
          pointer-events: auto;
          cursor: pointer;
          animation: ecg-box-sweep 7s linear infinite;
        }

        .ecg-container:hover .ecg-line,
        .ecg-container:hover .ecg-hover-box {
          animation-play-state: paused;
        }

        @keyframes ecg-sweep {
          0% {
            mask-position: -500px 0;
            -webkit-mask-position: -500px 0;
          }
          100% {
            mask-position: calc(100% + 500px) 0;
            -webkit-mask-position: calc(100% + 500px) 0;
          }
        }

        @keyframes ecg-box-sweep {
          0% {
            left: -500px;
          }
          100% {
            left: calc(100% + 500px);
          }
        }

        .resp-container {
          position: absolute;
          top: 76%;
          transform: translateY(-50%);
          left: 0;
          right: 0;
          height: 128px;
          overflow: hidden;
          pointer-events: none;
          opacity: 0.2;
          z-index: 10;
        }

        .resp-line {
          filter: drop-shadow(0 0 3px rgba(0, 109, 61, 0.5));
          mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,0.1) 15%, rgba(0,0,0,1) 85%, rgba(0,0,0,1) 95%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,0.1) 15%, rgba(0,0,0,1) 85%, rgba(0,0,0,1) 95%, transparent 100%);
          mask-size: 500px 100%;
          -webkit-mask-size: 500px 100%;
          mask-repeat: no-repeat;
          -webkit-mask-repeat: no-repeat;
          animation: resp-sweep 9s linear infinite;
        }

        .resp-hover-box {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 500px;
          pointer-events: auto;
          cursor: pointer;
          animation: resp-box-sweep 9s linear infinite;
        }

        .resp-container:hover .resp-line,
        .resp-container:hover .resp-hover-box {
          animation-play-state: paused;
        }

        @keyframes resp-sweep {
          0% {
            mask-position: -500px 0;
            -webkit-mask-position: -500px 0;
          }
          100% {
            mask-position: calc(100% + 500px) 0;
            -webkit-mask-position: calc(100% + 500px) 0;
          }
        }

        @keyframes resp-box-sweep {
          0% {
            left: -500px;
          }
          100% {
            left: calc(100% + 500px);
          }
        }

        .logo-interactive {
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          transform-origin: center;
          will-change: transform;
        }

        .logo-interactive:hover {
          transform: scale(1.04);
        }
      `}</style>
      <nav
        className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${isScrolled
          ? 'border-[#003d2b] bg-[#001d14] text-white'
          : 'border-transparent bg-transparent'
          }`}
      >
        <div className={`mx-auto flex w-full max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-10 transition-all duration-300 ${isScrolled ? 'h-12 md:h-16' : 'h-14 md:h-20'
          }`}>
          <button
            type="button"
            onClick={() => scrollToSection('hero')}
            className="flex min-w-0 items-center gap-2 md:gap-3 text-left"
          >
            {logoVisible ? (
              <img
                src={LOGO_SRC}
                alt="ClinicKa logo"
                fetchPriority="high"
                className={`rounded-full object-cover transition-all duration-300 ${isScrolled ? 'h-7 w-7 md:h-8 md:w-8' : 'h-8 w-8 md:h-10 md:w-10'
                  }`}
                onError={() => setLogoVisible(false)}
              />
            ) : (
              <span className={`inline-flex items-center justify-center rounded-full bg-[#d9f3e4] text-[#006d3c] transition-all duration-300 ${isScrolled ? 'h-7 w-7 md:h-8 md:w-8' : 'h-8 w-8 md:h-10 md:w-10'
                }`}>
                <Stethoscope className={`transition-all duration-300 ${isScrolled ? 'h-4 w-4' : 'h-4 w-4 md:h-5 md:w-5'}`} />
              </span>
            )}
            <span className={`truncate font-bold tracking-tight transition-all duration-300 ${isScrolled
              ? 'text-sm md:text-base text-white'
              : 'text-sm md:text-[20px] text-[#161d18]'
              }`}>
              ClinicKa!
            </span>
          </button>

          <div className={`hidden items-center font-normal transition-all duration-300 md:flex ${isScrolled
            ? 'text-white/78 text-sm gap-7 lg:gap-8'
            : 'text-[#3d4a3f] text-[16px] gap-8 lg:gap-10'
            }`}>
            {navLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => handleNavClick(link.target)}
                className={`transition-colors duration-200 ${isScrolled ? 'hover:text-white' : 'hover:text-[#006d3c]'
                  }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/auth?mode=signin"
              className={`hidden items-center justify-center rounded-full bg-[#006d3c] text-white transition-all duration-300 active:scale-95 hover:bg-[#005f34] md:inline-flex ${isScrolled
                ? 'h-9 md:h-10 px-4 md:px-5 text-sm font-normal'
                : 'h-10 md:h-11 px-5 md:px-7 text-sm md:text-[15px] font-medium'
                }`}
            >
              Sign In
            </Link>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className={`inline-flex items-center justify-center rounded-full border transition-all duration-300 active:scale-95 md:hidden ${isScrolled
                ? 'h-9 w-9 border-white/20 bg-white/10 text-white'
                : 'h-10 w-10 border-[#d8e4d7] bg-white text-[#006d3c]'
                }`}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-dropbar"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div
          id="mobile-dropbar"
          className={`overflow-hidden border-t border-[#d8e4d7] bg-[#fffeff]/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 md:hidden ${isMenuOpen ? 'max-h-[22rem] opacity-100' : 'max-h-0 opacity-0'
            }`}
        >
          <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-2 px-5 py-4 sm:px-8">
            {navLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => handleNavClick(link.target)}
                className="rounded-full px-4 py-3 text-left text-sm text-[#161d18] transition hover:bg-white"
              >
                {link.label}
              </button>
            ))}
            <Link
              to="/auth?mode=signin"
              onClick={() => setIsMenuOpen(false)}
              className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#006d3c] px-5 text-sm text-white transition active:scale-95 hover:bg-[#005f34]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section id="hero" ref={heroRef} className="relative overflow-hidden pt-14 md:pt-20 bg-[#fffeff]">
          {/* Base Grid Layer */}
          <div className="absolute inset-0 pointer-events-none" style={baseGridStyle} />

          {/* White Overlay to soften the base grid */}
          <div className="absolute inset-0 bg-[#fffeff]/70 pointer-events-none" aria-hidden="true" />

          {/* Spotlight Glow Layer */}
          <div className="absolute inset-0 pointer-events-none" style={spotlightStyle} />

          {/* Masked Active Grid Layer */}
          <div className="absolute inset-0 pointer-events-none" style={activeGridStyle} />

          {/* Animated ECG Heartbeat Line */}
          <div className="ecg-container">
            <svg className="w-full h-full text-[#006d3c]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="ecg-pattern" width="480" height="128" patternUnits="userSpaceOnUse">
                  <path
                    d="M 0,64 L 50,64 Q 62,46 74,64 L 79,74 L 95,4 L 111,124 L 119,64 Q 136,36 153,64 L 180,64 Q 192,54 204,64 L 209,69 L 225,34 L 241,94 L 249,64 Q 266,50 283,64 L 480,64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#ecg-pattern)" className="ecg-line" />
            </svg>
            {/* Moving Hover Target synchronized with the sweep window */}
            <div className="ecg-hover-box" />
          </div>

          {/* Animated RESP Wave Line */}
          <div className="resp-container">
            <svg className="w-full h-full text-secondary" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="resp-pattern" width="480" height="128" patternUnits="userSpaceOnUse">
                  <path
                    d="M 0,64 Q 60,16 120,64 T 240,64 Q 300,16 360,64 T 480,64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#resp-pattern)" className="resp-line" />
            </svg>
            {/* Moving Hover Target synchronized with the sweep window */}
            <div className="resp-hover-box" />
          </div>

          <div className="relative mx-auto grid min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-5rem)] w-full max-w-[90rem] items-center gap-10 px-5 py-14 sm:px-8 md:py-18 lg:grid-cols-12 lg:px-10 pointer-events-none -translate-y-8 md:-translate-y-16 lg:-translate-y-24">
            <div className="space-y-6 lg:col-span-7 pointer-events-auto">
              <p className="text-base font-semibold uppercase tracking-[0.18em] text-[#006d3c]">
                Gordon College Health Services
              </p>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-[2.85rem] font-semibold leading-[1.07] tracking-[-0.025em] text-[#161d18] sm:text-[3.75rem] lg:text-[4.25rem]">
                  <span className="text-[#006d3c]">ClinicKa!</span> <br />A Student Health <br />Record Portal
                </h1>
                <p className="max-w-2xl text-[19px] leading-7 tracking-[-0.01em] text-[#3d4a3f] sm:text-[22px] sm:leading-8">
                  A focused medical clearance and student health record system for submissions, clinic review, and
                  administrative workflows in one Gordon College portal.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/auth?mode=signin"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#006d3c] px-8 text-[18px] font-medium text-white transition active:scale-95 hover:bg-[#005f34] shadow-[0_4px_14px_rgba(0,109,60,0.25)]"
                >
                  Sign In
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection('features')}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[#006d3c] bg-white px-8 text-[18px] font-medium text-[#006d3c] transition active:scale-95 hover:bg-[#eef6ec] shadow-[0_4px_14px_rgba(0,0,0,0.02)]"
                >
                  View Services
                </button>
              </div>
            </div>

            <div className="flex justify-center lg:col-span-5 pointer-events-auto">
              <img
                src={LANDING_PREVIEW_SRC}
                alt="ClinicKa logo"
                fetchPriority="high"
                className="w-full max-w-[500px] object-contain drop-shadow-[3px_5px_30px_rgba(0,0,0,0.18)] logo-interactive"
              />
            </div>
          </div>
        </section>

        <section id="features" className="bg-[#fffeff] py-16 md:py-20">
          <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-10">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[#161d18] md:text-[2.5rem]">
                Services available in ClinicKa!
              </h2>
              <p className="mt-4 text-[17px] leading-7 text-[#3d4a3f]">
                The portal supports the clinic record services Gordon College users need from submission to approval.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <div className="group relative overflow-hidden rounded-2xl border border-[#d8e4d7] bg-white p-6 lg:col-span-2 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,109,60,0.06)] hover:border-[#006d3c]/30 transform-gpu">
                <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-[#eef6ec]/10 blur-2xl transition-all duration-500 group-hover:bg-[#eef6ec]/40 pointer-events-none" />
                <div className="relative flex flex-col sm:flex-row items-start gap-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef6ec] text-[#006d3c] shadow-sm transform scale-100 transition-[background-color,color,transform] duration-300 group-hover:bg-[#006d3c] group-hover:text-white group-hover:scale-110 transform-gpu">
                    <Users className="h-5 w-5 transform rotate-0 transition-transform duration-300 group-hover:rotate-3 transform-gpu" />
                  </span>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#161d18] transition-colors group-hover:text-[#006d3c]">
                      Student medical requirement submission
                    </h3>
                    <p className="mt-3 text-[17px] leading-7 text-[#3d4a3f]">
                      Students can manage their profile, complete the privacy waiver and yearly medical form, and upload
                      required files such as chest X-ray, CBC, urinalysis, signatures, and supporting documents.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl bg-[#0b2f21] p-6 text-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(11,47,33,0.25)] transform-gpu">
                <div className="absolute -left-16 -bottom-16 h-36 w-36 rounded-full bg-white/2 blur-2xl transition-all duration-500 group-hover:bg-white/8 pointer-events-none" />
                <div className="relative flex flex-col h-full justify-between gap-6">
                  <div>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 text-white shadow-inner transform scale-100 transition-[background-color,transform] duration-300 group-hover:bg-[#00b274] group-hover:scale-110 transform-gpu">
                      <ShieldCheck className="h-5 w-5 transform rotate-0 transition-transform duration-300 group-hover:rotate-12 transform-gpu" />
                    </span>
                    <h3 className="mt-6 text-2xl font-semibold tracking-[-0.02em] transition-colors group-hover:text-[#85f6ae]">
                      Medical certificate processing
                    </h3>
                    <p className="mt-3 text-[17px] leading-7 text-white/78">
                      Clinic staff and doctors review submitted health records, complete assessment requirements, and
                      prepare student medical certificates for approved submissions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-[#d8e4d7] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,109,60,0.06)] hover:border-[#006d3c]/30 transform-gpu">
                <div className="absolute -right-16 -bottom-16 h-32 w-32 rounded-full bg-[#eef6ec]/10 blur-2xl transition-all duration-500 group-hover:bg-[#eef6ec]/40 pointer-events-none" />
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef6ec] text-[#006d3c] shadow-sm transform scale-100 transition-[background-color,color,transform] duration-300 group-hover:bg-[#006d3c] group-hover:text-white group-hover:scale-110 transform-gpu">
                  <ClipboardList className="h-5 w-5 transform translate-y-0 transition-transform duration-300 group-hover:-translate-y-0.5 transform-gpu" />
                </span>
                <h3 className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-[#161d18] transition-colors group-hover:text-[#006d3c]">
                  Status updates and corrections
                </h3>
                <p className="mt-3 text-[17px] leading-7 text-[#3d4a3f]">
                  Students can track pending, in-review, returned, resubmitted, physical-exam-done, and approved records
                  while clinic staff request corrections when needed.
                </p>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-[#d8e4d7] bg-white p-6 lg:col-span-2 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,109,60,0.06)] hover:border-[#006d3c]/30 transform-gpu">
                <div className="relative flex flex-col gap-8 md:flex-row">
                  <div className="flex-1">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef6ec] text-[#006d3c] shadow-sm transform scale-100 transition-[background-color,color,transform] duration-300 group-hover:bg-[#006d3c] group-hover:text-white group-hover:scale-110 transform-gpu">
                      <FolderOpen className="h-5 w-5 transform rotate-0 transition-transform duration-300 group-hover:rotate-[-6deg] transform-gpu" />
                    </span>
                    <h3 className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-[#161d18] transition-colors group-hover:text-[#006d3c]">
                      Records, certificates, and reports
                    </h3>
                    <p className="mt-3 text-[17px] leading-7 text-[#3d4a3f]">
                      Approved medical records can be accessed through student and staff portals, certificates can be
                      managed by clinic staff, and reports help administrators monitor clinic activity.
                    </p>
                  </div>
                  <div className="hidden flex-1 rounded-xl border border-[#dfebea] bg-[#f8fcf9] p-5 md:block transition-all duration-300 group-hover:border-[#006d3c]/20 group-hover:shadow-[inset_0_1px_3px_rgba(0,109,60,0.02)]">
                    <div className="flex items-center justify-between pb-3 border-b border-[#dfebea]/60">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#065f46]">Submission Queue</span>
                      <span className="text-[9px] text-[#70808b]">Action Needed</span>
                    </div>
                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-center justify-between rounded-lg border border-[#e4eeea]/80 bg-white p-2.5 shadow-sm transition-all duration-300 group-hover:translate-x-1 group-hover:shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#eef6ec] text-[#006d3c] transition-colors duration-300 group-hover:bg-[#006d3c] group-hover:text-white">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-[11px] font-semibold text-[#161d18]">Dela Cruz, Juan</span>
                            <span className="text-[9px] text-[#70808b]">22-01230 | 1st Year | BSIT</span>
                          </div>
                        </div>
                        <div className="h-5 px-2 rounded-full bg-amber-50 border border-amber-200/50 text-amber-800 text-[9px] font-semibold flex items-center justify-center transition-all duration-300 group-hover:bg-amber-100">
                          Pending review
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-[#e4eeea]/80 bg-white p-2.5 shadow-sm transition-all duration-300 group-hover:translate-x-1 group-hover:shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#eef6ec] text-[#006d3c] transition-colors duration-300 group-hover:bg-[#006d3c] group-hover:text-white">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-[11px] font-semibold text-[#161d18]">Santos, Maria</span>
                            <span className="text-[9px] text-[#70808b]">21-04562 | 2nd Year | BSN</span>
                          </div>
                        </div>
                        <div className="h-5 px-2 rounded-full bg-red-50 border border-red-200/50 text-red-800 text-[9px] font-semibold flex items-center justify-center transition-all duration-300 group-hover:bg-red-100">
                          Returned
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-[#e4eeea]/80 bg-white p-2.5 shadow-sm transition-all duration-300 group-hover:translate-x-1 group-hover:shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#eef6ec] text-[#006d3c] transition-colors duration-300 group-hover:bg-[#006d3c] group-hover:text-white">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-[11px] font-semibold text-[#161d18]">Alvarez, Jose</span>
                            <span className="text-[9px] text-[#70808b]">20-07891 | 3rd Year | BSCS</span>
                          </div>
                        </div>
                        <div className="h-5 px-2 rounded-full bg-blue-50 border border-blue-200/50 text-blue-800 text-[9px] font-semibold flex items-center justify-center transition-all duration-300 group-hover:bg-blue-100">
                          Resubmitted
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="relative overflow-hidden bg-gradient-to-br from-[#0c2419] via-[#12251b] to-[#081510] py-16 text-white md:py-20">
          {/* Subtle background glows */}
          <div className="pointer-events-none absolute right-0 top-1/4 h-[30rem] w-[30rem] -translate-y-1/2 rounded-full bg-[#00b274]/5 blur-[120px]" />
          <div className="pointer-events-none absolute left-0 bottom-1/4 h-[30rem] w-[30rem] translate-y-1/2 rounded-full bg-[#eef6ec]/3 blur-[120px]" />

          <div className="mx-auto grid max-w-[90rem] items-center gap-10 px-5 sm:px-8 md:gap-16 lg:grid-cols-2 lg:px-10">
            <div className="group/img order-2 relative lg:order-1 select-none">
              <div className="absolute inset-0 bg-[#00b274]/10 opacity-0 blur-xl transition-opacity duration-500 group-hover/img:opacity-100 pointer-events-none" />
              <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all duration-500 group-hover/img:scale-[1.015] group-hover/img:border-[#00b274]/30 transform-gpu">
                <img
                  src={imageSrc}
                  alt="Student medical form workflow preview"
                  className={`w-full object-cover transition-all duration-300 transform-gpu group-hover/img:scale-[1.01] ${
                    fade ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover/img:opacity-100 transition-opacity duration-500 pointer-events-none" />
              </div>
            </div>

            <div className="order-1 space-y-6 lg:order-2">
              <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-[2.5rem]">
                From student submission to clinic decision.
              </h2>
              <p className="max-w-xl text-[17px] leading-7 text-white/76 sm:text-xl sm:leading-8">
                ClinicKa! guides students through medical record submission, then gives clinic staff the tools to review,
                return, approve, and document each record with a visible status history.
              </p>
              <div className="space-y-4 pt-2">
                {workflowHighlights.map((item, index) => {
                  const isActive = activeHighlightIndex === index;
                  return (
                    <div
                      key={item.title}
                      onClick={() => setActiveHighlightIndex(isActive ? null : index)}
                      className={`group/item flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 transform-gpu cursor-pointer ${
                        isActive
                          ? 'border-[#00b274]/30 bg-white/5 shadow-[0_10px_30px_rgba(0,109,60,0.1)]'
                          : 'border-transparent hover:border-white/10 hover:bg-white/4'
                      }`}
                    >
                      <CornerDownRight className={`mt-0.5 h-6 w-6 shrink-0 transform transition-all duration-300 transform-gpu ${
                        isActive
                          ? 'text-[#85f6ae] scale-110 translate-x-0.5'
                          : 'text-white/40 group-hover/item:text-[#85f6ae] group-hover/item:scale-110 group-hover/item:translate-x-0.5'
                      }`} />
                      <div className="flex-1">
                        <h4 className={`text-lg md:text-xl font-semibold transition-colors duration-300 ${
                          isActive ? 'text-[#85f6ae]' : 'text-white group-hover/item:text-[#85f6ae]'
                        }`}>
                          {item.title}
                        </h4>
                        <div
                          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                            isActive ? 'grid-rows-[1fr] opacity-100 mt-2.5' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <p className="text-[15px] leading-relaxed text-white/70">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="clearance" className="bg-white py-16 md:py-20">
          <div className="mx-auto grid max-w-[90rem] items-center gap-10 px-5 sm:px-8 md:gap-12 lg:grid-cols-2 lg:px-10">
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#006d3c]">Role-based access</p>
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[#161d18] md:text-[2.5rem]">
                Clinic records, clearances, and reports in one system.
              </h2>
              <p className="text-[17px] leading-7 text-[#3d4a3f] sm:text-xl sm:leading-8">
                Students can revisit submitted records and approved clearances, while clinic staff and administrators can
                monitor submissions, certificates, user accounts, and operational reports.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-[#3d4a3f]">
                <span className="rounded-full border border-[#d8e4d7] bg-[#fffeff] px-4 py-2">Student records</span>
                <span className="rounded-full border border-[#d8e4d7] bg-[#fffeff] px-4 py-2">Staff review queue</span>
                <span className="rounded-full border border-[#d8e4d7] bg-[#fffeff] px-4 py-2">Admin reports</span>
              </div>
            </div>
            <div className="relative">
              <img
                src={CAMPUS_PREVIEW_SRC}
                alt="Gordon College campus"
                className="aspect-[4/3] w-full object-cover drop-shadow-[3px_5px_30px_rgba(0,0,0,0.16)]"
              />
              <div className="absolute bottom-4 left-4 rounded-full bg-white/92 px-4 py-3 text-sm text-[#3d4a3f] backdrop-blur">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-[#006d3c]" />
                  <span>Unified clinic management dashboard</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="bg-[#fffeff] py-16 md:py-20">
          <div className="mx-auto grid max-w-[90rem] gap-10 px-5 sm:px-8 md:gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:px-10">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#006d3c]">Student FAQ</p>
              <div className="space-y-4">
                <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.02em] text-[#161d18] md:text-[2.5rem]">
                  Questions students usually ask before they submit.
                </h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="border border-[#d8e4d7] bg-white p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef6ec] text-[#006d3c]">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-[#161d18]">Before you begin</h3>
                  <p className="mt-3 text-[15px] leading-6 text-[#3d4a3f]">
                    Prepare your school year selection, medical history details, and files required by the clinic.
                  </p>
                </div>

                <div className="bg-[#0b2f21] p-6 text-white">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em]">Need more help?</h3>
                  <p className="mt-3 text-[15px] leading-6 text-white/78">
                    Students can sign in to check submission updates, review returned notes, and revisit approved
                    clearance details.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-[#d8e4d7] bg-white p-5 md:p-7">
              <Accordion type="single" collapsible defaultValue={studentFaqs[0]?.value}>
                {studentFaqs.map((item) => (
                  <AccordionItem key={item.value} value={item.value} className="border-[#d8e4d7]">
                    <AccordionTrigger className="py-5 text-left text-[17px] font-semibold text-[#161d18] hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 pr-6 text-[15px] leading-7 text-[#3d4a3f] md:pr-10">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>

      <footer id="resources" className="border-t border-[#003d2b] bg-[#001d14] py-12 text-white/70">
        <div className="mx-auto grid max-w-[90rem] grid-cols-1 gap-8 px-5 text-sm sm:px-8 md:grid-cols-4 lg:px-10">
          {/* Column 1: Brand & Copyright */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/footer.png"
                alt="ClinicKa logo"
                className="h-10 w-10 object-contain"
              />
              <div className="text-base font-semibold text-white tracking-wide">ClinicKa!</div>
            </div>
            <div>
              <p className="text-white/60 text-xs max-w-xs leading-relaxed">
                Digitalizing Healthcare Records for a faster<br />and smarter clinic experience.
              </p>
              <div className="mt-4">
                <p className="text-white/70 text-xs">DigitalDuo</p>
                <p className="mt-1 text-[11px] text-white/40">Copyright 2026 ClinicKa. All rights reserved.</p>
              </div>
            </div>
          </div>

          {/* Column 2: Legal & Navigation */}
          <div className="flex flex-col gap-3 md:pl-10 text-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Quick Links</h4>
            <div className="flex flex-col gap-2.5">
              <LegalDialog
                label="Privacy policy"
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
                triggerClassName="text-left font-normal transition-colors hover:text-white text-white/70 text-sm"
              />
              <LegalDialog
                label="Terms of service"
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
                triggerClassName="text-left font-normal transition-colors hover:text-white text-white/70 text-sm"
              />
            </div>
          </div>

          {/* Column 3: Contact Us info */}
          <div className="flex flex-col gap-3 text-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Contact Us</h4>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5 text-white/70">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#00b274]" />
                <a href="mailto:digitalduo.clinicka@gmail.com" className="transition-colors hover:text-white">
                  digitalduo.clinicka@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-2.5 text-white/70">
                <Phone className="h-4 w-4 shrink-0 text-[#00b274]" />
                <a href="tel:+639280410729" className="transition-colors hover:text-white">
                  +63 928 041 0729
                </a>
              </div>
              <div className="flex items-start gap-2.5 text-white/70">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#00b274]" />
                <span className="leading-relaxed">
                  Olongapo City Sports Complex, Donor St., East Tapinac, Olongapo City, Zambales, Philippines
                </span>
              </div>
            </div>
          </div>

          {/* Column 4: Connect With Us */}
          <div className="flex flex-col gap-3 md:pl-5 text-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Connect With Us</h4>
            <div className="flex flex-col gap-2.5">
              <a
                href="https://www.facebook.com/gchealthservicesunit"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-white/70 transition-colors hover:text-white"
              >
                <Facebook className="h-4 w-4 text-[#00b274] shrink-0" />
                <span>Facebook</span>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-white/70 transition-colors hover:text-white"
              >
                <Instagram className="h-4 w-4 text-[#00b274] shrink-0" />
                <span>Instagram</span>
              </a>
              <a
                href="mailto:coordinator.healthservices@gordoncollege.edu.ph"
                className="flex items-center gap-2.5 text-white/70 transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4 text-[#00b274] shrink-0" />
                <span>Email</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
