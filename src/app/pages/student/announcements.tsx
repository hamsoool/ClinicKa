import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import StudentPageIntro from '../../components/student-page-intro';
import { getStudentAnnouncements, type StudentAnnouncement } from '../../lib/api';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return dateFormatter.format(parsed);
}

export default function StudentAnnouncements() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['studentAnnouncements'],
    queryFn: getStudentAnnouncements,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  const announcements = useMemo(() => data?.announcements || [], [data?.announcements]);
  const [selectedId, setSelectedId] = useState<string>('');
  const pageIntro = (
    <StudentPageIntro
      title="Announcements"
    />
  );

  const selectedAnnouncement: StudentAnnouncement | undefined = useMemo(() => {
    if (!announcements.length) return undefined;
    if (!selectedId) return announcements[0];
    return announcements.find((item) => item.id === selectedId) || announcements[0];
  }, [announcements, selectedId]);

  if (isLoading) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-[100rem] space-y-5 sm:space-y-8">
        {pageIntro}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
          We could not load announcements right now. Please try again in a moment.
        </div>
      </div>
    );
  }

  if (!announcements.length) {
    return (
      <div className="mx-auto w-full max-w-[100rem] space-y-5 sm:space-y-8">
        {pageIntro}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
          No announcements posted yet.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5 sm:space-y-8">
      {pageIntro}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(24rem,0.75fr)] xl:items-start">
        <article className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6">
          {selectedAnnouncement?.imageUrl ? (
            <img
              src={selectedAnnouncement.imageUrl}
              alt={selectedAnnouncement.title}
              className="mb-4 h-auto w-full rounded-xl border border-outline-variant/20 object-contain"
            />
          ) : null}
          <h2 className="text-2xl font-bold text-on-surface">{selectedAnnouncement?.title}</h2>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant">
            Date Posted: {formatDate(selectedAnnouncement?.datePosted)}
          </p>
          <p className="mt-5 whitespace-pre-line text-base leading-8 text-on-surface">
            {selectedAnnouncement?.description}
          </p>
        </article>

        <section className="space-y-3 xl:sticky xl:top-24">
          {announcements.map((item) => {
            const isActive = item.id === (selectedAnnouncement?.id || '');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border bg-surface-container-lowest p-3 text-left transition-colors ${
                  isActive
                    ? 'border-primary/40 ring-2 ring-primary/20'
                    : 'border-outline-variant/30 hover:bg-surface-container'
                }`}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-lg border border-outline-variant/20 object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-lg border border-outline-variant/20 bg-surface-container" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface-variant">
                    Date Posted: {formatDate(item.datePosted)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xl leading-8 text-on-surface">{item.title}</p>
                </div>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}
