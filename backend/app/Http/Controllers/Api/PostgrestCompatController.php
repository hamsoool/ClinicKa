<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\ArchivedAccount;
use App\Models\AuditLog;
use App\Models\Certificate;
use App\Models\EmergencyContact;
use App\Models\FileRecord;
use App\Models\LabCbc;
use App\Models\LabChestXray;
use App\Models\LabUrinalysis;
use App\Models\MedicalHistory;
use App\Models\OcrCallLog;
use App\Models\Profile;
use App\Models\StaffMeasurement;
use App\Models\StaffUser;
use App\Models\Student;
use App\Models\StudentNotification;
use App\Models\Submission;
use App\Models\SystemSetting;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PostgrestCompatController extends Controller
{
    /**
     * Map PostgREST table name to Eloquent model class.
     */
    protected array $tableModelMap = [
        'profiles' => Profile::class,
        'students' => Student::class,
        'staff_users' => StaffUser::class,
        'submissions' => Submission::class,
        'emergency_contacts' => EmergencyContact::class,
        'medical_history' => MedicalHistory::class,
        'staff_measurements' => StaffMeasurement::class,
        'lab_chest_xray' => LabChestXray::class,
        'lab_cbc' => LabCbc::class,
        'lab_urinalysis' => LabUrinalysis::class,
        'certificates' => Certificate::class,
        'files' => FileRecord::class,
        'announcements' => Announcement::class,
        'student_notifications' => StudentNotification::class,
        'notifications' => StudentNotification::class,
        'archived_accounts' => ArchivedAccount::class,
        'ocr_calls_log' => OcrCallLog::class,
        'audit_logs' => AuditLog::class,
        'system_settings' => SystemSetting::class,
    ];

    /**
     * Handle generic PostgREST query compatibility requests.
     */
    public function handle(Request $request, string $table): JsonResponse|Response
    {
        $normalizedTable = strtolower(trim($table));
        if (! isset($this->tableModelMap[$normalizedTable])) {
            return response()->json(['error' => "Table '{$table}' not found in schema cache"], Response::HTTP_NOT_FOUND);
        }

        /** @var class-string<\Illuminate\Database\Eloquent\Model> $modelClass */
        $modelClass = $this->tableModelMap[$normalizedTable];

        // 1. Announcements & System Settings are public reads
        if ($normalizedTable === 'announcements') {
            $query = $modelClass::query()->where('is_published', true);
        } elseif ($normalizedTable === 'system_settings') {
            $query = $modelClass::query();
        } else {
            // 2. All medical and identity tables require authentication and strict student isolation
            $user = $request->user();
            if (! $user && $request->bearerToken()) {
                $pat = \Laravel\Sanctum\PersonalAccessToken::findToken($request->bearerToken());
                if ($pat) {
                    $user = $pat->tokenable;
                }
            }

            if (! $user) {
                return response()->json(['error' => 'Unauthenticated.'], Response::HTTP_UNAUTHORIZED);
            }

            if ($user->is_banned) {
                return response()->json(['error' => 'Account is deactivated.'], Response::HTTP_FORBIDDEN);
            }

            $query = $modelClass::query();

            // Strict Role-Based Data Isolation
            $isStaffOrAdmin = $user->isStaff();

            if (! $isStaffOrAdmin) {
                // Students can strictly NEVER access other students' medical records, photos, or signatures
                if ($normalizedTable === 'students') {
                    $query->where(function ($q) use ($user) {
                        $q->where('student_id', $user->student_id)
                          ->orWhere('profile_id', $user->id);
                    });
                } elseif ($normalizedTable === 'profiles') {
                    $query->where('id', $user->id);
                } elseif ($normalizedTable === 'submissions') {
                    $query->where('student_id', $user->student_id);
                } elseif ($normalizedTable === 'files') {
                    $query->where(function ($q) use ($user) {
                        $q->where('uploaded_by', $user->id)
                          ->orWhere('type', 'announcement');
                        if ($user->student_id) {
                            $subIds = Submission::where('student_id', $user->student_id)->pluck('id');
                            if ($subIds->isNotEmpty()) {
                                $q->orWhereIn('submission_id', $subIds);
                            }
                        }
                    });
                } elseif (in_array($normalizedTable, [
                    'emergency_contacts',
                    'medical_history',
                    'staff_measurements',
                    'lab_chest_xray',
                    'lab_cbc',
                    'lab_urinalysis',
                    'certificates',
                ], true)) {
                    $subIds = Submission::where('student_id', $user->student_id)->pluck('id');
                    $query->whereIn('submission_id', $subIds);
                } elseif ($normalizedTable === 'notifications' || $normalizedTable === 'student_notifications') {
                    $query->where('student_id', $user->student_id);
                } elseif ($normalizedTable === 'archived_accounts' || $normalizedTable === 'audit_logs' || $normalizedTable === 'ocr_calls_log') {
                    return response()->json(['error' => 'Forbidden.'], Response::HTTP_FORBIDDEN);
                }
            }

            // Enforce that only staff, doctors, and admins can modify announcements
            if ($normalizedTable === 'announcements' && in_array($request->method(), ['POST', 'PATCH', 'PUT', 'DELETE'], true)) {
                if (! $user->isStaff()) {
                    return response()->json(['error' => 'Forbidden. Only clinic staff, doctors, and admins can manage announcements.'], Response::HTTP_FORBIDDEN);
                }
            }
        }

        // Handle POST / Insert
        if ($request->isMethod('post')) {
            $data = $request->json()->all();
            if (empty($data)) {
                $data = $request->request->all() ?: $request->all();
            }

            $modelInstance = new $modelClass();
            $fillable = $modelInstance->getFillable();
            $primaryKey = $modelInstance->getKeyName();

            $cleanInput = function (array $item) use ($normalizedTable, $fillable) {
                if ($normalizedTable === 'announcements') {
                    if (isset($item['datePosted']) && !isset($item['date_posted'])) {
                        $item['date_posted'] = $item['datePosted'];
                    }
                    if (isset($item['imagePath']) && !isset($item['image_path'])) {
                        $item['image_path'] = $item['imagePath'];
                    }
                    if (isset($item['isPublished']) && !isset($item['is_published'])) {
                        $item['is_published'] = $item['isPublished'];
                    }
                }
                return !empty($fillable) ? array_intersect_key($item, array_flip($fillable)) : $item;
            };

            $onConflict = (string) $request->query('on_conflict', '');
            $prefer = (string) $request->header('Prefer', '');
            $isUpsert = $onConflict !== '' || str_contains($prefer, 'resolution=merge-duplicates');

            $upsertRecord = function (array $rawItem) use ($modelClass, $modelInstance, $cleanInput, $onConflict, $isUpsert, $primaryKey) {
                $cleaned = $cleanInput($rawItem);
                $matchAttributes = [];

                if (!empty($onConflict)) {
                    $conflictCols = array_filter(array_map('trim', explode(',', $onConflict)));
                    foreach ($conflictCols as $col) {
                        if (array_key_exists($col, $cleaned) && $cleaned[$col] !== null) {
                            $matchAttributes[$col] = $cleaned[$col];
                        } elseif (array_key_exists($col, $rawItem) && $rawItem[$col] !== null) {
                            $matchAttributes[$col] = $rawItem[$col];
                        }
                    }
                }

                if (empty($matchAttributes) && ($isUpsert || !$modelInstance->getIncrementing())) {
                    if (array_key_exists($primaryKey, $cleaned) && $cleaned[$primaryKey] !== null) {
                        $matchAttributes[$primaryKey] = $cleaned[$primaryKey];
                    } elseif (array_key_exists($primaryKey, $rawItem) && $rawItem[$primaryKey] !== null) {
                        $matchAttributes[$primaryKey] = $rawItem[$primaryKey];
                    }
                }

                if (!empty($matchAttributes)) {
                    $existing = $modelClass::where($matchAttributes)->first();
                    if ($existing) {
                        $existing->fill($cleaned);
                        $existing->save();
                        return $existing;
                    }
                }

                return $modelClass::create($cleaned);
            };

            if (isset($data[0]) && is_array($data[0])) {
                $inserted = [];
                foreach ($data as $item) {
                    $record = $upsertRecord($item);
                    $inserted[] = $record;
                }
                return response()->json($inserted, Response::HTTP_CREATED);
            }

            $record = $upsertRecord($data);

            if ($normalizedTable === 'announcements') {
                \Illuminate\Support\Facades\Cache::forget('student_published_announcements');
                AuditLog::logAction('ANNOUNCEMENT_CREATE', $user?->id, $user?->role, null, null, null, [
                    'announcement_id' => $record->id,
                    'title' => $record->title,
                ]);
            }

            return response()->json([$record], Response::HTTP_CREATED);
        }

        // Parse query params for filtering
        foreach ($request->query() as $key => $rawFilter) {
            if (in_array($key, ['select', 'order', 'limit', 'offset'], true)) {
                continue;
            }

            $filter = (string) $rawFilter;

            if (str_starts_with($filter, 'eq.')) {
                $val = substr($filter, 3);
                $query->where($key, $val === 'null' ? null : $val);
            } elseif ($filter === 'is.null') {
                $query->whereNull($key);
            } elseif ($filter === 'not.is.null' || $filter === 'is.not.null') {
                $query->whereNotNull($key);
            } elseif ($filter === 'is.true') {
                $query->where($key, true);
            } elseif ($filter === 'is.false') {
                $query->where($key, false);
            } elseif (str_starts_with($filter, 'not.eq.')) {
                $val = substr($filter, 7);
                $query->where($key, '!=', $val);
            } elseif (str_starts_with($filter, 'neq.')) {
                $val = substr($filter, 4);
                $query->where($key, '!=', $val);
            } elseif (str_starts_with($filter, 'gt.')) {
                $query->where($key, '>', substr($filter, 3));
            } elseif (str_starts_with($filter, 'gte.')) {
                $query->where($key, '>=', substr($filter, 4));
            } elseif (str_starts_with($filter, 'lt.')) {
                $query->where($key, '<', substr($filter, 3));
            } elseif (str_starts_with($filter, 'lte.')) {
                $query->where($key, '<=', substr($filter, 4));
            } elseif (str_starts_with($filter, 'ilike.')) {
                $val = str_replace('*', '%', substr($filter, 6));
                $query->where($key, 'LIKE', $val);
            } elseif (str_starts_with($filter, 'like.')) {
                $val = str_replace('*', '%', substr($filter, 5));
                $query->where($key, 'LIKE', $val);
            } elseif (str_starts_with($filter, 'not.ilike.')) {
                $val = str_replace('*', '%', substr($filter, 10));
                $query->where($key, 'NOT LIKE', $val);
            } elseif (str_starts_with($filter, 'not.in.(') && str_ends_with($filter, ')')) {
                $inner = substr($filter, 8, -1);
                $values = array_map(fn ($v) => trim($v, ' "\''), explode(',', $inner));
                $query->whereNotIn($key, $values);
            } elseif (str_starts_with($filter, 'in.(') && str_ends_with($filter, ')')) {
                $inner = substr($filter, 4, -1);
                $values = array_map(fn ($v) => trim($v, ' "\''), explode(',', $inner));
                $query->whereIn($key, $values);
            } elseif ($key === 'or') {
                // Basic or filter parsing e.g. (first_name.ilike.%foo%,last_name.ilike.%foo%)
                $trimmed = trim($filter, '()');
                $parts = explode(',', $trimmed);
                $query->where(function ($subQ) use ($parts) {
                    foreach ($parts as $clause) {
                        $cParts = explode('.ilike.', $clause, 2);
                        if (count($cParts) === 2) {
                            $subQ->orWhere($cParts[0], 'LIKE', str_replace('*', '%', $cParts[1]));
                        }
                    }
                });
            }
        }

        // Handle PATCH / PUT / Update
        if ($request->isMethod('patch') || $request->isMethod('put')) {
            $bodyData = $request->json()->all();
            if (empty($bodyData)) {
                $bodyData = $request->request->all();
            }

            $modelInstance = new $modelClass();
            $fillable = $modelInstance->getFillable();

            if ($normalizedTable === 'announcements') {
                if (isset($bodyData['datePosted']) && !isset($bodyData['date_posted'])) {
                    $bodyData['date_posted'] = $bodyData['datePosted'];
                }
                if (isset($bodyData['imagePath']) && !isset($bodyData['image_path'])) {
                    $bodyData['image_path'] = $bodyData['imagePath'];
                }
                if (isset($bodyData['isPublished']) && !isset($bodyData['is_published'])) {
                    $bodyData['is_published'] = $bodyData['isPublished'];
                }
            }

            $updateData = !empty($fillable) ? array_intersect_key($bodyData, array_flip($fillable)) : $bodyData;
            unset($updateData[$modelInstance->getKeyName()]);

            if (!empty($updateData)) {
                $query->update($updateData);
            }

            if ($normalizedTable === 'announcements') {
                \Illuminate\Support\Facades\Cache::forget('student_published_announcements');
                AuditLog::logAction('ANNOUNCEMENT_UPDATE', $user?->id, $user?->role);
            }

            $updated = (clone $query)->get();
            return response()->json($updated);
        }

        // Handle DELETE
        if ($request->isMethod('delete')) {
            if ($normalizedTable === 'announcements') {
                \Illuminate\Support\Facades\Cache::forget('student_published_announcements');
                AuditLog::logAction('ANNOUNCEMENT_DELETE', $user?->id, $user?->role);
            }

            $query->delete();
            return response()->json(['success' => true]);
        }

        // Count for Prefer: count=exact
        $isCountRequested = str_contains((string) $request->header('Prefer'), 'count=exact');
        $totalCount = $isCountRequested ? (clone $query)->count() : null;

        // Sorting
        if ($request->filled('order')) {
            $orderParts = explode(',', (string) $request->query('order'));
            foreach ($orderParts as $part) {
                $p = explode('.', trim($part));
                $column = $p[0];
                $direction = (isset($p[1]) && strtolower($p[1]) === 'asc') ? 'asc' : 'desc';
                $query->orderBy($column, $direction);
            }
        }

        // Limit & Offset
        if ($request->filled('limit')) {
            $query->limit((int) $request->query('limit'));
        }
        if ($request->filled('offset')) {
            $query->offset((int) $request->query('offset'));
        }

        // Select columns
        if ($request->filled('select') && $request->query('select') !== '*') {
            $selectCols = array_map('trim', explode(',', (string) $request->query('select')));
            // Filter out relation expressions if any
            $plainCols = array_filter($selectCols, fn ($c) => preg_match('/^[a-zA-Z0-9_]+$/', $c));
            if (! empty($plainCols)) {
                $query->select($plainCols);
            }
        }

        $results = $query->get();

        $response = response()->json($results);
        if ($totalCount !== null) {
            $response->headers->set('Content-Range', "0-0/{$totalCount}");
        }

        return $response;
    }
}
