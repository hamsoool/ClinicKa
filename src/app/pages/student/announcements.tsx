import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Maximize2, X } from 'lucide-react';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import StudentPageIntro from '../../components/student-page-intro';
import ListPagination from '../../components/list-pagination';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const pageSize = 5;

  const totalPages = Math.max(1, Math.ceil(announcements.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedAnnouncements = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return announcements.slice(start, start + pageSize);
  }, [announcements, activePage]);

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

  const handleSelectAnnouncement = (id: string) => {
    setSelectedId(id);
    if (window.innerWidth < 1280 && articleRef.current) {
      articleRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (isLoading) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  if (isError) {
    return (
      <div className="w-full min-w-0 space-y-8">
        {pageIntro}
        <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
          We could not load announcements right now. Please try again in a moment.
        </div>
      </div>
    );
  }

  if (!announcements.length) {
    return (
      <div className="w-full min-w-0 space-y-8">
        {pageIntro}
        <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
          No announcements posted yet.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-8">
      {pageIntro}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)] xl:items-start">
        <article
          ref={articleRef}
          className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-5 sm:p-7 shadow-sm"
        >
          <div className="border-b border-outline-variant/20 pb-4">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-on-surface-variant">
              <Calendar className="h-4 w-4 shrink-0 text-primary" />
              <span>Date Posted: {formatDate(selectedAnnouncement?.datePosted)}</span>
            </div>
            <h2 className="mt-2.5 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-on-surface">
              {selectedAnnouncement?.title}
            </h2>
          </div>

          {selectedAnnouncement?.imageUrl ? (
            <div
              onClick={() => setIsImageModalOpen(true)}
              className="group relative mt-5 flex max-h-[380px] sm:max-h-[440px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[14px] border border-outline-variant/20 bg-surface-container-low/40 p-2 transition-colors hover:bg-surface-container-low"
              title="Click to enlarge image"
            >
              <img
                src={selectedAnnouncement.imageUrl}
                alt={selectedAnnouncement.title}
                className="max-h-[360px] sm:max-h-[420px] w-full rounded-lg object-contain"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Enlarge</span>
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <p className="whitespace-pre-line text-sm sm:text-base leading-relaxed text-on-surface">
              {selectedAnnouncement?.description}
            </p>
          </div>
        </article>

        <section className="space-y-4 xl:sticky xl:top-24">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
            All Announcements
          </h3>
          <div className="space-y-3">
            {paginatedAnnouncements.map((item) => {
              const isActive = item.id === (selectedAnnouncement?.id || '');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectAnnouncement(item.id)}
                  className={`flex w-full items-start gap-3 rounded-[18px] border bg-surface-container-lowest p-3 text-left transition-all ${
                    isActive
                      ? 'border-primary/50 ring-2 ring-primary/20 bg-primary/[0.03]'
                      : 'border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg border border-outline-variant/20 object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg border border-outline-variant/20 bg-surface-container" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-on-surface-variant">
                      {formatDate(item.datePosted)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-on-surface">
                      {item.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <ListPagination
            currentPage={activePage}
            totalPages={totalPages}
            totalItems={announcements.length}
            pageSize={pageSize}
            pageSizeOptions={[pageSize]}
            itemLabel="announcements"
            onPageChange={setCurrentPage}
            onPageSizeChange={() => undefined}
          />
        </section>
      </div>

      {isImageModalOpen && selectedAnnouncement?.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in-0"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div className="relative max-h-[90vh] max-w-5xl">
            <button
              type="button"
              onClick={() => setIsImageModalOpen(false)}
              className="absolute -top-10 right-0 flex items-center gap-1 text-sm font-medium text-white hover:text-neutral-300"
            >
              <X className="h-5 w-5" />
              <span>Close</span>
            </button>
            <img
              src={selectedAnnouncement.imageUrl}
              alt={selectedAnnouncement.title}
              className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
