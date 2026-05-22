import React from 'react';
import { auth } from '../auth';
import { storage } from '../storage';
import Sidebar from './Sidebar';
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, UserRound } from 'lucide-react';
import { AdminView, Role, SystemAccount } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  onPerspectiveChange: (role: Role) => void;
  activeUsername?: string;
  activeAdminView?: AdminView | null;
  onOpenAccountAdmin: () => void;
  onOpenAiAssistant: () => void;
  onOpenOrganizationAdmin: () => void;
  onOpenWorkflowAdmin: () => void;
  onOpenAiBranchLogs: () => void;
  selectedModule?: string;
  selectedType?: string;
  onSelectType: (module: string, type: string) => void;
}

function getPerspectiveLabel(role: Role) {
  switch(role) {
    case 'employee': return '员工';
    case 'boss': return '老板';
    default: return '超管';
  }
}

interface AccountSwitcherProps {
  activeAccount: SystemAccount | null;
  accounts: SystemAccount[];
  isLoading: boolean;
  onChange: (account: SystemAccount) => void;
}

function getAccountPrimaryLabel(account: SystemAccount) {
  if (account.isSuperAdmin) return '超管端';
  return account.linkedMember?.name || account.name;
}

function getAccountSecondaryLabel(account: SystemAccount) {
  if (account.isSuperAdmin) return '独立管理入口';
  if (account.linkedMember) {
    return `${account.username} · ${account.linkedMember.departmentName} · ${account.linkedMember.title}`;
  }
  return `${account.username} · ${account.roleLabel}`;
}

function getMobileAccountLabel(account: SystemAccount) {
  if (account.isSuperAdmin) return '超管端';
  if (account.linkedMember) {
    return `${account.linkedMember.name}（${account.username} · ${account.linkedMember.title}）`;
  }
  return `${account.name}（${account.username} · ${account.roleLabel}）`;
}

function AccountSwitcher({ activeAccount, accounts, isLoading, onChange }: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const enabledAccounts = React.useMemo(
    () => accounts.filter((account) => account.enabled || account.isSuperAdmin),
    [accounts],
  );
  const filteredAccounts = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return enabledAccounts;

    return enabledAccounts.filter((account) => (
      account.name.toLowerCase().includes(keyword)
      || account.accountName?.toLowerCase().includes(keyword)
      || account.linkedMember?.name.toLowerCase().includes(keyword)
      || account.linkedMember?.departmentName.toLowerCase().includes(keyword)
      || account.linkedMember?.title.toLowerCase().includes(keyword)
      || account.username.toLowerCase().includes(keyword)
      || account.roleLabel.toLowerCase().includes(keyword)
    ));
  }, [enabledAccounts, query]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const selectedAccount = activeAccount || enabledAccounts.find((account) => account.isSuperAdmin) || null;
  const selectedLabel = selectedAccount ? getAccountPrimaryLabel(selectedAccount) : '选择账号';
  const selectedRole = selectedAccount ? getAccountSecondaryLabel(selectedAccount) : '账号视角';

  return (
    <div ref={rootRef} className="relative w-[260px] max-w-full">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="w-full h-11 px-3 rounded-apple-btn bg-lightest-gray-background hover:bg-white border border-transparent hover:border-border-silver transition-all flex items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
        aria-label="切换账号"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-7 h-7 rounded-full bg-white text-midnight-graphite flex items-center justify-center shrink-0 shadow-sm">
            {selectedAccount?.isSuperAdmin ? <ShieldCheck size={15} strokeWidth={2.4} /> : <UserRound size={15} strokeWidth={2.4} />}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-midnight-graphite truncate">{selectedLabel}</span>
            <span className="block text-[11px] font-semibold text-medium-gray truncate">{selectedRole}</span>
          </span>
        </span>
        <ChevronDown size={16} strokeWidth={2.4} className={cn("text-medium-gray transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-[320px] max-w-[calc(100vw-40px)] rounded-2xl border border-border-silver bg-white shadow-apple-xl overflow-hidden"
          >
            <div className="p-3 border-b border-border-silver">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-light-silver w-3.5 h-3.5" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索姓名、账号或角色"
                  className="w-full h-10 rounded-xl bg-lightest-gray-background pl-9 pr-3 text-[13px] font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-border-silver"
                />
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto p-2">
              {isLoading && (
                <div className="px-3 py-5 text-center text-[12px] font-semibold text-medium-gray">正在加载账号...</div>
              )}

              {!isLoading && filteredAccounts.length === 0 && (
                <div className="px-3 py-5 text-center text-[12px] font-semibold text-medium-gray">没有匹配账号</div>
              )}

              {!isLoading && filteredAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    onChange(account);
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full min-h-[56px] px-3 py-2 rounded-xl flex items-center gap-3 text-left transition-all",
                    selectedAccount?.username === account.username
                      ? "bg-interactive-blue text-white"
                      : "text-midnight-graphite hover:bg-lightest-gray-background"
                  )}
                >
                  <span className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    selectedAccount?.username === account.username ? "bg-white/20" : "bg-lightest-gray-background"
                    )}>
                      {account.isSuperAdmin ? <ShieldCheck size={16} strokeWidth={2.4} /> : <UserRound size={16} strokeWidth={2.4} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black truncate">
                      {getAccountPrimaryLabel(account)}
                    </span>
                    <span className={cn(
                      "block text-[11px] font-semibold truncate",
                      selectedAccount?.username === account.username ? "text-white/75" : "text-medium-gray"
                    )}>
                      {getAccountSecondaryLabel(account)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileAccountSwitcher({ activeAccount, accounts, isLoading, onChange }: AccountSwitcherProps) {
  const enabledAccounts = accounts.filter((account) => account.enabled || account.isSuperAdmin);

  return (
    <select
      value={activeAccount?.username || ''}
      onChange={(event) => {
        const account = enabledAccounts.find((item) => item.username === event.target.value);
        if (account) onChange(account);
      }}
      className="w-full h-11 px-3 rounded-apple-btn bg-lightest-gray-background text-[13px] font-bold text-midnight-graphite outline-none border border-border-silver"
      aria-label="切换账号"
      disabled={isLoading}
    >
      {enabledAccounts.map((account) => (
        <option key={account.id} value={account.username}>
          {getMobileAccountLabel(account)}
        </option>
      ))}
    </select>
  );
}

export default function AppLayout({
  children,
  onLogout,
  onPerspectiveChange,
  activeUsername,
  activeAdminView,
  onOpenAccountAdmin,
  onOpenAiAssistant,
  onOpenOrganizationAdmin,
  onOpenWorkflowAdmin,
  onOpenAiBranchLogs,
  selectedModule,
  selectedType,
  onSelectType
}: AppLayoutProps) {
  const user = auth.getCurrentUser();
  const sessionUser = auth.getSessionUser();
  const perspective = auth.getPerspective();
  const currentUsername = activeUsername || user?.username || '';
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = React.useState(false);
  const [accounts, setAccounts] = React.useState<SystemAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(false);

  React.useEffect(() => {
    if (sessionUser?.role !== 'developer') return;

    let isMounted = true;
    setIsLoadingAccounts(true);
    storage.getAccounts()
      .then((nextAccounts) => {
        if (isMounted) setAccounts(nextAccounts);
      })
      .catch(() => {
        if (isMounted) setAccounts([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAccounts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionUser?.role]);

  const handleAccountChange = (account: SystemAccount) => {
    auth.setActiveAccount(account);
    onPerspectiveChange(auth.getCurrentUser()?.role || account.role);
  };

  const displayRole = getPerspectiveLabel(perspective || user?.role || 'employee');
  const isDeveloper = sessionUser?.role === 'developer';
  const activeAccount = React.useMemo(() => {
    return accounts.find((account) => account.username === currentUsername) || null;
  }, [accounts, currentUsername]);

  return (
    <div className="flex h-screen bg-canvas-white overflow-hidden relative">
      <Sidebar
        currentPerspective={perspective || 'employee'}
        selectedModule={selectedModule}
        selectedType={selectedType}
        isSuperAdmin={isDeveloper}
        activeAdminView={activeAdminView}
        onOpenAccountAdmin={() => {
          onOpenAccountAdmin();
          setIsSidebarOpen(false);
        }}
        onOpenAiAssistant={() => {
          onOpenAiAssistant();
          setIsSidebarOpen(false);
        }}
        onOpenOrganizationAdmin={() => {
          onOpenOrganizationAdmin();
          setIsSidebarOpen(false);
        }}
        onOpenWorkflowAdmin={() => {
          onOpenWorkflowAdmin();
          setIsSidebarOpen(false);
        }}
        onOpenAiBranchLogs={() => {
          onOpenAiBranchLogs();
          setIsSidebarOpen(false);
        }}
        onSelectType={(m, t) => {
          onSelectType(m, t);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        isDesktopCollapsed={isDesktopSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
      />

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <header className="glass grow-0 shrink-0 z-30">
          <div className="h-16 lg:h-20 flex items-center justify-between px-6 lg:px-12">
            <div className="flex items-center gap-4 lg:gap-6 min-w-0">
              <button
                type="button"
                onClick={() => setIsDesktopSidebarCollapsed((current) => !current)}
                className="hidden lg:flex w-10 h-10 items-center justify-center rounded-full text-midnight-graphite hover:bg-lightest-gray-background transition-colors"
                aria-label={isDesktopSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                title={isDesktopSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
              >
                {isDesktopSidebarCollapsed
                  ? <PanelLeftOpen size={18} strokeWidth={2.3} />
                  : <PanelLeftClose size={18} strokeWidth={2.3} />}
              </button>
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 flex items-center justify-center lg:hidden text-midnight-graphite"
              >
                <div className="flex flex-col gap-1.5 w-5">
                  <span className="w-full h-0.5 bg-midnight-graphite rounded-full" />
                  <span className="w-full h-0.5 bg-midnight-graphite rounded-full" />
                </div>
              </button>
              {isDeveloper && (
                <div className="hidden sm:block">
                  <AccountSwitcher
                    activeAccount={activeAccount}
                    accounts={accounts}
                    isLoading={isLoadingAccounts}
                    onChange={handleAccountChange}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 lg:gap-8">
              <div className="flex items-center gap-3 lg:gap-4 group cursor-pointer">
                <div className="hidden sm:flex flex-col items-end">
                  <p className="text-[14px] font-semibold text-midnight-graphite tracking-tight leading-none">{displayRole}</p>
                </div>

                <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-lightest-gray-background text-midnight-graphite flex items-center justify-center font-semibold text-[14px] transition-transform group-hover:scale-95 duration-500">
                  {displayRole.charAt(0)}
                </div>
              </div>

              <div className="w-px h-4 bg-border-silver" />

              <button
                onClick={onLogout}
                className="w-10 h-10 lg:w-11 lg:h-11 flex items-center justify-center text-medium-gray hover:text-interactive-blue transition-all duration-300"
                title="退出登录"
              >
                <LogOut size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          {isDeveloper && (
            <div className="sm:hidden px-5 pb-3">
              <MobileAccountSwitcher
                activeAccount={activeAccount}
                accounts={accounts}
                isLoading={isLoadingAccounts}
                onChange={handleAccountChange}
              />
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar pt-12 lg:pt-16 px-6 lg:px-20 pb-40">
          <div className="max-w-[1680px] mx-auto min-h-full flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${perspective || 'employee'}:${currentUsername}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="flex-1"
              >
                {children}
              </motion.div>
            </AnimatePresence>
            <footer className="pt-12 text-center">
              <p className="text-[11px] font-bold text-light-gray">
                © 2026 MJ审批. All rights reserved.
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
