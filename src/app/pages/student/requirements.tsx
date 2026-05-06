import { CheckCircle2, FileText, FlaskConical, Info } from 'lucide-react';

const requirements = [
  {
    label: 'Chest X-Ray',
    description: 'Official radiologic report required. Must be dated within the last 6 months.',
    formats: ['PDF', 'JPG', 'PNG'],
    icon: FileText,
  },
  {
    label: 'Complete Blood Count (CBC)',
    description: 'Full laboratory results showing all parameters. Must be dated within the last 3 months.',
    formats: ['PDF', 'JPG'],
    icon: FlaskConical,
  },
  {
    label: 'Urinalysis',
    description: 'Standard urinalysis laboratory results. Must be dated within the last 3 months.',
    formats: ['PDF', 'JPG'],
    icon: FlaskConical,
  },
];

const checklist = [
  { label: 'Physical Examination Form', status: 'approved' },
  { label: 'Chest X-Ray', status: 'approved' },
  { label: 'Complete Blood Count', status: 'approved' },
  { label: 'Urinalysis', status: 'approved' },
];

export default function StudentRequirements() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Submission Requirements</h1>
        <p className="mt-2 text-sm text-on-surface-variant sm:text-base">
          Please upload the required medical documents to complete your clinical clearance.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-[1.25rem] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-outline-variant/30 pb-3 sm:mb-6 sm:pb-4">
              <h2 className="text-xl font-semibold text-on-surface sm:text-2xl">Required Documents</h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {requirements.map((req) => {
                const Icon = req.icon;

                return (
                  <div
                    key={req.label}
                    className="group rounded-xl border border-outline-variant bg-surface-bright p-3 transition-all duration-200 hover:border-primary/40 hover:shadow-sm sm:p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-error-container text-on-error-container sm:h-10 sm:w-10">
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-on-surface sm:text-lg">{req.label}</h3>
                          <p className="mt-1 text-xs text-on-surface-variant sm:text-sm">{req.description}</p>
                          <div className="mt-2 flex flex-wrap gap-2 sm:mt-3">
                            {req.formats.map((format) => (
                              <span
                                key={format}
                                className="inline-flex items-center rounded-md bg-surface-container px-2 py-1 text-xs font-semibold text-outline"
                              >
                                {format}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-24 rounded-[1.25rem] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
            <h2 className="border-b border-outline-variant/30 pb-3 text-xl font-semibold text-on-surface sm:pb-4 sm:text-2xl">
              Submission Checklist
            </h2>

            <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-outline-variant/30 pt-4">
              <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4">
                <Info className="mt-0.5 h-5 w-5 text-primary" />
                <p className="text-xs text-on-surface-variant">
                  All documents must be verified by the clinic staff before final clearance is granted.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
