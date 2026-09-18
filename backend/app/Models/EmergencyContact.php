<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmergencyContact extends Model
{
    protected $table = 'emergency_contacts';
    protected $primaryKey = 'submission_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'submission_id',
        'name',
        'relationship',
        'phone',
        'address',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'submission_id', 'id');
    }
}
