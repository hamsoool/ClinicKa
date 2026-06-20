import { Mail, ShieldCheck, Sparkles, XIcon } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { CONTACT_EMAIL, type LegalSection } from './legal-content';

type LegalDialogProps = {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  meta: string[];
  sections: LegalSection[];
  footer?: string;
};

export function LegalDialog({
  label,
  eyebrow,
  title,
  description,
  meta,
  sections,
  footer,
}: LegalDialogProps) {
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
      <DialogContent className="legal-dialog-native-scroll flex h-[100dvh] max-h-[100dvh] max-w-none flex-col overflow-y-auto rounded-none border-0 bg-[linear-gradient(180deg,#f8fbf8_0%,#fffeff_100%)] p-0 shadow-none sm:h-[92vh] sm:max-h-[92vh] sm:max-w-[95vw] sm:rounded-[2rem] sm:border sm:border-[#d8e4d7] sm:shadow-[0_30px_90px_rgba(0,109,60,0.06)] xl:max-w-6xl [&_[data-dialog-close=default]]:hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[-8rem] top-[-7rem] h-64 w-64 rounded-full bg-[#d9f3e4]/70 blur-3xl" />
          <div className="absolute right-[-7rem] top-12 h-72 w-72 rounded-full bg-[#eef6ec]/75 blur-3xl" />
        </div>

        <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
          <DialogClose className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8e4d7] bg-white/90 text-[#161d18] shadow-[0_14px_32px_rgba(0,109,60,0.05)] transition hover:bg-[#eef6ec] focus:outline-none focus:ring-2 focus:ring-[#006d3c]/30 focus:ring-offset-2 focus:ring-offset-white">
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="relative flex flex-col">
          <div className="border-b border-[#d8e4d7]/60 bg-[linear-gradient(135deg,#f8fcf9_0%,#eef7f1_60%,#fffeff_100%)]">
            <DialogHeader className="px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <DialogTitle className="text-3xl font-semibold tracking-[-0.05em] text-[#161d18] sm:text-[2.6rem]">
                    {title}
                  </DialogTitle>
                  <DialogDescription className="mt-4 max-w-2xl text-base leading-8 text-[#3d4a3f]">
                    {description}
                  </DialogDescription>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:w-[27rem] lg:grid-cols-1">
                  {meta.map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.35rem] border border-[#e6eeea] bg-white px-4 py-3 text-sm font-medium leading-6 text-[#161d18] shadow-[0_12px_26px_rgba(0,109,60,0.03)]"
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
                className="overflow-hidden rounded-[1.7rem] border border-[#e6eeea] bg-white shadow-[0_22px_60px_rgba(0,109,60,0.04)]"
              >
                <div className="h-1.5 bg-[linear-gradient(90deg,rgba(0,109,60,0.95)_0%,rgba(6,95,70,0.75)_45%,rgba(145,219,193,0.45)_100%)]" />
                <div className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d9f3e4] text-sm font-semibold text-[#065f46] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#161d18]">{section.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-[#3d4a3f]">{section.body}</p>
                      {section.bullets?.length ? (
                        <ul className="mt-5 space-y-3">
                          {section.bullets.map((bullet) => (
                            <li
                              key={bullet}
                              className="flex items-start gap-3 rounded-2xl border border-[#e4ece8] bg-[#fcfefd] px-4 py-3 text-sm leading-6 text-[#3d4a3f]"
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
              <div className="rounded-[1.7rem] border border-[#bbe4d0] bg-[linear-gradient(135deg,#ecfaf2_0%,#fffeff_100%)] p-5 shadow-[0_20px_45px_rgba(0,109,60,0.03)] sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#065f46] shadow-[0_10px_24px_rgba(0,109,60,0.04)]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#065f46]">Key acknowledgement</p>
                    <p className="mt-2 text-sm leading-7 text-[#161d18]/85">{footer}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.35rem] border border-[#c8ddd2] bg-[linear-gradient(135deg,#edf9f2_0%,#fffeff_100%)] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#065f46] shadow-[0_10px_24px_rgba(0,109,60,0.04)]">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#161d18]">Need help?</p>
                  <p className="mt-1 text-sm leading-6 text-[#3d4a3f]">
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
