import zxcvbn from 'zxcvbn';

export const MIN_PASSWORD_LENGTH = 8;
export const MIN_PASSWORD_SCORE = 3;
export const MIN_REGISTRATION_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH;

export type PasswordPolicyUserInputs = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  studentId?: string | null;
  extras?: Array<string | null | undefined>;
};

export type PasswordStrengthResult = {
  length: number;
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  warning: string | null;
  suggestions: string[];
  personalInfoMatches: string[];
  hasVisibleCharacters: boolean;
  meetsLength: boolean;
  meetsScore: boolean;
  avoidsPersonalInfo: boolean;
  isStrongEnough: boolean;
};

const strengthLabels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const;

function normalizeValue(value?: string | null) {
  return String(value || '').trim();
}

function normalizeComparisonToken(value?: string | null) {
  return normalizeValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getEmailLocalPart(email?: string | null) {
  return normalizeValue(email).toLowerCase().split('@')[0] || '';
}

function splitIntoCandidateTokens(value?: string | null) {
  const raw = normalizeValue(value);
  if (!raw) return [];

  const pieces = raw
    .split(/[^a-zA-Z0-9]+/)
    .map((piece) => piece.trim())
    .filter(Boolean);

  return [raw, ...pieces];
}

function buildUserTokens(inputs: PasswordPolicyUserInputs = {}) {
  const fullName =
    normalizeValue(inputs.fullName) ||
    [normalizeValue(inputs.firstName), normalizeValue(inputs.lastName)].filter(Boolean).join(' ');
  const emailLocalPart = getEmailLocalPart(inputs.email);
  const rawTokens = [
    normalizeValue(inputs.email),
    emailLocalPart,
    normalizeValue(inputs.firstName),
    normalizeValue(inputs.lastName),
    fullName,
    normalizeValue(inputs.studentId),
    ...(inputs.extras || []).map((value) => normalizeValue(value)),
  ];

  const tokens = new Set<string>();
  for (const token of rawTokens) {
    for (const piece of splitIntoCandidateTokens(token)) {
      const normalized = normalizeComparisonToken(piece);
      if (normalized.length >= 3) {
        tokens.add(normalized);
      }
    }
  }

  return [...tokens];
}

function getStrengthSuggestions(feedback: { warning?: string; suggestions?: string[] }) {
  const suggestions = [
    ...((feedback.suggestions || []).map((value) => value.trim()).filter(Boolean)),
    'Use a unique passphrase with multiple unrelated words.',
    'Avoid names, school IDs, and other personal details.',
  ];

  return [...new Set(suggestions)];
}

export function getPasswordCharacterCount(password: string) {
  return Array.from(password || '').length;
}

export function getPasswordLengthMessage() {
  return `Password must be at least ${MIN_REGISTRATION_PASSWORD_LENGTH} characters. Special characters are optional.`;
}

export function getRegistrationPasswordMessage() {
  return `Password must be at least ${MIN_REGISTRATION_PASSWORD_LENGTH} characters. Special characters are optional.`;
}

export function getPasswordGuidanceMessage() {
  return `Use at least ${MIN_REGISTRATION_PASSWORD_LENGTH} characters. Special characters are optional.`;
}

export function isPasswordLongEnough(password: string) {
  return getPasswordCharacterCount(password) >= MIN_REGISTRATION_PASSWORD_LENGTH;
}

export function isRegistrationPasswordLongEnough(password: string) {
  return getPasswordCharacterCount(password) >= MIN_REGISTRATION_PASSWORD_LENGTH;
}

export function getPasswordStrengthResult(
  password: string,
  userInputs: PasswordPolicyUserInputs = {},
): PasswordStrengthResult {
  const resolvedPassword = String(password || '');
  const userTokens = buildUserTokens(userInputs);
  const normalizedPassword = normalizeComparisonToken(resolvedPassword);
  const strength = zxcvbn(resolvedPassword, userTokens);
  const score = Math.max(0, Math.min(4, strength.score)) as 0 | 1 | 2 | 3 | 4;
  const personalInfoMatches = userTokens.filter(
    (token) => token.length >= 3 && normalizedPassword.includes(token),
  );
  const hasVisibleCharacters = /\S/u.test(resolvedPassword);
  const meetsLength = isPasswordLongEnough(resolvedPassword);
  const meetsScore = score >= MIN_PASSWORD_SCORE;
  const avoidsPersonalInfo = personalInfoMatches.length === 0;

  return {
    length: getPasswordCharacterCount(resolvedPassword),
    score,
    label: strengthLabels[score],
    warning: strength.feedback.warning?.trim() || null,
    suggestions: getStrengthSuggestions(strength.feedback),
    personalInfoMatches,
    hasVisibleCharacters,
    meetsLength,
    meetsScore,
    avoidsPersonalInfo,
    isStrongEnough: hasVisibleCharacters && meetsLength,
  };
}

export function getPasswordPolicyMessage(result: PasswordStrengthResult) {
  if (!result.hasVisibleCharacters) {
    return 'Password cannot be blank or only spaces.';
  }
  if (!result.meetsLength) {
    return getPasswordLengthMessage();
  }
  return getPasswordLengthMessage();
}
