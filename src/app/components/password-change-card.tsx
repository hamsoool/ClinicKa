import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import PasswordStrengthMeter from './password-strength-meter';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  getPasswordPolicyMessage,
  getPasswordStrengthResult,
  MIN_PASSWORD_LENGTH,
} from '../lib/password-policy';

type PasswordChangeCardProps = {
  title?: string;
  description?: string;
};

export default function PasswordChangeCard({
  title = 'Password',
  description,
}: PasswordChangeCardProps) {
  const { changePassword, me } = useAuth();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const passwordResult = getPasswordStrengthResult(form.newPassword, {
    email: me?.profile?.email,
    firstName: me?.profile?.first_name,
    lastName: me?.profile?.last_name,
    studentId: me?.profile?.student_id,
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.currentPassword.trim()) {
      toast.error('Please enter your current password.');
      return;
    }

    if (!passwordResult.isStrongEnough) {
      toast.error(getPasswordPolicyMessage(passwordResult));
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      setForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast.success('Password updated successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="password" className="scroll-mt-24 overflow-hidden rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest">
      <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
        <div className="flex items-center gap-3">
          <LockKeyhole className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-xl font-semibold text-on-surface">{title}</CardTitle>
            {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <div className="min-w-0 md:col-span-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              placeholder="Enter your current password"
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={form.newPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
            <Input
              id="confirmNewPassword"
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              placeholder="Re-enter your new password"
            />
          </div>
          <div className="min-w-0 md:col-span-2">
            <PasswordStrengthMeter
              password={form.newPassword}
              userInputs={{
                email: me?.profile?.email,
                firstName: me?.profile?.first_name,
                lastName: me?.profile?.last_name,
                studentId: me?.profile?.student_id,
              }}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Changing Password...' : 'Change Password'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
