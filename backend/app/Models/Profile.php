<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class Profile extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'profiles';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'email',
        'password_hash',
        'role',
        'first_name',
        'last_name',
        'student_id',
        'department',
        'course',
        'password_setup_completed',
        'is_banned',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected function casts(): array
    {
        return [
            'password_setup_completed' => 'boolean',
            'is_banned' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * Use password_hash column for authentication.
     */
    public function getAuthPassword(): ?string
    {
        return $this->password_hash;
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    public function student(): HasOne
    {
        return $this->hasOne(Student::class, 'profile_id', 'id');
    }

    public function staff(): HasOne
    {
        return $this->hasOne(StaffUser::class, 'profile_id', 'id');
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, ['admin', 'super_admin'], true);
    }

    public function isDoctor(): bool
    {
        return in_array($this->role, ['doctor', 'physician', 'clinic_doctor'], true)
            || ($this->staffUser && str_contains(strtolower($this->staffUser->position ?? ''), 'doctor'));
    }

    public function isStaff(): bool
    {
        return in_array($this->role, ['staff', 'nurse', 'doctor', 'physician', 'clinic_doctor', 'admin', 'super_admin'], true);
    }

    public function isStudent(): bool
    {
        return $this->role === 'student';
    }
}
