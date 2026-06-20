import { useEffect, useState } from 'react';
import { LockKeyhole, ShieldCheck, Eye, EyeOff } from 'lucide-react';
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
  const { changePassword, sendPasswordChangeOtp, me } = useAuth();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showOtpSection, setShowOtpSection] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const requires2FA = ['staff', 'admin', 'super_admin'].includes(me?.profile?.role || '');

  // Reset OTP view if user clears the password fields
  useEffect(() => {
    if (!form.currentPassword && !form.newPassword && !form.confirmPassword) {
      setShowOtpSection(false);
      setOtp('');
    }
  }, [form.currentPassword, form.newPassword, form.confirmPassword]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async () => {
    if (cooldown > 0) return;
    setSendingOtp(true);
    try {
      await sendPasswordChangeOtp();
      setOtp('');
      setCooldown(60);
      toast.success('Verification code sent to your email.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send verification code.');
    } finally {
      setSendingOtp(false);
    }
  };

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

    if (form.currentPassword === form.newPassword) {
      toast.error('New password must be different from the current password.');
      return;
    }

    // Auto-trigger OTP sending and reveal input fields on initial submit click
    if (requires2FA && !showOtpSection) {
      setSaving(true);
      try {
        await sendPasswordChangeOtp();
        setCooldown(60);
        setShowOtpSection(true);
        toast.success('Verification code sent to your email.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to send verification code.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (requires2FA && showOtpSection) {
      if (!otp.trim()) {
        toast.error('Please enter the 2-Factor Authentication code.');
        return;
      }

      if (otp.trim().length !== 6) {
        toast.error('The 2-Factor Authentication code must be 6 digits.');
        return;
      }
    }

    setSaving(true);
    try {
      await changePassword(form.currentPassword, form.newPassword, requires2FA ? otp : undefined);
      setForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setOtp('');
      setShowOtpSection(false);
      toast.success('Password updated successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="password" className="scroll-mt-24 overflow-hidden rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest !gap-0">
      <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
        <div className="flex items-center gap-3">
          <LockKeyhole className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-xl font-semibold text-on-surface">{title}</CardTitle>
            {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
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
            <div className="relative mt-1">
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-full text-[#60717e] transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="min-w-0">
            <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
            <div className="relative mt-1">
              <Input
                id="confirmNewPassword"
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                placeholder="Re-enter your new password"
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-full text-[#60717e] transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                aria-label={showPassword ? 'Hide confirmed password' : 'Show confirmed password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
          {requires2FA && showOtpSection && (
            <div className="min-w-0 md:col-span-2 flex flex-col gap-2 mt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="otp" className="text-sm font-semibold text-on-surface">
                  Two-Factor Authentication Code
                </Label>
                <span className="text-xs text-on-surface-variant leading-relaxed">
                  A 6-digit verification code will be sent to your registered email: <strong>{me?.profile?.email}</strong>.
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mt-1">
                <div className="relative flex-1 w-full max-w-[280px]">
                  <Input
                    id="otp"
                    type="text"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    className="text-center font-mono text-base tracking-widest h-11"
                    disabled={saving}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || cooldown > 0}
                  className="h-11 px-5"
                >
                  {cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : sendingOtp
                    ? 'Sending OTP...'
                    : 'Send Code'}
                </Button>
              </div>
            </div>
          )}
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving
                ? 'Changing Password...'
                : requires2FA && showOtpSection
                ? 'Verify & Change Password'
                : 'Change Password'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
