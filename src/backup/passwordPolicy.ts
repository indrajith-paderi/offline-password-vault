export const MIN_BACKUP_PASSWORD = 12;

const COMMON = ['password', 'qwerty', '123456', 'letmein', 'iloveyou', 'admin', 'welcome'];

export type BackupPasswordChecks = { length: boolean; variety: boolean; notWeak: boolean };

/**
 * Per-rule breakdown for the live checklist in the export screen. Purely informational:
 * `backupPasswordProblem` remains the single gate that decides whether export is allowed.
 */
export function backupPasswordChecks(pw: string): BackupPasswordChecks {
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const lower = pw.toLowerCase();
  return {
    length: pw.length >= MIN_BACKUP_PASSWORD,
    variety: pw.length >= 20 || classes >= 3,
    notWeak: pw.length > 0 && !/^(.)\1+$/.test(pw) && new Set(pw).size >= 6 && !COMMON.some((c) => lower.includes(c)),
  };
}

export function backupPasswordProblem(pw: string): string | null {
  if (pw.length < MIN_BACKUP_PASSWORD) {
    return `Use at least ${MIN_BACKUP_PASSWORD} characters.`;
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length < 20 && classes < 3) {
    return 'Mix at least three of: lowercase, uppercase, digits, symbols. Or use 20+ characters.';
  }
  if (/^(.)\1+$/.test(pw) || new Set(pw).size < 6) {
    return 'Too repetitive.';
  }
  const lower = pw.toLowerCase();
  if (COMMON.some((c) => lower.includes(c))) {
    return 'Avoid common words like "password" or "qwerty".';
  }
  return null;
}
