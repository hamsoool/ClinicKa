<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Submission extends Model
{
    protected $table = 'submissions';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    const CREATED_AT = 'submitted_at';
    const UPDATED_AT = 'updated_at';

    protected $fillable = [
        'id',
        'student_id',
        'first_name',
        'last_name',
        'middle_initial',
        'course',
        'department',
        'year_level',
        'academic_year',
        'status',
        'reviewed_by',
        'submitted_at',
        'staff_notes',
        'age',
        'sex',
        'birthday',
        'civil_status',
        'contact_number',
        'address',
        'allergy_details',
        'had_operation',
        'operation_details',
        'blood_pressure',
        'weight',
        'height',
        'bmi',
        'lab_test_location',
        'lab_test_clinic',
        'cbc_test_clinic',
        'urinalysis_test_clinic',
        'xray_test_clinic',
    ];

    protected function casts(): array
    {
        return [
            'birthday' => 'date:Y-m-d',
            'submitted_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }

    public function emergencyContact(): HasOne
    {
        return $this->hasOne(EmergencyContact::class, 'submission_id', 'id');
    }

    public function medicalHistory(): HasOne
    {
        return $this->hasOne(MedicalHistory::class, 'submission_id', 'id');
    }

    public function staffMeasurements(): HasOne
    {
        return $this->hasOne(StaffMeasurement::class, 'submission_id', 'id');
    }

    public function chestXray(): HasOne
    {
        return $this->hasOne(LabChestXray::class, 'submission_id', 'id');
    }

    public function cbc(): HasOne
    {
        return $this->hasOne(LabCbc::class, 'submission_id', 'id');
    }

    public function urinalysis(): HasOne
    {
        return $this->hasOne(LabUrinalysis::class, 'submission_id', 'id');
    }

    public function certificate(): HasOne
    {
        return $this->hasOne(Certificate::class, 'submission_id', 'id');
    }

    public function files(): HasMany
    {
        return $this->hasMany(FileRecord::class, 'submission_id', 'id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(StudentNotification::class, 'submission_id', 'id');
    }
}
