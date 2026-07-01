import React, { Component } from 'react';
import { auth } from '../auth';
import { storage } from '../storage';
import Sidebar from './Sidebar';
import { BarChart3, ChevronDown, ClipboardCheck, LogOut, PanelLeftClose, PanelLeftOpen, Search, Settings, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import { AdminView, ApprovalNotification, ApprovalRecord, Role, SystemAccount } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import NotificationCenter from './NotificationCenter';
import type { WorkTab } from './WorkHome';
import type { SettingsPanel } from './SettingsPage';

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
  onOpenBusinessFormAdmin: () => void;
  onOpenAiBranchLogs: () => void;
  onOpenSettings: (panel?: SettingsPanel) => void;
  onOpenNotificationRecord?: (notification: ApprovalNotification, record: ApprovalRecord) => void;
  selectedModule?: string;
  selectedType?: string;
  onSelectType: (module: string, type: string) => void;
  activeWorkTab?: WorkTab;
  onWorkTabChange?: (tab: WorkTab) => void;
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
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
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

function getAccountAvatarUrl(account?: Pick<SystemAccount, 'avatarUrl'> | null) {
  return account?.avatarUrl || '';
}

function AccountAvatar({
  account,
  label,
  sizeClassName = 'w-8 h-8',
  iconSize = 16,
  selected = false,
}: {
  account?: Pick<SystemAccount, 'avatarUrl' | 'isSuperAdmin'> | null;
  label: string;
  sizeClassName?: string;
  iconSize?: number;
  selected?: boolean;
}) {
  const avatarUrl = getAccountAvatarUrl(account);

  return (
    <span className={cn(
      "rounded-full flex items-center justify-center shrink-0 overflow-hidden",
      avatarUrl ? "bg-white" : selected ? "bg-white/20" : "bg-lightest-gray-background",
      sizeClassName,
    )}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={label} className="h-full w-full object-cover" />
      ) : account?.isSuperAdmin ? (
        <ShieldCheck size={iconSize} strokeWidth={2.4} />
      ) : (
        <UserRound size={iconSize} strokeWidth={2.4} />
      )}
    </span>
  );
}

function AccountSwitcher({
  activeAccount,
  accounts,
  isLoading,
  onChange,
  className,
  buttonClassName,
  menuClassName,
}: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
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

  React.useEffect(() => {
    if (isOpen) window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [isOpen]);

  const selectedAccount = activeAccount || enabledAccounts.find((account) => account.isSuperAdmin) || null;
  const selectedLabel = selectedAccount ? getAccountPrimaryLabel(selectedAccount) : '选择账号';
  const selectedRole = selectedAccount ? getAccountSecondaryLabel(selectedAccount) : '账号视角';

  return (
    <div ref={rootRef} className={cn("relative w-[260px] max-w-full", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "w-full h-11 px-3 rounded-apple-btn bg-lightest-gray-background hover:bg-white border border-transparent hover:border-border-silver transition-all flex items-center justify-between gap-3 text-left",
          buttonClassName,
        )}
        aria-expanded={isOpen}
        aria-label="切换账号"
      >
        <span className="flex items-center gap-3 min-w-0">
          <AccountAvatar account={selectedAccount} label={selectedLabel} sizeClassName="w-7 h-7 shadow-sm" iconSize={15} />
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
            className={cn(
              "absolute left-0 top-[calc(100%+8px)] z-50 w-[320px] max-w-[calc(100vw-40px)] rounded-2xl border border-border-silver bg-white shadow-apple-xl overflow-hidden",
              menuClassName,
            )}
          >
            <div className="p-3 border-b border-border-silver">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-light-silver w-3.5 h-3.5" />
                <input
                  ref={searchInputRef}
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
                  <AccountAvatar
                    account={account}
                    label={getAccountPrimaryLabel(account)}
                    selected={selectedAccount?.username === account.username}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">
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
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const enabledAccounts = React.useMemo(
    () => accounts.filter((account) => account.enabled || account.isSuperAdmin),
    [accounts],
  );
  const filteredAccounts = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return enabledAccounts;

    return enabledAccounts.filter((account) => {
      const linkedMember = account.linkedMember;
      const haystack = [
        account.name,
        account.accountName,
        account.username,
        account.roleLabel,
        linkedMember?.name,
        linkedMember?.departmentName,
        linkedMember?.title,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(keyword);
    });
  }, [enabledAccounts, query]);
  const selectedAccount = activeAccount || enabledAccounts.find((account) => account.isSuperAdmin) || null;
  const selectedLabel = selectedAccount ? getAccountPrimaryLabel(selectedAccount) : '超管端';
  const selectedSummary = isLoading
    ? '正在读取员工账号'
    : selectedAccount
      ? getMobileAccountLabel(selectedAccount)
      : '选择员工账号';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-[34px] w-full items-center justify-between gap-2.5 rounded-[16px] border border-white/68 bg-white/64 px-3 py-1 text-left shadow-none backdrop-blur transition-all active:scale-[0.99]"
        aria-label="切换员工账号"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[9px] bg-[#eef5ff] text-interactive-blue">
            <UsersRound size={15} strokeWidth={2.45} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold text-midnight-graphite">切换员工</span>
            <span className="block truncate text-[10px] font-medium text-light-gray">
              {selectedSummary}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#f0f1f5] px-2.5 py-0.5 text-[10px] font-semibold text-midnight-graphite">
          {selectedLabel}
          <ChevronDown size={12} strokeWidth={2.5} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative mt-2 overflow-hidden rounded-[20px] border border-white/85 bg-white shadow-[0_6px_18px_rgba(16,24,40,0.075)] lg:hidden"
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#f3f4f7] text-medium-gray"
              aria-label="关闭"
            >
              <X size={15} strokeWidth={2.5} />
            </button>

            <div className="border-b border-black/[0.04] px-3.5 py-2.5 pr-12">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-light-silver" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-9 w-full rounded-[14px] bg-[#f5f6f8] pl-10 pr-3.5 text-[12.5px] font-medium outline-none focus:ring-2 focus:ring-sky-blue-highlight"
                  placeholder="搜索姓名、账号或部门"
                />
              </div>
            </div>

            <div
              className="no-scrollbar overflow-y-auto px-2.5 py-2.5"
              style={{ maxHeight: 'min(190px, 36dvh)' }}
            >
              {isLoading && (
                <div className="px-3 py-7 text-center text-[12.5px] font-semibold text-medium-gray">正在读取员工账号...</div>
              )}

              {!isLoading && filteredAccounts.length === 0 && (
                <div className="px-3 py-7 text-center text-[12.5px] font-semibold text-medium-gray">没有匹配的员工账号</div>
              )}

              {!isLoading && filteredAccounts.map((account) => {
                const isSelected = selectedAccount?.username === account.username;

                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      onChange(account);
                      setQuery('');
                      setIsOpen(false);
                    }}
                    className={cn(
                      'mb-1 flex min-h-[48px] w-full items-center gap-2.5 rounded-[15px] px-3 py-2 text-left transition-all last:mb-0',
                      isSelected ? 'bg-interactive-blue text-white' : 'text-midnight-graphite hover:bg-[#f5f6f8]',
                    )}
                  >
                    <AccountAvatar
                      account={account}
                      label={getAccountPrimaryLabel(account)}
                      selected={isSelected}
                      sizeClassName="h-8 w-8"
                      iconSize={15}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold">
                        {account.isSuperAdmin ? '超管端' : getAccountPrimaryLabel(account)}
                      </span>
                      <span className={cn(
                        'mt-0.5 block truncate text-[10.5px] font-medium',
                        isSelected ? 'text-white/78' : 'text-medium-gray',
                      )}>
                        {account.isSuperAdmin ? '返回独立管理入口' : getMobileAccountLabel(account)}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="rounded-full bg-white/18 px-2 py-0.5 text-[10px] font-semibold">当前</span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  resetKey: string;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  declare readonly props: RouteErrorBoundaryProps;

  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <section className="rounded-[18px] border border-white/70 bg-white p-4 shadow-[0_8px_22px_rgba(16,24,40,0.05)] sm:rounded-[8px] sm:border-border-silver sm:shadow-sm">
          <p className="text-[12px] font-black uppercase tracking-wider text-light-gray">Page Error</p>
          <h1 className="mt-2 text-[18px] font-bold text-midnight-graphite">页面加载失败</h1>
          <p className="mt-2 text-[13px] font-semibold leading-6 text-medium-gray">
            当前页面组件加载时遇到异常。返回工作台后可以继续使用审批系统。
          </p>
          <button
            type="button"
            onClick={() => window.location.assign('/work/requests')}
            className="mt-4 flex h-10 items-center justify-center rounded-full bg-interactive-blue px-5 text-[12px] font-bold text-white"
          >
            返回工作台
          </button>
        </section>
      );
    }

    return this.props.children;
  }
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
  onOpenBusinessFormAdmin,
  onOpenAiBranchLogs,
  onOpenSettings,
  onOpenNotificationRecord,
  selectedModule,
  selectedType,
  onSelectType,
  activeWorkTab,
  onWorkTabChange
}: AppLayoutProps) {
  const user = auth.getCurrentUser();
  const sessionUser = auth.getSessionUser();
  const perspective = auth.getPerspective();
  const currentUsername = activeUsername || user?.username || '';
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = React.useState(false);
  const [accounts, setAccounts] = React.useState<SystemAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(false);
  const [accountRefreshTick, setAccountRefreshTick] = React.useState(0);

  React.useEffect(() => {
    const handleAccountProfileUpdated = () => {
      setAccountRefreshTick((current) => current + 1);
    };

    window.addEventListener('mj-account-profile-updated', handleAccountProfileUpdated);
    return () => window.removeEventListener('mj-account-profile-updated', handleAccountProfileUpdated);
  }, []);

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
  }, [sessionUser?.role, accountRefreshTick]);

  const handleAccountChange = (account: SystemAccount) => {
    auth.setActiveAccount(account);
    onPerspectiveChange(auth.getCurrentUser()?.role || account.role);
  };

  const isDeveloper = sessionUser?.role === 'developer';
  const activeAccount = React.useMemo(() => {
    return accounts.find((account) => account.username === currentUsername) || null;
  }, [accounts, currentUsername]);
  const displayRole = getPerspectiveLabel(perspective || user?.role || 'employee');
  const displayName = activeAccount ? getAccountPrimaryLabel(activeAccount) : user?.name || currentUsername || displayRole;
  const displayInitial = displayName.trim().charAt(0) || displayRole.charAt(0);
  const displayAvatarUrl = activeAccount?.avatarUrl || user?.avatarUrl || '';
  const routeResetKey = `${currentUsername}:${activeAdminView || 'work'}:${selectedModule || ''}:${selectedType || ''}`;
  const mobileNavItems = [
    { id: 'approvals' as WorkTab, label: '审批中心', icon: ClipboardCheck },
    { id: 'efficiency' as WorkTab, label: '效率诊断', icon: BarChart3 },
  ];
  const handleMobileWorkTab = (tab: WorkTab) => {
    if (onWorkTabChange) {
      onWorkTabChange(tab);
      return;
    }

    if (tab === 'requests') {
      onSelectType('', '');
    }
  };

  return (
    <div className="flex h-screen bg-[#f5f6fa] lg:bg-canvas-white overflow-hidden relative">
      <Sidebar
        currentPerspective={perspective || 'employee'}
        selectedModule={selectedModule}
        selectedType={selectedType}
        isSuperAdmin={isDeveloper}
        activeAdminView={activeAdminView}
        activeWorkTab={activeWorkTab}
        onWorkTabChange={(tab) => {
          onWorkTabChange?.(tab);
          setIsSidebarOpen(false);
        }}
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
        onOpenBusinessFormAdmin={() => {
          onOpenBusinessFormAdmin();
          setIsSidebarOpen(false);
        }}
        onOpenAiBranchLogs={() => {
          onOpenAiBranchLogs();
          setIsSidebarOpen(false);
        }}
        onOpenSettings={() => {
          onOpenSettings();
          setIsSidebarOpen(false);
        }}
        onLogout={onLogout}
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
            className="fixed inset-0 bg-black/16 backdrop-blur-[2px] z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <header className="grow-0 shrink-0 z-30 border-b border-transparent bg-[#f5f6fa]/92 backdrop-blur-xl lg:glass lg:border-border-silver">
          <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 pb-1 pt-2.5 lg:hidden">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex min-w-0 items-center gap-3 text-left"
              aria-label="打开导航"
            >
              <img
                src="/mj-logo.png"
                alt="MJ 审批"
                className="h-6 w-6 shrink-0 object-contain"
              />
              <span className="truncate text-[21px] font-bold tracking-normal text-midnight-graphite">
                MJ 审批
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <NotificationCenter
                activeUsername={currentUsername}
                onOpenRecord={onOpenNotificationRecord}
              />
            </div>
          </div>

          <div className="hidden h-20 items-center justify-between px-12 lg:flex">
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
                className="w-9 h-9 flex items-center justify-center lg:hidden text-midnight-graphite"
              >
                <div className="flex flex-col gap-1.5 w-5">
                  <span className="w-full h-0.5 bg-midnight-graphite rounded-full" />
                  <span className="w-full h-0.5 bg-midnight-graphite rounded-full" />
                </div>
              </button>
              {isDeveloper && (
                <div className="hidden min-w-[260px] sm:block">
                  <AccountSwitcher
                    activeAccount={activeAccount}
                    accounts={accounts}
                    isLoading={isLoadingAccounts}
                    onChange={handleAccountChange}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 lg:gap-8">
              <NotificationCenter
                activeUsername={currentUsername}
                onOpenRecord={onOpenNotificationRecord}
              />

              <div className="flex items-center gap-3 lg:gap-4 group cursor-pointer">
                <div className="hidden sm:flex flex-col items-end">
                  <p className="text-[14px] font-semibold text-midnight-graphite tracking-tight leading-none">{displayName}</p>
                </div>

                <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-lightest-gray-background text-midnight-graphite flex items-center justify-center font-semibold text-[14px] overflow-hidden transition-transform group-hover:scale-95 duration-500">
                  {displayAvatarUrl ? (
                    <img src={displayAvatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    displayInitial
                  )}
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
            <div className="px-4 pb-2 lg:hidden">
              <MobileAccountSwitcher
                activeAccount={activeAccount}
                accounts={accounts}
                isLoading={isLoadingAccounts}
                onChange={handleAccountChange}
              />
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar bg-[#f5f6fa] px-4 pb-[calc(84px+env(safe-area-inset-bottom))] pt-1 lg:bg-transparent lg:px-20 lg:pb-40 lg:pt-16">
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
                <RouteErrorBoundary key={routeResetKey} resetKey={routeResetKey}>
                  {children}
                </RouteErrorBoundary>
              </motion.div>
            </AnimatePresence>
            <footer className="hidden pt-8 text-center lg:block lg:pt-12">
              <p className="text-[11px] font-bold text-light-gray">
                © 2026 MJ审批. All rights reserved.
              </p>
            </footer>
          </div>
        </main>

        <nav
          className={cn(
            "fixed inset-x-5 bottom-[calc(9px+env(safe-area-inset-bottom))] z-40 grid h-[54px] grid-cols-3 items-center rounded-[27px] border border-white/75 bg-white/94 px-1.5 shadow-[0_5px_14px_rgba(20,24,34,0.045)] backdrop-blur-xl transition-all duration-200 lg:hidden",
            isSidebarOpen ? "pointer-events-none translate-y-3 opacity-0" : "translate-y-0 opacity-100",
          )}
        >
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = !selectedModule && !selectedType && !activeAdminView && (
              item.id === 'approvals'
                ? activeWorkTab !== 'efficiency'
                : activeWorkTab === item.id
            );

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleMobileWorkTab(item.id)}
                className={cn(
                  "mx-auto flex min-w-[62px] flex-col items-center justify-center gap-0.5 rounded-[22px] px-1 py-1 text-[10px] font-medium transition-all",
                  isActive ? "text-midnight-graphite" : "text-[#6f737c]",
                )}
              >
                <span className={cn(
                  "flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 transition-colors",
                  isActive ? "bg-[#f0f1f5]" : "bg-transparent",
                )}>
                  <Icon size={18} strokeWidth={2.25} />
                </span>
                <span className="leading-none">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onOpenSettings}
            className={cn(
              "mx-auto flex min-w-[62px] flex-col items-center justify-center gap-0.5 rounded-[22px] px-1 py-1 text-[10px] font-medium transition-all",
              activeAdminView === 'settings' ? "text-midnight-graphite" : "text-[#6f737c]",
            )}
          >
            <span className={cn(
              "flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 transition-colors",
              activeAdminView === 'settings' ? "bg-[#f0f1f5]" : "bg-transparent",
            )}>
              <Settings size={18} strokeWidth={2.25} />
            </span>
            <span className="leading-none">设置</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
