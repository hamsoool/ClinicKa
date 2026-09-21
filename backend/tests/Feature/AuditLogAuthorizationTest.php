<?php

namespace Tests\Feature;

use App\Models\Profile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditLogAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_students_cannot_access_global_audit_logs(): void
    {
        $student = new Profile([
            'id' => 'student-1',
            'role' => 'student',
            'student_id' => '202600001',
        ]);

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/admin/audit-logs')
            ->assertForbidden();
    }

    public function test_admins_cannot_access_super_admin_audit_logs(): void
    {
        $admin = new Profile([
            'id' => 'admin-1',
            'role' => 'admin',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/audit-logs')
            ->assertForbidden();
    }

    public function test_clinic_staff_cannot_access_the_global_audit_browser(): void
    {
        $staff = new Profile([
            'id' => 'staff-1',
            'role' => 'staff',
        ]);

        $this->actingAs($staff, 'sanctum')
            ->getJson('/api/v1/admin/audit-logs')
            ->assertForbidden();
    }

    public function test_administrative_roles_cannot_use_clinical_record_history_without_clinical_role(): void
    {
        $admin = new Profile([
            'id' => 'admin-2',
            'role' => 'admin',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/audit-logs/student/202600002')
            ->assertForbidden();
    }
}