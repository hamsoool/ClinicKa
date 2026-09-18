<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class OcrCallLog extends Model
{
    protected $table = 'ocr_calls_log';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    const UPDATED_AT = null;

    protected $fillable = [
        'id',
        'timestamp',
        'provider',
    ];

    protected function casts(): array
    {
        return [
            'timestamp' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->timestamp)) {
                $model->timestamp = (int) (microtime(true) * 1000);
            }
        });
    }
}
