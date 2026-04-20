import { useNavigate } from 'react-router';
import { Activity, ArrowRight, ShieldCheck, Stethoscope } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

const roles = [
  {
    title: 'Student',
    description: 'Open the student workspace to submit records and check medical clearance progress.',
    path: '/student',
    icon: Activity,
    accent: 'from-emerald-400/30 to-teal-300/10',
  },
  {
    title: 'Staff',
    description: 'Open the clinic staff workspace to review submissions and update medical findings.',
    path: '/staff',
    icon: Stethoscope,
    accent: 'from-lime-300/30 to-emerald-200/10',
  },
  {
    title: 'Admin',
    description: 'Open the administration workspace to manage users, reports, and clinic settings.',
    path: '/admin',
    icon: ShieldCheck,
    accent: 'from-teal-300/30 to-cyan-200/10',
  },
] as const;

export default function RoleSelection() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4fbf6] px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-64 w-64 rounded-full bg-emerald-300/25 blur-3xl" />
        <div className="absolute right-[-10rem] top-20 h-80 w-80 rounded-full bg-lime-200/35 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-teal-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex flex-col justify-between rounded-[2rem] border border-emerald-950/10 bg-[#0f3d2e] p-6 text-white shadow-[0_30px_80px_rgba(15,61,46,0.18)] sm:p-8 lg:p-10">
            <div className="space-y-8">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium tracking-[0.02em] text-emerald-50 backdrop-blur">
                <ShieldCheck className="h-4 w-4" />
                Gordon College Clinic Portal
              </div>

              <div className="space-y-5">
                <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-100/70">
                  Direct workspace access
                </p>
                <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
                  Choose a role and open the portal section you need.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-emerald-50/80 sm:text-lg">
                  Login is temporarily disabled. Use the buttons on the right to jump straight into the student, staff, or admin experience.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 text-sm text-emerald-50/75 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-semibold text-white">Student</p>
                <p className="mt-1">Medical forms, records, requirements, and clearance view.</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">Staff</p>
                <p className="mt-1">Submission review, measurements, certificates, and reports.</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">Admin</p>
                <p className="mt-1">System settings, staff management, user accounts, and reporting.</p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 self-center">
            {roles.map(({ title, description, path, icon: Icon, accent }) => (
              <Card
                key={title}
                className={`overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white/92 shadow-[0_24px_70px_rgba(20,83,45,0.12)] backdrop-blur`}
              >
                <div className={`h-2 bg-gradient-to-r ${accent}`} />
                <CardHeader className="space-y-4 px-7 pt-7 sm:px-8 sm:pt-8">
                  <div className="inline-flex w-fit rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-3xl font-semibold text-slate-900">{title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 px-7 pb-7 sm:px-8 sm:pb-8">
                  <p className="text-sm leading-6 text-slate-600">{description}</p>
                  <Button
                    type="button"
                    className="h-12 w-full rounded-2xl text-sm font-semibold"
                    onClick={() => navigate(path)}
                  >
                    Open {title}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
