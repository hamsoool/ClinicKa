<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ArchivedAccount extends Model
{
    protected $table = 'archived_accounts';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    const CREATED_AT = 'archived_at';
    const UPDATED_AT = null;

    protected $fillable = [
        'id',
        'user_id',
        'email',
        'role',
        'original_profile_data',
        'archived_by',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'original_profile_data' => 'array',
            'archived_at' => 'datetime',
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
}
