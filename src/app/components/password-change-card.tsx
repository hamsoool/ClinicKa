import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

type PasswordChangeCardProps = {
  title?: string;
  description?: string;
};

export default function PasswordChangeCard({
  title = 'Password',
  description = 'Update the password for your signed-in Gordon College account.',
}: PasswordChangeCardProps) {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.currentPassword.trim()) {
      toast.error('Please enter your current password.');
      return;
    }

    if (form.newPassword.trim().length < 6) {
      toast.error('Password must be at least 6 characters.');
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
    <Card id="password" className="scroll-mt-24 overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
      <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
        <div className="flex items-center gap-3">
          <LockKeyhole className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-xl font-semibold text-on-surface">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
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
              placeholder="At least 6 characters"
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
