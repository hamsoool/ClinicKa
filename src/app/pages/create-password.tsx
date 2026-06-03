import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { PasswordSetupScreen } from './auth/password-setup-screen';
import { useAuth } from '../lib/auth';
import {
  getPasswordPolicyMessage,
  getPasswordStrengthResult,
  type PasswordPolicyUserInputs,
} from '../lib/password-policy';

function getHomePath(role: 'student' | 'staff' | 'admin' | 'super_admin') {
  if (role === 'super_admin') return '/super-admin';
  if (role === 'staff') return '/staff';
  if (role === 'admin') return '/admin';
  return '/student';
}

export default function CreatePasswordPage() {
  const navigate = useNavigate();
  const { me, session, role, loading, requiresPasswordSetup, isPasswordRecovery, completePasswordSetup } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
  });

  const passwordInputs = useMemo<PasswordPolicyUserInputs>(
    () => ({
      email: session?.user?.email || me?.profile?.email,
      firstName: me?.profile?.first_name,
      lastName: me?.profile?.last_name,
      studentId: me?.profile?.student_id,
    }),
    [me, session?.user?.email],
  );
  const passwordResult = useMemo(
    () => getPasswordStrengthResult(form.password, passwordInputs),
    [form.password, passwordInputs],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!passwordResult.isStrongEnough) {
      setError(getPasswordPolicyMessage(passwordResult));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await completePasswordSetup(form.password);
      setSuccessMessage('Password set successfully. Redirecting you to your workspace...');
      navigate('/', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to set password.');
    }
  }

  if (isPasswordRecovery) {
    return <Navigate to="/auth?mode=signin&recovery=1" replace />;
  }

  if (!session?.access_token) {
    return <Navigate to="/auth?mode=signin" replace />;
  }

  if (!requiresPasswordSetup) {
    if (role) {
      return <Navigate to={getHomePath(role)} replace />;
    }
    return <Navigate to="/auth?mode=signin" replace />;
  }

  return (
    <PasswordSetupScreen
      mode="setup"
      loading={loading}
      error={error}
      successMessage={successMessage}
      password={form.password}
      confirmPassword={form.confirmPassword}
      onPasswordChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
      onConfirmPasswordChange={(value) => setForm((prev) => ({ ...prev, confirmPassword: value }))}
      onSubmit={handleSubmit}
      userInputs={passwordInputs}
    />
  );
}
