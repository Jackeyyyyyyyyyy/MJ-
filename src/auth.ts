import { User, Role } from './types';

const AUTH_KEY = 'mj_approval_auth';

export const auth = {
  login(username: string, password: string): User | null {
    if (password !== '123456') return null;

    let role: Role;
    let name: string;

    switch (username) {
      case 'applicant':
        role = 'applicant';
        name = '张申请';
        break;
      case 'approver':
        role = 'approver';
        name = '李审批';
        break;
      case 'boss':
        role = 'boss';
        name = '王老板';
        break;
      case 'developer':
        role = 'developer';
        name = '系统开发员';
        break;
      default:
        return null;
    }

    const user: User = { username, role, name };
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  },

  logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('mj_current_perspective');
  },

  getCurrentUser(): User | null {
    const data = localStorage.getItem(AUTH_KEY);
    return data ? JSON.parse(data) : null;
  },

  getPerspective(): Role | null {
    const user = this.getCurrentUser();
    if (!user) return null;
    if (user.role === 'developer') {
      return (localStorage.getItem('mj_current_perspective') as Role) || 'boss';
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
