export const MIN_PASSWORD_LENGTH = 12;

export function getPasswordLengthMessage() {
  return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
}

export function isPasswordLongEnough(password: string) {
  return password.trim().length >= MIN_PASSWORD_LENGTH;
}
