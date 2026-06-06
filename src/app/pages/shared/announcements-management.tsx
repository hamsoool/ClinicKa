import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAnnouncement,
  deleteAnnouncement,
  getManagedAnnouncements,
  updateAnnouncement,
  uploadAnnouncementImage,
  type AnnouncementUpsertInput,
} from '../../lib/api';
import PortalPageIntro from '../../components/portal-page-intro';
import FilePickerButton from '../../components/file-picker-button';
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

type ManagedAnnouncement = {
  id: string;
  title: string;
  description: string;
  datePosted: string;
  imagePath?: string | null;
  imageUrl?: string | null;
  isPublished: boolean;
  createdBy?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

function createInitialForm(): FormState {
  return {
    title: '',
    description: '',
    datePosted: new Date().toISOString().slice(0, 10),
    isPublished: true,
    imagePath: '',
  };
}

function formatDateLabel(value?: string | null) {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

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
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              isDelete ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            <span className="text-sm font-semibold">{isDelete ? 'DEL' : 'ASK'}</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {isDelete ? 'Delete Announcement?' : 'Discard Changes?'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
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
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
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
  const defaultDatePosted = useMemo(() => createInitialForm().datePosted, []);

  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [localImagePreviewUrl, setLocalImagePreviewUrl] = useState('');

  useEffect(() => {
    return () => {
      if (localImagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(localImagePreviewUrl);
      }
    };
  }, [localImagePreviewUrl]);

  const announcementsQuery = useQuery({
    queryKey: ['managedAnnouncements', mode],
    queryFn: getManagedAnnouncements,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const resetForm = () => {
    setForm(createInitialForm());
    setLocalImagePreviewUrl('');
  };

  const announcements = useMemo<ManagedAnnouncement[]>(() => {
    const rows = announcementsQuery.data?.announcements || [];
    if (isAdmin) return rows;
    return rows.filter((item: ManagedAnnouncement) => item.isPublished || String(item.createdBy || '') === authUserId);
  }, [announcementsQuery.data?.announcements, isAdmin, authUserId]);

  const saveMutation = useMutation({
    mutationFn: async (payload: AnnouncementUpsertInput) => {
      if (form.id) {
        return updateAnnouncement(form.id, payload);
      }
      return createAnnouncement(payload);
    },
    onSuccess: async () => {
      resetForm();
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
      resetForm();
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

  const onUploadImage = async (file: File | null) => {
    if (!file || !authUserId) return;
    setLocalImagePreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setErrorMessage('');
    try {
      const result = await uploadAnnouncementImage(file, authUserId);
      setForm((prev) => ({ ...prev, imagePath: result.imagePath }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    saveMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      datePosted: form.id ? form.datePosted : new Date().toISOString().slice(0, 10),
      isPublished: form.isPublished,
      imagePath: form.imagePath.trim() || null,
    });
  };

  const handleEditClick = (item: ManagedAnnouncement) => {
    setForm({
      id: item.id,
      title: item.title || '',
      description: item.description || '',
      datePosted: String(item.datePosted || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      isPublished: Boolean(item.isPublished),
      imagePath: item.imagePath || '',
    });
    setLocalImagePreviewUrl(item.imageUrl || item.imagePath || '');
  };

  const handleDeleteClick = (item: ManagedAnnouncement) => {
    setConfirmAction({
      type: 'delete',
      itemId: item.id,
      itemTitle: item.title,
    });
    setIsConfirmOpen(true);
  };

  const handleResetClick = () => {
    const hasChanges = Boolean(
      form.id ||
        form.title.trim() ||
        form.description.trim() ||
        form.imagePath.trim() ||
        localImagePreviewUrl ||
        form.datePosted !== defaultDatePosted ||
        form.isPublished !== true,
    );

    if (hasChanges) {
      setConfirmAction({
        type: 'discard',
      });
      setIsConfirmOpen(true);
    } else {
      resetForm();
    }
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'delete' && confirmAction.itemId) {
      deleteMutation.mutate(confirmAction.itemId);
    } else if (confirmAction.type === 'discard') {
      resetForm();
      setConfirmAction(null);
      setIsConfirmOpen(false);
    }
  };

  const formPreviewUrl = localImagePreviewUrl || form.imagePath;
  const isOwner = (item: ManagedAnnouncement) => isAdmin || String(item.createdBy || '') === authUserId;
  const isFormDirty = Boolean(
    form.id ||
      form.title.trim() ||
      form.description.trim() ||
      form.imagePath.trim() ||
      localImagePreviewUrl ||
      form.datePosted !== defaultDatePosted ||
      form.isPublished !== true,
  );
  const formHeading = form.id ? 'Edit Announcement' : 'Create Announcement';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[100rem] px-4 py-8 sm:px-6">
        <PortalPageIntro
          className="mb-8"
          title="Announcements"
        />

        <section className="grid gap-6 xl:grid-cols-[minmax(22rem,24rem)_minmax(0,1fr)] xl:items-start">
          {/* Form Section */}
          <form
            onSubmit={onSubmit}
            className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:sticky xl:top-24"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                Staff Composer
              </p>
              <h2 className="text-xl font-semibold text-gray-900">{formHeading}</h2>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter announcement title"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-none focus:ring-4 focus:ring-green-500/15"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Write your announcement content here..."
                className="min-h-48 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-none focus:ring-4 focus:ring-green-500/15"
                required
              />
            </div>

            <div className="space-y-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
              <span className="block text-sm font-medium text-gray-700">Attach Image</span>
              <div className="space-y-3">
                <FilePickerButton
                  accept="image/*"
                  ariaLabel="Upload announcement image"
                  disabled={uploading}
                  loading={uploading}
                  className="w-full justify-center rounded-xl border border-green-200 bg-green-50 text-green-800 hover:bg-green-100 focus-within:border-green-500 focus-within:ring-green-500/20"
                  onFileSelected={onUploadImage}
                >
                  {uploading ? 'Uploading image...' : formPreviewUrl ? 'Replace image' : 'Upload image'}
                </FilePickerButton>
                {formPreviewUrl ? (
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <img
                      src={formPreviewUrl}
                      alt="Announcement preview"
                      className="h-56 max-h-56 w-full object-cover"
                    />
                    <div className="border-t border-gray-100 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {localImagePreviewUrl.startsWith('blob:') ? 'Selected image preview' : 'Attached image'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        This image will appear on the published announcement card.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center">
                    <p className="text-sm font-medium text-gray-700">No image selected</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Uploaded images will preview here before you save the post.
                    </p>
                  </div>
                )}
                {form.imagePath && (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                    <p className="text-sm font-medium text-green-800">Image ready for publishing</p>
                  </div>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                <span className="text-sm font-semibold text-rose-700">Error</span>
                <p className="text-sm text-rose-700">{errorMessage}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={saveMutation.isPending || uploading}
                className="flex-1 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Posts Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:min-h-[42rem]">
            <div className="mb-6 flex flex-col gap-2 border-b border-gray-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                  Content Library
                </p>
                <h3 className="text-xl font-semibold text-gray-900">
                  Posts
                  {announcements.length > 0 ? (
                    <span className="ml-3 inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                      {announcements.length}
                    </span>
                  ) : null}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Browse announcements from clinic staff and doctors. You can edit the ones you created.
                </p>
              </div>
            </div>

            {announcementsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="space-y-3 text-center">
                  <div className="flex justify-center">
                    <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-green-200 border-t-green-700" />
                  </div>
                  <p className="text-sm text-gray-500">Loading announcements...</p>
                </div>
              </div>
            ) : announcementsQuery.isError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-center">
                <p className="text-sm font-medium text-rose-700">Announcements could not be loaded.</p>
                <p className="mt-1 text-xs text-rose-600">Please refresh the page and try again.</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-12">
                <p className="text-sm font-medium text-gray-700">No announcements yet</p>
                <p className="mt-1 text-xs text-gray-500">Announcements from clinic staff and doctors will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[calc(100vh-260px)] overflow-y-auto pr-2">
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-colors hover:border-gray-300"
                  >
                    {item.imageUrl ? (
                      <div className="border-b border-gray-200 bg-slate-50">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="h-auto max-h-[38rem] w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-3 w-full bg-green-700" />
                    )}

                    <div className="p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                              {formatDateLabel(item.datePosted)}
                            </span>
                            {isOwner(item) ? (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                Your post
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 text-base font-semibold text-gray-900">{item.title}</p>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">{item.description}</p>
                        </div>
                      </div>

                      {isOwner(item) ? (
                        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => handleEditClick(item)}
                            className="flex-1 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800 transition-colors hover:bg-green-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/15"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(item)}
                            disabled={deleteMutation.isPending}
                            className="flex-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/15 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
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
