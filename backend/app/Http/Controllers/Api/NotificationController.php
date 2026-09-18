<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Models\StudentNotification;
use App\Models\Submission;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class NotificationController extends Controller
{
    public function getNotifications(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $studentId = $request->query('studentId') ?: ($user ? $user->student_id : null);

        if (! $studentId) {
            return response()->json(['items' => [], 'unreadCount' => 0]);
        }

        $query = StudentNotification::where('student_id', $studentId)
            ->whereNull('deleted_at')
            ->orderByDesc('occurred_at');

        $items = $query->limit(50)->get()->map(fn ($n) => [
            'id' => $n->id,
            'studentId' => $n->student_id,
            'submissionId' => $n->submission_id,
            'status' => $n->status,
            'title' => $n->title,
            'message' => $n->message,
            'note' => $n->note,
            'actionLabel' => $n->action_label,
            'actionPath' => $n->action_path,
            'yearLabel' => $n->year_label,
            'occurredAt' => $n->occurred_at ? $n->occurred_at->toIso8601String() : null,
            'isRead' => (bool) $n->is_read,
        ]);

        $unreadCount = StudentNotification::where('student_id', $studentId)
            ->whereNull('deleted_at')
            ->where('is_read', false)
            ->count();

        return response()->json([
            'items' => $items,
            'unreadCount' => $unreadCount,
        ]);
    }

    public function getState(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $studentId = $request->query('studentId') ?: ($user ? $user->student_id : null);

        if (! $studentId) {
            return response()->json(['unreadCount' => 0]);
        }

        $unread = StudentNotification::where('student_id', $studentId)
            ->whereNull('deleted_at')
            ->where('is_read', false)
            ->count();

        return response()->json(['unreadCount' => $unread]);
    }

    public function updateState(Request $request): JsonResponse
    {
        return response()->json(['success' => true]);
    }

    public function syncNotifications(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $studentId = $request->input('studentId') ?: ($user ? $user->student_id : null);

        if (! $studentId) {
            return response()->json(['success' => true, 'synced' => 0]);
        }

        $submissions = Submission::where('student_id', $studentId)
            ->whereIn('status', ['approved', 'returned'])
            ->get();

        $synced = 0;
        foreach ($submissions as $sub) {
            $isApproved = $sub->status === 'approved';
            $notifKey = "sub_{$sub->id}_{$sub->status}";

            StudentNotification::firstOrCreate(
                [
                    'student_id' => $sub->student_id,
                    'notification_key' => $notifKey,
                ],
                [
                    'submission_id' => $sub->id,
                    'status' => $sub->status,
                    'title' => $isApproved ? 'Medical Clearance Approved' : 'Medical Submission Returned',
                    'message' => $isApproved
                        ? 'Your medical record clearance has been approved by the clinic staff.'
                        : 'Your medical record was returned with notes. Please review and update your submission.',
                    'note' => $sub->staff_notes,
                    'action_label' => $isApproved ? 'View Certificate' : 'Review Notes',
                    'action_path' => '/dashboard',
                    'year_label' => (string) $sub->year_level,
                    'occurred_at' => $sub->updated_at ?: now(),
                    'is_read' => false,
                ]
            );
            $synced++;
        }

        return response()->json(['success' => true, 'synced' => $synced]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $studentId = $request->input('studentId') ?: ($user ? $user->student_id : null);

        if ($studentId) {
            StudentNotification::where('student_id', $studentId)
                ->where('is_read', false)
                ->update(['is_read' => true]);
        }

        return response()->json(['success' => true]);
    }

    public function updateNotification(Request $request, string $id): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $studentId = $user?->student_id;

        $notif = StudentNotification::where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if (! $notif) {
            return response()->json(['error' => 'Notification not found.'], 404);
        }

        if ($user && ! $user->isStaff() && $notif->student_id !== $studentId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        if ($request->has('read')) {
            $notif->is_read = (bool) $request->input('read');
        }
        if ($request->has('is_read')) {
            $notif->is_read = (bool) $request->input('is_read');
        }

        $notif->save();

        return response()->json([
            'notification' => [
                'id' => $notif->id,
                'studentId' => $notif->student_id,
                'submissionId' => $notif->submission_id,
                'status' => $notif->status,
                'title' => $notif->title,
                'message' => $notif->message,
                'note' => $notif->note,
                'actionLabel' => $notif->action_label,
                'actionPath' => $notif->action_path,
                'yearLabel' => $notif->year_label,
                'occurredAt' => $notif->occurred_at ? $notif->occurred_at->toIso8601String() : null,
                'isRead' => (bool) $notif->is_read,
            ],
        ]);
    }

    public function deleteNotification(Request $request, string $id): JsonResponse
    {
        $notif = StudentNotification::find($id);
        if ($notif) {
            $notif->deleted_at = now();
            $notif->save();
        }

        return response()->json(['success' => true]);
    }

    public function clearNotifications(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $studentId = $request->input('studentId') ?: ($user ? $user->student_id : null);

        if ($studentId) {
            StudentNotification::where('student_id', $studentId)
                ->where('is_read', true)
                ->update(['deleted_at' => now()]);
        }

        return response()->json(['success' => true]);
    }

    public function sendStatusEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'studentName' => ['nullable', 'string'],
            'status' => ['required', 'string'],
            'staffNotes' => ['nullable', 'string'],
        ]);

        $enabled = SystemSetting::getVal('smtp_notifications_enabled', 'true') === 'true';
        if (! $enabled) {
            return response()->json(['success' => true, 'skipped' => true]);
        }

        $status = ucfirst($validated['status']);
        $name = $validated['studentName'] ?: 'Student';
        $notes = ! empty($validated['staffNotes']) ? "\n\nClinic Staff Notes: {$validated['staffNotes']}" : '';

        try {
            Mail::raw("Hello {$name},\n\nYour ClinicKa medical record status has been updated to: {$status}.{$notes}\n\nPlease log in to ClinicKa to review your records.", function ($msg) use ($validated, $status) {
                $msg->to($validated['email'])->subject("ClinicKa Medical Clearance Status Update: {$status}");
            });
        } catch (\Throwable $e) {
            \Log::warning("Failed to send status update email to {$validated['email']}: " . $e->getMessage());
        }

        return response()->json(['success' => true]);
    }
}
