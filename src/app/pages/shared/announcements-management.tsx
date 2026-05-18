import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAnnouncement,
  deleteAnnouncement,
  getManagedAnnouncements,
  updateAnnouncement,
  uploadAnnouncementImage,
  type AnnouncementUpsertInput,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';

type ManagementMode = 'staff' | 'admin';

type FormState = {
  id?: string;
  title: string;
  description: string;
  datePosted: string;
  isPublished: boolean;
  imagePath: string;
};

type ConfirmAction = {
  type: 'delete' | 'discard';
  itemId?: string;
  itemTitle?: string;
};

const initialForm: FormState = {
  title: '',
  description: '',
  datePosted: new Date().toISOString().slice(0, 10),
  isPublished: true,
  imagePath: '',
};

function ConfirmationModal({
  action,
  isOpen,
  isPending,
  onConfirm,
  onCancel,
}: {
  action: ConfirmAction | null;
  isOpen: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen || !action) return null;

  const isDelete = action.type === 'delete';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              isDelete ? 'bg-rose-100' : 'bg-amber-100'
            }`}
          >
            <span className={`text-xl ${isDelete ? 'text-rose-600' : 'text-amber-600'}`}>
              {isDelete ? '⚠️' : '❓'}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-on-surface">
              {isDelete ? 'Delete Announcement?' : 'Discard Changes?'}
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              {isDelete
                ? `This will permanently delete "${action.itemTitle}". This action cannot be undone.`
                : 'You have unsaved changes. Are you sure you want to discard them?'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-lg border border-outline-variant/40 px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-60 ${
              isDelete
                ? 'bg-rose-600 hover:bg-rose-700 active:scale-95'
                : 'bg-amber-600 hover:bg-amber-700 active:scale-95'
            }`}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {isDelete ? 'Deleting...' : 'Discarding...'}
              </span>
            ) : isDelete ? (
              'Delete'
            ) : (
              'Discard'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementsManagement({ mode }: { mode: ManagementMode }) {
  const queryClient = useQueryClient();
  const { me, session } = useAuth();
  const authUserId = String(session?.user?.id || me?.profile.id || '');
  const isAdmin = mode === 'admin';

  const [form, setForm] = useState<FormState>(initialForm);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const announcementsQuery = useQuery({
    queryKey: ['managedAnnouncements', mode],
    queryFn: getManagedAnnouncements,
    staleTime: 30_000,
  });

  const announcements = useMemo(() => {
    const rows = announcementsQuery.data?.announcements || [];
    if (isAdmin) return rows;
    return rows.filter((item: any) => String(item.createdBy || '') === authUserId);
  }, [announcementsQuery.data?.announcements, isAdmin, authUserId]);

  const saveMutation = useMutation({
    mutationFn: async (payload: AnnouncementUpsertInput) => {
      if (form.id) {
        return updateAnnouncement(form.id, payload);
      }
      return createAnnouncement(payload);
    },
    onSuccess: async () => {
      setForm(initialForm);
      setErrorMessage('');
      await queryClient.invalidateQueries({ queryKey: ['managedAnnouncements'] });
      await queryClient.invalidateQueries({ queryKey: ['studentAnnouncements'] });
    },
    onError: (error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save announcement.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteAnnouncement(id),
    onSuccess: async () => {
      setForm(initialForm);
      setConfirmAction(null);
      setIsConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['managedAnnouncements'] });
      await queryClient.invalidateQueries({ queryKey: ['studentAnnouncements'] });
    },
    onError: (error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete announcement.');
      setConfirmAction(null);
      setIsConfirmOpen(false);
    },
  });

  const onUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !authUserId) return;
    setUploading(true);
    setErrorMessage('');
    try {
      const result = await uploadAnnouncementImage(file, authUserId);
      setForm((prev) => ({ ...prev, imagePath: result.imagePath }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    saveMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      datePosted: form.datePosted,
      isPublished: form.isPublished,
      imagePath: form.imagePath.trim() || null,
    });
  };

  const handleEditClick = (item: any) => {
    setForm({
      id: item.id,
      title: item.title || '',
      description: item.description || '',
      datePosted: String(item.datePosted || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      isPublished: Boolean(item.isPublished),
      imagePath: item.imagePath || '',
    });
  };

  const handleDeleteClick = (item: any) => {
    setConfirmAction({
      type: 'delete',
      itemId: item.id,
      itemTitle: item.title,
    });
    setIsConfirmOpen(true);
  };

  const handleResetClick = () => {
    if (form.title.trim() || form.description.trim()) {
      setConfirmAction({
        type: 'discard',
      });
      setIsConfirmOpen(true);
    } else {
      setForm(initialForm);
    }
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'delete' && confirmAction.itemId) {
      deleteMutation.mutate(confirmAction.itemId);
    } else if (confirmAction.type === 'discard') {
      setForm(initialForm);
      setConfirmAction(null);
      setIsConfirmOpen(false);
    }
  };

  const isFormDirty = form.title.trim() || form.description.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-container via-surface-container-lowest to-surface-container-lowest">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-8 space-y-3">
          <h1 className="text-3xl font-bold text-on-surface">
            {isAdmin ? 'Announcement Hub' : 'My Announcements'}
          </h1>
          <p className="text-on-surface-variant">
            {isAdmin
              ? 'Manage all announcements across the platform. Create, edit, and delete posts to keep everyone informed.'
              : 'Create and manage your own announcements. Share important updates and information with your audience.'}
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
          {/* Form Section */}
          <form
            onSubmit={onSubmit}
            className="space-y-6 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm ring-1 ring-outline-variant/10 sm:p-8"
          >
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter announcement title"
                className="w-full rounded-xl border border-outline-variant/30 bg-white px-4 py-3 text-sm text-on-surface placeholder-on-surface-variant/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">
                Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Write your announcement content here..."
                className="min-h-48 w-full rounded-xl border border-outline-variant/30 bg-white px-4 py-3 text-sm text-on-surface placeholder-on-surface-variant/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2">
                  Posted Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.datePosted}
                  onChange={(e) => setForm((prev) => ({ ...prev, datePosted: e.target.value }))}
                  className="w-full rounded-xl border border-outline-variant/30 bg-white px-4 py-3 text-sm text-on-surface transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-white px-4 py-3 w-full cursor-pointer transition-all hover:border-primary/50">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => setForm((prev) => ({ ...prev, isPublished: e.target.checked }))}
                    className="h-4 w-4 rounded-md border-outline-variant/50 text-primary cursor-pointer"
                  />
                  <span className="text-sm font-medium text-on-surface">Published</span>
                </label>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-dashed border-outline-variant/30 bg-surface-container/50 p-4">
              <label className="block">
                <span className="block text-sm font-semibold text-on-surface mb-2">📸 Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onUploadImage}
                  disabled={uploading}
                  className="w-full cursor-pointer text-sm text-on-surface-variant file:mr-3 file:rounded-lg file:border file:border-outline-variant/40 file:bg-primary/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20 disabled:opacity-60"
                />
              </label>
              {form.imagePath && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
                  <span className="text-sm text-green-700">✓ Image uploaded</span>
                  <span className="text-xs text-green-600 truncate">{form.imagePath}</span>
                </div>
              )}
              {uploading && (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  <span className="text-xs text-on-surface-variant">Uploading image...</span>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                <span className="text-lg">⚠️</span>
                <p className="text-sm text-rose-700">{errorMessage}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saveMutation.isPending || uploading}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {form.id ? 'Updating...' : 'Creating...'}
                  </span>
                ) : form.id ? (
                  'Update Announcement'
                ) : (
                  'Create Announcement'
                )}
              </button>
              <button
                type="button"
                onClick={handleResetClick}
                disabled={!isFormDirty}
                className="rounded-xl border border-outline-variant/40 px-4 py-3 text-sm font-medium text-on-surface transition-all hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Posts Section */}
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm ring-1 ring-outline-variant/10 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-on-surface">
                📝 Your Posts {announcements.length > 0 && <span className="ml-2 text-sm font-normal text-on-surface-variant">({announcements.length})</span>}
              </h3>
            </div>

            {announcementsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="space-y-3 text-center">
                  <div className="flex justify-center">
                    <span className="h-8 w-8 animate-spin rounded-full border-3 border-primary/30 border-t-primary" />
                  </div>
                  <p className="text-sm text-on-surface-variant">Loading announcements...</p>
                </div>
              </div>
            ) : announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/30 bg-surface-container/50 py-12">
                <span className="mb-3 text-3xl">📭</span>
                <p className="text-sm text-on-surface-variant">No announcements yet</p>
                <p className="mt-1 text-xs text-on-surface-variant">Create your first announcement using the form on the left</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                {announcements.map((item: any) => (
                  <div
                    key={item.id}
                    className="group rounded-xl border border-outline-variant/20 bg-surface-container/50 p-4 transition-all hover:border-outline-variant/40 hover:bg-surface-container/80"
                  >
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-on-surface line-clamp-2">{item.title}</p>
                        <p className="mt-2 line-clamp-3 text-sm text-on-surface-variant">{item.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-block rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            {item.datePosted}
                          </span>
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                              item.isPublished
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {item.isPublished ? '✓ Published' : '⏸ Draft'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleEditClick(item)}
                        className="flex-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-all hover:bg-primary/10 active:scale-95"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(item)}
                        disabled={deleteMutation.isPending}
                        className="flex-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition-all hover:bg-rose-100 active:scale-95 disabled:opacity-60"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmationModal
        action={confirmAction}
        isOpen={isConfirmOpen}
        isPending={saveMutation.isPending || deleteMutation.isPending}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setConfirmAction(null);
          setIsConfirmOpen(false);
        }}
      />
    </div>
  );
}