<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffMeasurement extends Model
{
    protected $table = 'staff_measurements';
    protected $primaryKey = 'submission_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'submission_id',
        'blood_pressure',
        'cardiac_rate',
        'respiratory_rate',
        'temperature',
        'weight',
        'height',
        'bmi',
        'visual_acuity',
        'skin',
        'heent',
        'chest_lungs',
        'heart',
        'abdomen',
        'extremities',
        'others',
        'examined_by',
        'updated_by',
        'examined_by_signature_url',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'submission_id', 'id');
    }
}
