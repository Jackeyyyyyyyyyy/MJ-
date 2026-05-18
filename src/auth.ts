import { User, Role } from './types';

const AUTH_KEY = 'mj_approval_auth';
const ACTIVE_ACCOUNT_KEY = 'mj_active_account';

interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

function readSession(): AuthSession | null {
  const data = localStorage.getItem(AUTH_KEY);
  if (!data) return null;

  try {
    const session = JSON.parse(data) as Partial<AuthSession>;

    if (!session.user || !session.token || !session.expiresAt) {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      return null;
    }

    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem('mj_current_perspective');
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      return null;
    }

    return session as AuthSession;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('mj_current_perspective');
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    return null;
  }
}

function readActiveAccount(): User | null {
  const session = readSession();
  if (session?.user.role !== 'developer') return null;

  const data = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  if (!data) return null;

  try {
    const account = JSON.parse(data) as Partial<User>;
    if (!account.username || !account.name || !account.role || account.role === 'developer') {
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      return null;
    }

    return account as User;
  } catch {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    return null;
  }
}

export const auth = {
  async login(username: string, password: string): Promise<User | null> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: username.trim(), password }),
    });

    if (!response.ok) return null;

    const session = await response.json() as AuthSession;
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    return session.user;
  },

  logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('mj_current_perspective');
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
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
    const user = this.getSessionUser();
    if (user?.role === 'developer') {
      localStorage.setItem('mj_current_perspective', role);
    }
  },

  setActiveAccount(account: User) {
    const sessionUser = this.getSessionUser();
    if (sessionUser?.role !== 'developer') return;

    if (account.role === 'developer') {
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      localStorage.setItem('mj_current_perspective', 'developer');
      return;
    }

    localStorage.setItem(ACTIVE_ACCOUNT_KEY, JSON.stringify({
      username: account.username,
      role: account.role,
      name: account.name,
    }));
    localStorage.setItem('mj_current_perspective', account.role);
  },

  getImpersonatedUsername(): string | null {
    return readActiveAccount()?.username || null;
  }
};
