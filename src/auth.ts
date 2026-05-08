import { User, Role } from './types';

const AUTH_KEY = 'mj_approval_auth';

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
      return null;
    }

    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem('mj_current_perspective');
      return null;
    }

    return session as AuthSession;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('mj_current_perspective');
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
    return session.user;
  },

  logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('mj_current_perspective');
  },

  getCurrentUser(): User | null {
    return readSession()?.user || null;
  },

  getToken(): string | null {
    return readSession()?.token || null;
  },

  getPerspective(): Role | null {
    const user = this.getCurrentUser();
    if (!user) return null;
    if (user.role === 'developer') {
      return (localStorage.getItem('mj_current_perspective') as Role) || 'developer';
    }
    return user.role;
  },

  setPerspective(role: Role) {
    const user = this.getCurrentUser();
    if (user?.role === 'developer') {
      localStorage.setItem('mj_current_perspective', role);
    }
  }
};
