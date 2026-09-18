<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LabUrinalysis extends Model
{
    protected $table = 'lab_urinalysis';
    protected $primaryKey = 'submission_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'submission_id',
        'urinalysis_date',
        'glucose',
        'protein',
        'file_id',
        'file_url',
        'file_name',
        'mime_type',
        'media_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'media_updated_at' => 'datetime',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'submission_id', 'id');
    }
}
