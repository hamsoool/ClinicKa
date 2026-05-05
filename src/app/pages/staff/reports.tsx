import ReportsDashboard from '../../components/reports/reports-dashboard';

export default function StaffReports() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <h2 className="text-2xl font-bold tracking-tight text-on-surface">Reporting Workspace</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Review clinic trends, filter submissions, and export professional PDF summaries.
        </p>
      </div>
      <ReportsDashboard mode="staff" />
    </div>
  );
}

