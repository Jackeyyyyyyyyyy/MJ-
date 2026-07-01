import { AuthSessionResponse, User, Role } from './types';

const AUTH_KEY = 'mj_approval_auth';
const ACTIVE_ACCOUNT_KEY = 'mj_active_account';
const PERSPECTIVE_KEY = 'mj_current_perspective';

interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

type AuthStorage = Storage;

interface StoredAuthSession {
  session: AuthSession;
  storage: AuthStorage;
}

export function normalizeRole(role?: string | null): Role {
  const value = String(role || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (value === 'applicant' || value === 'approver' || value === 'employee') return 'employee';
  if (value === 'boss') return 'boss';
  if (value === 'developer' || value === 'super-admin' || value === 'superadmin' || value === 'system-admin') return 'developer';
  return 'employee';
}

function normalizeUser(user?: Partial<User> | null): User | null {
  if (!user?.username || !user.name) return null;

  const userWithFlags = user as Partial<User> & { isSuperAdmin?: boolean };

  return {
    username: user.username,
    name: user.name,
    role: userWithFlags.isSuperAdmin ? 'developer' : normalizeRole(user.role),
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
  };
}

function clearSessionStorage(storage: AuthStorage) {
  storage.removeItem(AUTH_KEY);
  storage.removeItem(ACTIVE_ACCOUNT_KEY);
}

function clearUserState() {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem(AUTH_KEY);
    storage.removeItem(PERSPECTIVE_KEY);
    storage.removeItem(ACTIVE_ACCOUNT_KEY);
  });
}

function parseStoredSession(storage: AuthStorage): AuthSession | null {
  const data = storage.getItem(AUTH_KEY);
  if (!data) return null;

  try {
    const session = JSON.parse(data) as Partial<AuthSession>;

    if (!session.user || !session.token || !session.expiresAt) {
      clearSessionStorage(storage);
      return null;
    }

    if (Date.now() > session.expiresAt) {
      storage.removeItem(PERSPECTIVE_KEY);
      clearSessionStorage(storage);
      return null;
    }

    const normalizedUser = normalizeUser(session.user);
    if (!normalizedUser) {
      clearSessionStorage(storage);
      return null;
    }

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: normalizedUser,
    } as AuthSession;
  } catch {
    storage.removeItem(PERSPECTIVE_KEY);
    clearSessionStorage(storage);
    return null;
  }
}

function readStoredSession(): StoredAuthSession | null {
  const sessionOnlySession = parseStoredSession(sessionStorage);
  if (sessionOnlySession) {
    return { session: sessionOnlySession, storage: sessionStorage };
  }

  const rememberedSession = parseStoredSession(localStorage);
  if (rememberedSession) {
    return { session: rememberedSession, storage: localStorage };
  }

  return null;
}

function readSession(): AuthSession | null {
  return readStoredSession()?.session || null;
}

function storeSession(session: AuthSessionResponse, options: { rememberDevice?: boolean } = {}): User {
  const normalizedSession = {
    ...session,
    user: normalizeUser(session.user) || session.user,
  };
  const targetStorage = options.rememberDevice ? localStorage : sessionStorage;
  const otherStorage = options.rememberDevice ? sessionStorage : localStorage;

  otherStorage.removeItem(AUTH_KEY);
  otherStorage.removeItem(PERSPECTIVE_KEY);
  otherStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  targetStorage.setItem(AUTH_KEY, JSON.stringify(normalizedSession));
  targetStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  return normalizedSession.user;
}

function readActiveAccount(): User | null {
  const storedSession = readStoredSession();
  if (storedSession?.session.user.role !== 'developer') return null;

  const data = storedSession.storage.getItem(ACTIVE_ACCOUNT_KEY);
  if (!data) return null;

  try {
    const account = JSON.parse(data) as Partial<User>;
    const normalizedAccount = normalizeUser(account);
    if (!normalizedAccount || normalizedAccount.role === 'developer') {
      storedSession.storage.removeItem(ACTIVE_ACCOUNT_KEY);
      return null;
    }

    return normalizedAccount;
  } catch {
    storedSession.storage.removeItem(ACTIVE_ACCOUNT_KEY);
    return null;
  }
}

export const auth = {
  async login(username: string, password: string, options: { rememberDevice?: boolean } = {}): Promise<User | null> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: username.trim(), password }),
    });

    if (!response.ok) return null;

    const session = await response.json() as AuthSessionResponse;
    return storeSession(session, options);
  },

  acceptSession(session: AuthSessionResponse, options: { rememberDevice?: boolean } = {}): User {
    return storeSession(session, options);
  },

  logout() {
    clearUserState();
  },

  getSessionUser(): User | null {
    return readSession()?.user || null;
  },

  getCurrentUser(): User | null {
    return readActiveAccount() || this.getSessionUser();
  },

  getToken(): string | null {
    return readSession()?.token || null;
  },

  getPerspective(): Role | null {
    return this.getCurrentUser()?.role || null;
  },

  setPerspective(role: Role) {
    const storedSession = readStoredSession();
    if (storedSession?.session.user.role === 'developer') {
      storedSession.storage.setItem(PERSPECTIVE_KEY, role);
    }
  },

  setActiveAccount(account: User) {
    const storedSession = readStoredSession();
    if (storedSession?.session.user.role !== 'developer') return;

    const role = normalizeRole(account.role);
    if (role === 'developer') {
      storedSession.storage.removeItem(ACTIVE_ACCOUNT_KEY);
      storedSession.storage.setItem(PERSPECTIVE_KEY, 'developer');
      return;
    }

    storedSession.storage.setItem(ACTIVE_ACCOUNT_KEY, JSON.stringify({
      username: account.username,
      role,
      name: account.name,
      ...(account.avatarUrl ? { avatarUrl: account.avatarUrl } : {}),
    }));
    storedSession.storage.setItem(PERSPECTIVE_KEY, role);
  },

  updateStoredUser(user: User) {
    const normalizedUser = normalizeUser(user);
    const storedSession = readStoredSession();
    if (!normalizedUser || !storedSession) return;

    if (storedSession.session.user.username === normalizedUser.username) {
      storedSession.storage.setItem(AUTH_KEY, JSON.stringify({
        ...storedSession.session,
        user: normalizedUser,
      }));
    }

    const activeAccount = readActiveAccount();
    if (activeAccount?.username === normalizedUser.username) {
      storedSession.storage.setItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(normalizedUser));
    }
  },

  getImpersonatedUsername(): string | null {
    return readActiveAccount()?.username || null;
  }
};
