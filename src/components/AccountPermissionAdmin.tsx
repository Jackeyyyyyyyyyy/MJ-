import React, { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, Plus, RefreshCw, ShieldCheck, UserCog, Users } from 'lucide-react';
import { storage } from '../storage';
import { AccountInput, Role, SystemAccount } from '../types';
import StatsOverview from './StatsOverview';
import { cn } from '../lib/utils';

type ManagedRole = Exclude<Role, 'developer'>;

interface AccountDraft {
  username: string;
  name: string;
  role: ManagedRole;
  enabled: boolean;
  password: string;
}

const roleTone: Record<string, string> = {
  employee: 'bg-[#eef6ff] text-[#0066cc]',
  boss: 'bg-[#e8f5e9] text-[#2e7d32]',
  developer: 'bg-black text-white',
};

const roleOptions: Array<{ value: ManagedRole; label: string }> = [
  { value: 'employee', label: '员工' },
  { value: 'boss', label: '老板' },
];

const defaultAccount: AccountInput = {
  username: '',
  name: '',
  role: 'employee',
  password: '123456',
  enabled: true,
};

function toDraft(account: SystemAccount): AccountDraft {
  return {
    username: account.username,
    name: account.accountName || account.name,
    role: account.role === 'developer' ? 'boss' : account.role,
    enabled: account.enabled,
    password: '',
  };
}

export default function AccountPermissionAdmin() {
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AccountDraft>>({});
  const [newAccount, setNewAccount] = useState<AccountInput>(defaultAccount);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAccounts = async () => {
    setError('');
    try {
      const nextAccounts = await storage.getAccounts();
      setAccounts(nextAccounts);
      setDrafts(Object.fromEntries(nextAccounts.map((account) => [account.id, toDraft(account)])));
    } catch (err) {
      setError(err instanceof Error ? err.message : '账号权限加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const stats = useMemo(() => {
    const normalAccounts = accounts.filter((account) => !account.isSuperAdmin);
    const permissionCount = new Set(accounts.flatMap(account => account.permissions.map(permission => permission.key))).size;

    return {
      total: accounts.length,
      normal: normalAccounts.length,
      roles: new Set(accounts.map(account => account.role)).size,
      permissions: permissionCount,
    };
  }, [accounts]);

  const summaryItems = [
    { label: '账号总数', value: stats.total, icon: Users, tone: 'text-midnight-graphite', bg: 'bg-lightest-gray-background' },
    { label: '普通账号', value: stats.normal, icon: UserCog, tone: 'text-[#0066cc]', bg: 'bg-[#eef6ff]' },
    { label: '角色类型', value: stats.roles, icon: ShieldCheck, tone: 'text-white', bg: 'bg-black' },
    { label: '权限项', value: stats.permissions, icon: KeyRound, tone: 'text-[#2e7d32]', bg: 'bg-[#e8f5e9]' },
  ];

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSavingId('new');

    try {
      const username = newAccount.username.trim();
      await storage.createAccount({
        ...newAccount,
        username,
        name: (newAccount.name || '').trim() || username,
        password: newAccount.password?.trim() || '123456',
      });
      setNewAccount(defaultAccount);
      setNotice('账号已创建，默认密码为 123456');
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '账号创建失败');
    } finally {
      setSavingId('');
    }
  };

  const updateDraft = (id: string, patch: Partial<AccountDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  };

  const handleSave = async (account: SystemAccount) => {
    const draft = drafts[account.id];
    if (!draft) return;

    setError('');
    setNotice('');
    setSavingId(account.id);

    try {
      const username = draft.username.trim();
      const payload: Partial<AccountInput> = {
        username,
        role: draft.role,
        enabled: draft.enabled,
      };

      if (!account.linkedMember) {
        payload.name = draft.name.trim() || username;
      }

      if (draft.password.trim()) {
        payload.password = draft.password.trim();
      }

      await storage.updateAccount(account.id, payload);
      setNotice(draft.password.trim() ? '账号资料和密码已更新' : '账号资料已更新');
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '账号保存失败');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-8 pb-40 animate-in fade-in duration-700">
      <StatsOverview
        title="账号权限管理"
        subtitle="账号是登录标识，姓名和职位优先来自组织架构"
        items={summaryItems}
      />

      <section className="bg-white border border-border-silver rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border-silver flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">新建账号</h2>
            <p className="text-[12px] text-light-gray font-semibold mt-1">普通账号默认密码为 123456；绑定组织成员后，姓名和职位会自动使用组织架构信息</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="p-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_160px_150px] gap-3">
          <input
            value={newAccount.username}
            onChange={(event) => setNewAccount((current) => ({ ...current, username: event.target.value }))}
            className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-semibold outline-none focus:border-black"
            placeholder="登录账号"
            required
          />
          <input
            value={newAccount.name}
            onChange={(event) => setNewAccount((current) => ({ ...current, name: event.target.value }))}
            className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-semibold outline-none focus:border-black"
            placeholder="备用名称（未绑定时显示）"
          />
          <select
            value={newAccount.role}
            onChange={(event) => setNewAccount((current) => ({ ...current, role: event.target.value as ManagedRole }))}
            className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-semibold outline-none focus:border-black"
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={savingId === 'new'}
            className="h-11 px-4 bg-black text-white rounded-lg text-[13px] font-bold hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={15} strokeWidth={3} />
            新建账号
          </button>
        </form>
      </section>

      <section className="bg-white border border-border-silver rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border-silver flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">系统账号</h2>
            <p className="text-[12px] text-light-gray font-semibold mt-1">这里只维护登录账号、角色、状态和备用名称；人员姓名、部门、职位在组织架构中维护</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              void loadAccounts();
            }}
            className="h-9 px-4 bg-black text-white rounded-lg text-[13px] font-bold hover:bg-zinc-800 transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} strokeWidth={2.5} />
            刷新
          </button>
        </div>

        {(error || notice) && (
          <div className={cn(
            "px-5 py-4 text-[13px] font-semibold",
            error ? "text-[#c62828] bg-[#ffebee]" : "text-[#2e7d32] bg-[#e8f5e9]",
          )}>
            {error || notice}
          </div>
        )}

        {isLoading ? (
          <div className="px-5 py-16 text-center text-[14px] font-semibold text-light-gray">
            正在加载账号权限...
          </div>
        ) : (
          <div className="divide-y divide-border-silver">
            {accounts.map((account) => {
              const draft = drafts[account.id] || toDraft(account);
              const linkedMember = account.linkedMember;
              const isNameLocked = Boolean(linkedMember);

              return (
                <article key={account.id} className="px-5 py-5 space-y-4">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-lg bg-lightest-gray-background flex items-center justify-center shrink-0">
                        <UserCog size={19} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[16px] font-bold tracking-tight">{account.username}</h3>
                          <span className={cn(
                            'px-2.5 py-1 rounded-apple-btn text-[11px] font-bold',
                            roleTone[account.role] || 'bg-lightest-gray-background text-medium-gray',
                          )}>
                            {account.roleLabel}
                          </span>
                          {account.isSuperAdmin && (
                            <span className="px-2.5 py-1 rounded-apple-btn text-[11px] font-bold bg-lightest-gray-background text-medium-gray">
                              环境变量
                            </span>
                          )}
                          {!account.enabled && (
                            <span className="px-2.5 py-1 rounded-apple-btn text-[11px] font-bold bg-[#ffebee] text-[#c62828]">
                              已停用
                            </span>
                          )}
                          {linkedMember && (
                            <span className="px-2.5 py-1 rounded-apple-btn text-[11px] font-bold bg-[#eef6ff] text-[#0066cc]">
                              已绑定组织成员
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-light-gray font-semibold mt-1">
                          {linkedMember
                            ? `${linkedMember.name} · ${linkedMember.departmentName} · ${linkedMember.title}`
                            : `未绑定组织成员 · 备用名称：${account.name}`}
                        </p>
                      </div>
                    </div>

                    {!account.isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleSave(account)}
                        disabled={savingId === account.id}
                        className="h-10 px-4 bg-black text-white rounded-lg text-[13px] font-bold hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Check size={15} strokeWidth={3} />
                        保存修改
                      </button>
                    )}
                  </div>

                  {!account.isSuperAdmin && (
                    <div className="space-y-3">
                      {linkedMember && (
                        <div className="rounded-lg border border-border-silver bg-lightest-gray-background px-4 py-3">
                          <p className="text-[12px] font-black text-midnight-graphite">组织架构身份</p>
                          <p className="mt-1 text-[13px] font-semibold text-medium-gray">
                            {linkedMember.name} / {linkedMember.departmentName} / {linkedMember.title}
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_160px_160px_120px] gap-3">
                      <input
                        value={draft.username}
                        onChange={(event) => updateDraft(account.id, { username: event.target.value })}
                        className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-semibold outline-none focus:border-black"
                        placeholder="登录账号"
                      />
                      <input
                        value={draft.name}
                        onChange={(event) => updateDraft(account.id, { name: event.target.value })}
                        disabled={isNameLocked}
                        className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-semibold outline-none focus:border-black disabled:bg-lightest-gray-background disabled:text-light-gray disabled:cursor-not-allowed"
                        placeholder="备用名称（未绑定时显示）"
                      />
                      <select
                        value={draft.role}
                        onChange={(event) => updateDraft(account.id, { role: event.target.value as ManagedRole })}
                        className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-semibold outline-none focus:border-black"
                      >
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                      <input
                        type="password"
                        value={draft.password}
                        onChange={(event) => updateDraft(account.id, { password: event.target.value })}
                        className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-semibold outline-none focus:border-black"
                        placeholder="新密码"
                      />
                      <label className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[13px] font-bold flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(event) => updateDraft(account.id, { enabled: event.target.checked })}
                          className="accent-black"
                        />
                        启用
                      </label>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
