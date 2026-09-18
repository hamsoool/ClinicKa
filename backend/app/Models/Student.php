<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends Model
{
    use HasFactory;

    protected $table = 'students';
    protected $primaryKey = 'student_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'student_id',
        'profile_id',
        'first_name',
        'last_name',
        'middle_initial',
        'department',
        'course',
        'year_level',
        'age',
        'sex',
        'birthday',
        'civil_status',
        'contact_number',
        'address',
        'profile_photo_url',
        'profile_photo_file_name',
        'signature_url',
        'signature_file_name',
        'media_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'year_level' => 'integer',
            'age' => 'integer',
            'birthday' => 'date:Y-m-d',
            'media_updated_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id', 'id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class, 'student_id', 'student_id');
    }
}
