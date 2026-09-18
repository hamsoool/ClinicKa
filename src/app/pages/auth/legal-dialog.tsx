import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import { CONTACT_EMAIL, type LegalSection } from './legal-content';

type LegalDialogProps = {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  meta?: string[];
  sections: LegalSection[];
  footer?: string;
  triggerClassName?: string;
};

export function LegalDialog({
  label,
  eyebrow,
  title,
  description,
  sections,
  footer,
  triggerClassName = 'font-semibold text-[#006d3c] underline underline-offset-4 transition-colors hover:text-[#004d2a]',
}: LegalDialogProps) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <button type="button" className={triggerClassName}>
          {label}
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        {/* Modal Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200" />

        {/* Centered Modal Container */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 pointer-events-none">
          <DialogPrimitive.Content className="pointer-events-auto flex flex-col w-full max-w-4xl lg:max-w-5xl h-[90vh] max-h-[90vh] bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden focus:outline-none transition-all duration-200">
            {/* Modal Header */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 sm:px-8">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <span className="h-2.5 w-2.5 rounded-full bg-[#006d3c] shrink-0" />
                <p className="truncate text-xs sm:text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  {eyebrow}
                </p>
              </div>

              <DialogPrimitive.Close
                aria-label="Close document"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#006d3c]"
              >
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            {/* Scrollable Document Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10 sm:py-10 lg:px-14 space-y-10">
              {/* Document Header */}
              <header className="border-b border-neutral-200 pb-8 space-y-3">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
                  {title}
                </h1>
                <p className="text-base sm:text-lg leading-relaxed text-neutral-600">
                  {description}
                </p>
              </header>

              {/* Legal Sections */}
              <main className="divide-y divide-neutral-200/80">
                {sections.map((section, index) => (
                  <section
                    key={section.title}
                    className="py-7 first:pt-0 last:pb-7 space-y-3"
                  >
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-neutral-900">
                      {index + 1}. {section.title}
                    </h2>
                    <div className="space-y-3 text-base sm:text-lg leading-relaxed text-neutral-700">
                      <p>{section.body}</p>
                      {section.bullets?.length ? (
                        <ul className="list-disc space-y-2 pl-6 marker:text-[#006d3c]">
                          {section.bullets.map((bullet) => (
                            <li key={bullet} className="pl-1 leading-relaxed">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </section>
                ))}
              </main>

              {/* Acknowledgement Notice */}
              {footer ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6 space-y-2">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-800">
                    Formal Acknowledgement
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed text-neutral-700">
                    {footer}
                  </p>
                </div>
              ) : null}

              {/* Contact / Help Footer */}
              <footer className="border-t border-neutral-200 pt-6 pb-6 text-sm sm:text-base text-neutral-600">
                <p>
                  Questions or concerns regarding this policy? Contact Gordon College Clinic administration at{' '}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="font-semibold text-neutral-900 underline underline-offset-4 hover:text-black"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  .
                </p>
              </footer>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
