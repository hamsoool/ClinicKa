<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    protected $table = 'system_settings';
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'key',
        'value',
    ];

    public static function getVal(string $key, ?string $default = null): ?string
    {
        return \Illuminate\Support\Facades\Cache::remember("sys_setting_{$key}", 3600, function () use ($key, $default) {
            $setting = static::find($key);
            return $setting ? $setting->value : $default;
        });
    }

    public static function setVal(string $key, ?string $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value ?? '']);
        \Illuminate\Support\Facades\Cache::forget("sys_setting_{$key}");
    }
}
