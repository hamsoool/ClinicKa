import { Skeleton } from './ui/skeleton';

type PublicSkeletonVariant = 'marketing' | 'auth';
type PortalPageSkeletonVariant = 'dashboard' | 'table' | 'certificate';

function PublicTopBarSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full bg-white/80" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 bg-white/80" />
          <Skeleton className="h-3 w-40 bg-white/60" />
        </div>
      </div>
      <Skeleton className="h-11 w-32 rounded-full bg-white/80" />
    </div>
  );
}

export function PublicPageSkeleton({ variant }: { variant: PublicSkeletonVariant }) {
  const isMarketing = variant === 'marketing';

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8f9ff_0%,#eff4ff_46%,#edf7f1_100%)] px-5 py-8 text-[#0b1c30] sm:px-8 lg:py-10"
      style={{ fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif' }}
    >
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-8rem] top-20 h-80 w-80 rounded-full bg-[#d9e8ff] blur-3xl" />
        <div className="absolute right-[-10rem] top-12 h-[28rem] w-[28rem] rounded-full bg-[#d4f0e2] blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
        <PublicTopBarSkeleton />

        <div className="grid flex-1 gap-10 py-10 lg:grid-cols-[1fr_0.96fr] lg:items-center">
          <div className="space-y-8">
            <Skeleton className="h-10 w-60 rounded-full bg-white/80" />

            <div className="space-y-4">
              <Skeleton className="h-14 w-full max-w-xl rounded-[1.75rem] bg-white/80 sm:h-16" />
              <Skeleton className="h-14 w-full max-w-lg rounded-[1.75rem] bg-white/70 sm:h-16" />
              <Skeleton className="h-5 w-full max-w-xl bg-white/70" />
              <Skeleton className="h-5 w-full max-w-lg bg-white/60" />
            </div>

            <div className={`grid gap-4 ${isMarketing ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {Array.from({ length: isMarketing ? 3 : 2 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[24px] border border-white/70 bg-white/70 p-5 shadow-[0_18px_45px_rgba(11,28,48,0.05)] backdrop-blur"
                >
                  <Skeleton className="h-3 w-16 bg-[#d9e8ff]" />
                  <Skeleton className="mt-4 h-4 w-28 bg-[#dfe9f4]" />
                  <Skeleton className="mt-4 h-3.5 w-full bg-[#e5edf6]" />
                  <Skeleton className="mt-2 h-3.5 w-5/6 bg-[#edf2f8]" />
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/76 p-4 shadow-[0_30px_80px_rgba(11,28,48,0.1)] backdrop-blur">
              <Skeleton className={`w-full rounded-[1.4rem] bg-[#dfe9f4] ${isMarketing ? 'h-[24rem]' : 'h-[20rem]'}`} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/84 p-5 shadow-[0_30px_80px_rgba(11,28,48,0.12)] backdrop-blur sm:min-h-[38rem] sm:p-8">
            <div className="flex flex-col gap-4 border-b border-[#dfebea] pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-3">
                <Skeleton className="h-3 w-28 bg-[#dfe9f4]" />
                <Skeleton className="h-10 w-56 rounded-2xl bg-[#ebf1f7]" />
                <Skeleton className="h-4 w-72 bg-[#edf2f8]" />
              </div>
              <Skeleton className="h-11 w-40 rounded-full bg-[#eef4ff]" />
            </div>

            <div className="space-y-5 pt-6">
              {Array.from({ length: isMarketing ? 4 : 3 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-28 bg-[#dfe9f4]" />
                  <Skeleton className="h-12 w-full rounded-2xl bg-[#f4f7fb]" />
                </div>
              ))}
              <Skeleton className="h-12 w-full rounded-full bg-[#d9f3e4]" />
              <Skeleton className="h-12 w-full rounded-full bg-white" />
              <Skeleton className="mx-auto h-4 w-40 bg-[#edf2f8]" />
            </div>
          </div>
        </div>
      </div>

      <span className="sr-only">Loading page...</span>
    </div>
  );
}

export function PortalShellSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4fcf2_45%,#eef6ec_100%)]"
    >
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <Skeleton className="h-10 w-10 rounded-md bg-primary/20" />
      </div>

      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-emerald-950/30 bg-sidebar px-4 py-6 text-sidebar-foreground shadow-2xl md:block">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 shadow-[0_12px_24px_rgba(0,0,0,0.16)] backdrop-blur">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full bg-white/20" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 bg-white/20" />
              <Skeleton className="h-3 w-24 bg-white/10" />
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-black/10 p-3">
            <Skeleton className="h-4 w-32 bg-white/15" />
            <Skeleton className="mt-2 h-3 w-28 bg-white/10" />
            <Skeleton className="mt-2 h-3 w-40 bg-white/10" />
          </div>
        </div>

        <div className="mt-6 space-y-2 px-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-md px-4 py-3">
              <Skeleton className="h-5 w-5 rounded bg-white/15" />
              <Skeleton className="h-4 w-28 bg-white/15" />
            </div>
          ))}
        </div>

        <div className="mt-auto px-2 pt-6">
          <div className="border-t border-white/10 pt-4">
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-md px-4 py-3">
                  <Skeleton className="h-5 w-5 rounded bg-white/15" />
                  <Skeleton className="h-4 w-24 bg-white/15" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 h-[4.5rem] border-b border-outline-variant/40 bg-white/90 backdrop-blur md:left-72 md:h-16">
        <div className="flex h-full items-center justify-between gap-3 px-3 pl-16 md:px-8 md:pl-8">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28 bg-surface-container-high" />
            <Skeleton className="h-4 w-36 bg-surface-container-high" />
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-10 rounded-md bg-surface-container-high" />
            ))}
            <Skeleton className="h-10 w-10 rounded-full bg-surface-container-high" />
          </div>
        </div>
      </header>

      <main className="pt-20 md:pl-72">
        <div className="px-4 pb-24 md:px-8">
          <PortalPageSkeleton variant="dashboard" />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-outline-variant/40 bg-surface-container-lowest/95 px-1.5 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex flex-col items-center gap-1 rounded-md px-1 py-1.5">
              <Skeleton className="h-5 w-5 rounded bg-surface-container-high" />
              <Skeleton className="h-2.5 w-10 bg-surface-container-high" />
            </div>
          ))}
        </div>
      </nav>

      <span className="sr-only">Loading portal...</span>
    </div>
  );
}

function DashboardCardSkeleton() {
  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24 bg-surface-container-high" />
          <Skeleton className="h-8 w-16 bg-surface-container-high" />
        </div>
        <Skeleton className="h-11 w-11 rounded-2xl bg-surface-container-high" />
      </div>
      <Skeleton className="mt-4 h-3.5 w-full bg-surface-container" />
    </div>
  );
}

export function PortalPageSkeleton({ variant }: { variant: PortalPageSkeletonVariant }) {
  if (variant === 'table') {
    return (
      <div aria-busy="true" aria-live="polite" className="mx-auto max-w-6xl space-y-8 pt-2">
        <div className="space-y-3">
          <Skeleton className="h-10 w-64 bg-white/80" />
          <Skeleton className="h-4 w-72 bg-white/70" />
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="space-y-2">
            <Skeleton className="h-6 w-52 bg-surface-container-high" />
            <Skeleton className="h-4 w-64 bg-surface-container" />
          </div>
          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-4 rounded-xl border border-outline-variant/20 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl bg-surface-container-high" />
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-44 bg-surface-container-high" />
                    <Skeleton className="h-3.5 w-32 bg-surface-container" />
                    <Skeleton className="h-3.5 w-56 bg-surface-container" />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <Skeleton className="h-7 w-28 rounded-full bg-surface-container-high" />
                  <Skeleton className="h-10 w-36 rounded-xl bg-surface-container-high" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'certificate') {
    return (
      <div aria-busy="true" aria-live="polite" className="mx-auto max-w-6xl space-y-8 pt-2">
        <div className="space-y-3">
          <Skeleton className="h-10 w-72 bg-white/80" />
          <Skeleton className="h-4 w-80 bg-white/70" />
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-full bg-surface-container-high" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-5 w-52 bg-surface-container-high" />
              <Skeleton className="h-4 w-full max-w-2xl bg-surface-container" />
              <Skeleton className="h-8 w-32 rounded-full bg-surface-container-high" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-6 w-56 bg-surface-container-high" />
              <Skeleton className="h-4 w-40 bg-surface-container" />
            </div>
            <Skeleton className="h-10 w-36 rounded-xl bg-surface-container-high" />
          </div>
          <Skeleton className="mt-6 h-[26rem] w-full rounded-xl bg-surface-container-high" />
        </div>
      </div>
    );
  }

  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto max-w-6xl space-y-8 pt-2">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Skeleton className="h-8 w-40 rounded-full bg-[#d9f3e4]" />
            <Skeleton className="h-10 w-full max-w-md bg-[#e7edf3]" />
            <Skeleton className="h-4 w-full max-w-2xl bg-[#eef2f6]" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-9 w-36 rounded-full bg-surface-container-high" />
              <Skeleton className="h-9 w-40 rounded-full bg-surface-container-high" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 w-full min-w-[13rem] rounded-2xl bg-surface-container-high" />
            <Skeleton className="h-24 w-full min-w-[13rem] rounded-2xl bg-surface-container-high" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <DashboardCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6 space-y-2">
            <Skeleton className="h-6 w-44 bg-surface-container-high" />
            <Skeleton className="h-4 w-72 bg-surface-container" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-start gap-4 rounded-2xl border border-outline-variant/20 p-4">
                <Skeleton className="h-12 w-12 rounded-xl bg-surface-container-high" />
                <div className="min-w-0 flex-1 space-y-3">
                  <Skeleton className="h-4 w-40 bg-surface-container-high" />
                  <Skeleton className="h-3.5 w-52 bg-surface-container" />
                  <Skeleton className="h-3.5 w-36 bg-surface-container" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6 space-y-2">
            <Skeleton className="h-6 w-48 bg-surface-container-high" />
            <Skeleton className="h-4 w-56 bg-surface-container" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-28 bg-surface-container-high" />
                  <Skeleton className="h-4 w-12 bg-surface-container" />
                </div>
                <Skeleton className="h-2 w-full rounded-full bg-surface-container-high" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]"
          >
            <div className="mb-6 space-y-2">
              <Skeleton className="h-6 w-44 bg-surface-container-high" />
              <Skeleton className="h-4 w-64 bg-surface-container" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-4 rounded-xl border border-outline-variant/20 p-3">
                  <Skeleton className="h-10 w-10 rounded-lg bg-surface-container-high" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-36 bg-surface-container-high" />
                    <Skeleton className="h-3.5 w-28 bg-surface-container" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full bg-surface-container-high" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
