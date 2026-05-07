import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Users, UserCog, KeyRound, Layers } from 'lucide-react';
import { storage } from '../storage';
import { SystemAccount } from '../types';
import StatsOverview from './StatsOverview';
import { cn } from '../lib/utils';

const roleTone: Record<string, string> = {
  applicant: 'bg-[#eef6ff] text-[#0066cc]',
  approver: 'bg-[#fff7e6] text-[#9a5b00]',
  boss: 'bg-[#e8f5e9] text-[#2e7d32]',
  developer: 'bg-black text-white',
};

export default function AccountPermissionAdmin() {
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAccounts = async () => {
    setError('');
    try {
      setAccounts(await storage.getAccounts());
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
    const permissionCount = new Set(accounts.flatMap(account => account.permissions.map(permission => permission.key))).size;

    return {
      total: accounts.length,
      superAdmins: accounts.filter(account => account.role === 'developer').length,
      roles: new Set(accounts.map(account => account.role)).size,
      permissions: permissionCount,
    };
  }, [accounts]);

  const summaryItems = [
    { label: '账号总数', value: stats.total, icon: Users, tone: 'text-midnight-graphite', bg: 'bg-lightest-gray-background' },
    { label: '超级管理员', value: stats.superAdmins, icon: ShieldCheck, tone: 'text-white', bg: 'bg-black' },
    { label: '角色类型', value: stats.roles, icon: UserCog, tone: 'text-[#0066cc]', bg: 'bg-[#eef6ff]' },
    { label: '权限项', value: stats.permissions, icon: KeyRound, tone: 'text-[#2e7d32]', bg: 'bg-[#e8f5e9]' },
  ];

  return (
    <div className="space-y-8 pb-40 animate-in fade-in duration-700">
      <StatsOverview
        title="账号权限管理"
        subtitle="系统账号与访问范围"
        items={summaryItems}
      />

      <section className="bg-white border border-border-silver rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border-silver flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">系统账号</h2>
            <p className="text-[12px] text-light-gray font-semibold mt-1">超级管理员可查看全部账号的角色和权限范围</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              void loadAccounts();
            }}
            className="h-9 px-4 bg-black text-white rounded-lg text-[13px] font-bold hover:bg-zinc-800 transition-all"
          >
            刷新
          </button>
        </div>

        {error && (
          <div className="px-5 py-4 text-[13px] font-semibold text-[#c62828] bg-[#ffebee]">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="px-5 py-16 text-center text-[14px] font-semibold text-light-gray">
            正在加载账号权限...
          </div>
        ) : (
          <div className="divide-y divide-border-silver">
            {accounts.map((account) => (
              <article key={account.username} className="px-5 py-5 grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-5">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-lightest-gray-background flex items-center justify-center shrink-0">
                    <UserCog size={19} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16px] font-bold tracking-tight">{account.name}</h3>
                      <span className={cn(
                        'px-2.5 py-1 rounded-apple-btn text-[11px] font-bold',
                        roleTone[account.role] || 'bg-lightest-gray-background text-medium-gray',
                      )}>
                        {account.roleLabel}
                      </span>
                    </div>
                    <p className="text-[12px] text-light-gray font-semibold mt-1">{account.username}</p>
                    {account.canSwitchPerspective && (
                      <p className="text-[12px] text-action-blue font-semibold mt-3">可切换申请人、审批人、管理员视角</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {account.permissions.map((permission) => (
                    <div
                      key={permission.key}
                      className="min-h-[42px] px-3 py-2 bg-canvas-white border border-border-silver rounded-lg flex items-center gap-3"
                    >
                      <Layers size={15} strokeWidth={2.2} className="text-medium-gray shrink-0" />
                      <span className="text-[13px] font-semibold text-midnight-graphite">{permission.label}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
