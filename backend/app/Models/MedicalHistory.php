<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalHistory extends Model
{
    protected $table = 'medical_history';
    protected $primaryKey = 'submission_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'submission_id',
        'allergy',
        'asthma',
        'chicken_pox',
        'diabetes',
        'dysmenorrhea',
        'epilepsy_seizure',
        'heart_disorder',
        'hepatitis',
        'hypertension',
        'measles',
        'mumps',
        'anxiety_disorder',
        'panic_attack',
        'pneumonia',
        'ptb_primary_complex',
        'typhoid_fever',
        'covid19',
        'uti',
    ];

    protected function casts(): array
    {
        return [
            'allergy' => 'boolean',
            'asthma' => 'boolean',
            'chicken_pox' => 'boolean',
            'diabetes' => 'boolean',
            'dysmenorrhea' => 'boolean',
            'epilepsy_seizure' => 'boolean',
            'heart_disorder' => 'boolean',
            'hepatitis' => 'boolean',
            'hypertension' => 'boolean',
            'measles' => 'boolean',
            'mumps' => 'boolean',
            'anxiety_disorder' => 'boolean',
            'panic_attack' => 'boolean',
            'pneumonia' => 'boolean',
            'ptb_primary_complex' => 'boolean',
            'typhoid_fever' => 'boolean',
            'covid19' => 'boolean',
            'uti' => 'boolean',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'submission_id', 'id');
    }
}
