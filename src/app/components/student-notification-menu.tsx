import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertCircle, Bell, Check, CheckCircle2, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react';
import type { StudentNotificationItem } from '../pages/student/student-notifications';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';

type StudentNotificationMenuProps = {
  notifications: StudentNotificationItem[];
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onMarkNotificationAsUnread: (notificationId: string) => void;
  onDeleteNotification: (notificationId: string) => void;
  onClearNotifications: () => void;
};

const notificationDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatNotificationTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return notificationDateFormatter.format(date);
}

export default function StudentNotificationMenu({
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onMarkNotificationAsUnread,
  onDeleteNotification,
  onClearNotifications,
}: StudentNotificationMenuProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const visibleNotifications = useMemo(
    () => (filter === 'unread' ? notifications.filter((notification) => !notification.read) : notifications),
    [filter, notifications],
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative inline-flex h-9 w-9 items-center justify-center rounded-full border text-on-surface-variant transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-on-surface hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:h-10 sm:w-10',
            open ? 'border-emerald-300 bg-white text-emerald-700 shadow-[0_10px_24px_rgba(15,23,42,0.08)]' : 'border-transparent',
          )}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          title="Notifications"
        >
          <Bell className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
          {unreadCount > 0 ? (
            <>
              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white sm:right-2 sm:top-2" />
              <span className="sr-only">{unreadCount} unread notifications</span>
            </>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={12}
        collisionPadding={12}
        className="mr-1 w-[calc(100vw-1.5rem)] max-w-[23.5rem] overflow-hidden rounded-[1.05rem] border border-emerald-100/90 bg-white p-0 text-slate-900 shadow-[0_22px_60px_rgba(15,23,42,0.18)] sm:mr-0 sm:w-[23.5rem]"
      >
        <div className="flex max-h-[min(42rem,calc(100vh-5.5rem))] min-h-[22rem] flex-col bg-[linear-gradient(180deg,#fbfffd_0%,#ffffff_42%)]">
          <header className="shrink-0 border-b border-emerald-50 px-4 pb-3 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[1.35rem] font-bold tracking-tight text-slate-950">Notifications</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} unread clinic update${unreadCount > 1 ? 's' : ''}` : 'Clinic updates for your submissions'}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                    aria-label="Notification options"
                    title="Notification options"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 border-emerald-100 bg-white p-1.5 shadow-lg">
                  <DropdownMenuItem
                    className="font-medium text-slate-700 focus:bg-emerald-50 focus:text-emerald-800"
                    disabled={unreadCount === 0}
                    onSelect={onMarkAllAsRead}
                  >
                    <Check className="h-4 w-4" />
                    Mark all as read
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="font-medium text-red-600 focus:bg-red-50 focus:text-red-700"
                    disabled={notifications.length === 0}
                    onSelect={() => setClearConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear all notifications
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  'inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition',
                  filter === 'all'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition',
                  filter === 'unread'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
                onClick={() => setFilter('unread')}
              >
                Unread
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            {visibleNotifications.length === 0 ? (
              <div className="mx-2 my-6 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                  <Bell className="h-6 w-6" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-950">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {filter === 'unread'
                    ? 'New clinic updates will stay here until you mark them as read.'
                    : 'Updates will appear here when your medical records move forward.'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2 pb-1 pt-1">
                  <p className="text-[0.94rem] font-semibold text-slate-950">Earlier</p>
                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                        onClick={onMarkAllAsRead}
                      >
                        Mark all read
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      onClick={() => setClearConfirmOpen(true)}
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                {visibleNotifications.map((notification) => {
                  const isApproved = notification.status === 'approved';

                  return (
                    <article
                      key={notification.id}
                      className={cn(
                        'group relative rounded-xl px-2 py-2.5 transition hover:bg-emerald-50/70',
                        !notification.read && 'bg-emerald-50/80',
                      )}
                    >
                      <div className="flex items-start gap-3 pr-5">
                        <div className="relative shrink-0">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-100">
                            <Bell className="h-6 w-6" />
                          </div>
                          <span
                            className={cn(
                              'absolute -bottom-0.5 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-white shadow-md',
                              isApproved ? 'bg-emerald-600' : 'bg-amber-500',
                            )}
                            aria-hidden="true"
                          >
                            {isApproved ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-[0.91rem] leading-5 text-slate-700">
                            <span className="font-semibold text-slate-950">{notification.title}</span>
                            <span> {notification.message}</span>
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-emerald-700">
                            <span>
                              {notification.yearLabel}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>{formatNotificationTimestamp(notification.timestamp)}</span>
                          </div>

                          {notification.note ? (
                            <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Staff Note</p>
                              <p className="mt-1 text-sm leading-5 text-slate-700">{notification.note}</p>
                            </div>
                          ) : null}

                          <button
                            type="button"
                            className={cn(
                              'mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition hover:bg-white',
                              isApproved
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300'
                                : 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300',
                            )}
                            onClick={() => {
                              if (!notification.read) {
                                onMarkAllAsRead();
                              }
                              setOpen(false);
                              navigate(notification.actionPath);
                            }}
                          >
                            {notification.actionLabel}
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:bg-slate-100 focus-visible:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                            aria-label={`Open actions for notification: ${notification.title}`}
                            title="Notification actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 border-slate-200 bg-white p-1.5 shadow-lg">
                          <DropdownMenuItem
                            className="font-medium text-slate-700 focus:bg-emerald-50 focus:text-emerald-800"
                            disabled={!notification.read}
                            onSelect={() => onMarkNotificationAsUnread(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                            Mark as unread
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="font-medium text-red-600 focus:bg-red-50 focus:text-red-700"
                            onSelect={() => onDeleteNotification(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete this notification
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {!notification.read ? (
                        <span
                          className="absolute right-4 top-12 h-3 w-3 rounded-full bg-emerald-500"
                          aria-hidden="true"
                        />
                      ) : null}
                    </article>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </PopoverContent>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove every notification from your list. New clinic updates will still appear when your records change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                onClearNotifications();
                setFilter('all');
              }}
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Popover>
  );
}
