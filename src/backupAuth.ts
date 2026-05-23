interface BackupSession {
  token: string;
  expiresAt: number;
}

const BACKUP_SESSION_KEY = 'mj_backup_session';

export function readBackupSession(): BackupSession | null {
  const raw = sessionStorage.getItem(BACKUP_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as Partial<BackupSession>;
    if (!session.token || !session.expiresAt || Date.now() > session.expiresAt) {
      sessionStorage.removeItem(BACKUP_SESSION_KEY);
      return null;
    }

    return {
      token: session.token,
      expiresAt: session.expiresAt,
    };
  } catch {
    sessionStorage.removeItem(BACKUP_SESSION_KEY);
    return null;
  }
}

export function clearBackupSession() {
  sessionStorage.removeItem(BACKUP_SESSION_KEY);
}

export async function loginBackup(username: string, password: string): Promise<boolean> {
  const response = await fetch('/api/backup/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });

  if (!response.ok) return false;

  const session = await response.json() as BackupSession;
  sessionStorage.setItem(BACKUP_SESSION_KEY, JSON.stringify(session));
  return true;
}
