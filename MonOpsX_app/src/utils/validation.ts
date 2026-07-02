export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_RULES = [
  { label: "12 caractères minimum", test: (value: string) => value.length >= 12 },
  { label: "Une lettre majuscule", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Une lettre minuscule", test: (value: string) => /[a-z]/.test(value) },
  { label: "Un chiffre", test: (value: string) => /\d/.test(value) },
  {
    label: "Un caractère spécial",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  }
] as const;

export function getPasswordError(password: string): string | null {
  const failedRule = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failedRule ? `Le mot de passe doit contenir : ${failedRule.label.toLowerCase()}.` : null;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}
