<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LabCbc extends Model
{
    protected $table = 'lab_cbc';
    protected $primaryKey = 'submission_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'submission_id',
        'cbc_date',
        'hemoglobin',
        'hematocrit',
        'wbc',
        'platelet_count',
        'blood_type',
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
