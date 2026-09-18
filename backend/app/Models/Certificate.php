<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Certificate extends Model
{
    protected $table = 'certificates';
    protected $primaryKey = 'submission_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'submission_id',
        'findings_normal',
        'diagnosis',
        'remarks',
        'purpose',
        'control_no',
        'issued_date',
        'issued_at',
        'license_no',
        'signatory_name',
        'pdf_url',
    ];

    protected function casts(): array
    {
        return [
            'findings_normal' => 'boolean',
            'issued_date' => 'date',
            'issued_at' => 'datetime',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'submission_id', 'id');
    }
}
