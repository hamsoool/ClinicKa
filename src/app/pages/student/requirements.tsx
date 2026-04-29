import { Circle, CheckCircle2, FileText, FlaskConical, Info, Upload } from 'lucide-react';

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
  { label: 'Physical Examination Form', status: 'approved', detail: 'Approved on Oct 12, 2023' },
  { label: 'Chest X-Ray', status: 'pending', detail: 'Pending Upload' },
  { label: 'Complete Blood Count', status: 'pending', detail: 'Pending Upload' },
  { label: 'Urinalysis', status: 'pending', detail: 'Pending Upload' },
];

export default function StudentRequirements() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Submission Requirements</h1>
        <p className="mt-2 text-base text-on-surface-variant">
          Please upload the required medical documents to complete your clinical clearance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-[1.25rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
            <div className="mb-6 flex items-center justify-between border-b border-outline-variant/30 pb-4">
              <h2 className="text-2xl font-semibold text-on-surface">Required Documents</h2>
              <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">
                {requirements.length} Missing
              </span>
            </div>

            <div className="space-y-4">
              {requirements.map((req) => {
                const Icon = req.icon;

                return (
                  <div
                    key={req.label}
                    className="group rounded-xl border border-outline-variant bg-surface-bright p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error-container text-on-error-container">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-on-surface">{req.label}</h3>
                          <p className="mt-1 text-sm text-on-surface-variant">{req.description}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
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

                      <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container">
                        <Upload className="h-4 w-4" />
                        Browse Files
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-24 rounded-[1.25rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
            <h2 className="border-b border-outline-variant/30 pb-4 text-2xl font-semibold text-on-surface">
              Submission Checklist
            </h2>

            <div className="mt-5 space-y-4">
              {checklist.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-start gap-3 ${item.status === 'pending' ? 'opacity-60' : ''}`}
                >
                  {item.status === 'approved' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 text-outline" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                    <p
                      className={`text-xs ${
                        item.status === 'approved'
                          ? 'text-on-surface-variant'
                          : 'text-on-error-container'
                      }`}
                    >
                      {item.detail}
                    </p>
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
