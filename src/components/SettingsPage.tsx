import React from 'react';
import {
  Bell,
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Fingerprint,
  Layers,
  LogOut,
  MessageSquareText,
  ShieldCheck,
  UserRound,
  Workflow,
} from 'lucide-react';
import { approvalSchema } from '../approvalSchema';
import { AdminView } from '../types';
import { cn } from '../lib/utils';
import AccountProfileSettingsCard from './AccountProfileSettingsCard';
import NotificationSettingsCard from './NotificationSettingsCard';
import PasskeySettingsCard from './PasskeySettingsCard';

interface SettingsPageProps {
  activeUsername?: string;
  activePanel?: SettingsPanel;
  onPanelChange?: (panel: SettingsPanel) => void;
  isSuperAdmin?: boolean;
  selectedModule?: string;
  selectedType?: string;
  onOpenAccountAdmin?: () => void;
  onOpenAiAssistant?: () => void;
  onOpenOrganizationAdmin?: () => void;
  onOpenWorkflowAdmin?: () => void;
  onOpenBusinessFormAdmin?: () => void;
  onOpenAiBranchLogs?: () => void;
  onSelectType?: (module: string, type: string) => void;
  onLogout?: () => void;
}

export type SettingsPanel = 'home' | 'profile' | 'notifications' | 'passkeys';

interface SettingsRowProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  active?: boolean;
  onClick?: () => void;
}

interface AdminSettingsItem extends SettingsRowProps {
  id: AdminView;
  onClick: () => void;
}

function isAvailableAdminItem(item: SettingsRowProps & { id: AdminView }): item is AdminSettingsItem {
  return Boolean(item.onClick);
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-2.5 text-[14px] font-medium text-[#9a9da5] sm:text-[12px] sm:font-semibold sm:uppercase sm:tracking-wider">
        {title}
      </h2>
      <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(20,24,34,0.018)] ring-1 ring-black/[0.02] sm:rounded-[8px] sm:border sm:border-border-silver sm:shadow-sm sm:ring-0">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({ icon: Icon, title, active, onClick }: SettingsRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[58px] w-full items-center gap-4 border-b border-black/[0.045] px-6 py-2 text-left transition-colors last:border-b-0 active:bg-black/[0.035] sm:min-h-[54px] sm:px-5',
        active && 'bg-[#f1f6ff]',
      )}
    >
      <span className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center text-midnight-graphite',
        active && 'text-interactive-blue',
      )}>
        <Icon size={21} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[18px] font-medium text-midnight-graphite sm:text-[15px]">
          {title}
        </span>
      </span>
      {onClick && <ChevronRight size={21} strokeWidth={1.9} className="shrink-0 text-[#a7aab1]" />}
    </button>
  );
}

function DetailShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3.5">
      <div className="flex min-h-[44px] items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-midnight-graphite transition-colors active:bg-black/[0.04] sm:bg-white sm:ring-1 sm:ring-border-silver"
          aria-label="返回设置"
        >
          <ChevronLeft size={24} strokeWidth={2.2} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold tracking-tight text-midnight-graphite sm:text-[26px]">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-[12px] font-medium text-medium-gray">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage({
  activeUsername,
  activePanel: controlledActivePanel,
  onPanelChange,
  isSuperAdmin = false,
  onOpenAccountAdmin,
  onOpenAiAssistant,
  onOpenOrganizationAdmin,
  onOpenWorkflowAdmin,
  onOpenBusinessFormAdmin,
  onOpenAiBranchLogs,
  onSelectType,
  onLogout,
}: SettingsPageProps) {
  const [internalActivePanel, setInternalActivePanel] = React.useState<SettingsPanel>('home');
  const [desktopOnlyTitle, setDesktopOnlyTitle] = React.useState('');
  const activePanel = controlledActivePanel ?? internalActivePanel;

  const setActivePanel = React.useCallback((panel: SettingsPanel) => {
    if (controlledActivePanel === undefined) {
      setInternalActivePanel(panel);
    }
    onPanelChange?.(panel);
  }, [controlledActivePanel, onPanelChange]);

  const openDesktopOnlyPage = React.useCallback((title: string) => {
    setDesktopOnlyTitle(title);
  }, []);

  const adminItems = ([
    { id: 'ai-assistant', title: '简洁 AI 助手', subtitle: 'OA 审批助手与提示词', icon: Bot, onClick: onOpenAiAssistant },
    { id: 'ai-branch-logs', title: 'AI 分化日志', subtitle: '查看 AI 分支判断记录', icon: MessageSquareText, onClick: onOpenAiBranchLogs },
    { id: 'accounts', title: '账号权限管理', subtitle: '账号、角色与启停权限', icon: ShieldCheck, onClick: onOpenAccountAdmin },
    { id: 'organization', title: '组织架构', subtitle: '部门、成员与上下级关系', icon: Building2, onClick: onOpenOrganizationAdmin },
    { id: 'workflows', title: '审批流配置', subtitle: '配置审批人与办理节点', icon: Workflow, onClick: onOpenWorkflowAdmin },
    { id: 'business-forms', title: '业务表单', subtitle: '管理审批表单字段', icon: FilePlus2, onClick: onOpenBusinessFormAdmin },
  ] satisfies Array<SettingsRowProps & { id: AdminView }>).filter(isAvailableAdminItem);

  if (activePanel === 'profile') {
    return (
      <DetailShell title="账号资料" subtitle="头像与密码" onBack={() => setActivePanel('home')}>
        <AccountProfileSettingsCard activeUsername={activeUsername} />
      </DetailShell>
    );
  }

  if (activePanel === 'notifications') {
    return (
      <DetailShell title="启用通知" subtitle="电脑/手机系统通知" onBack={() => setActivePanel('home')}>
        <NotificationSettingsCard activeUsername={activeUsername} />
      </DetailShell>
    );
  }

  if (activePanel === 'passkeys') {
    return (
      <DetailShell title="Face ID / 通行密钥" subtitle="设备密码登录" onBack={() => setActivePanel('home')}>
        <PasskeySettingsCard activeUsername={activeUsername} />
      </DetailShell>
    );
  }

  if (desktopOnlyTitle) {
    return (
      <DetailShell title={desktopOnlyTitle} subtitle="电脑端功能" onBack={() => setDesktopOnlyTitle('')}>
        <section className="flex min-h-[360px] flex-col items-center justify-center rounded-[22px] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(20,24,34,0.018)] ring-1 ring-black/[0.02] sm:rounded-[8px] sm:border sm:border-border-silver sm:shadow-sm sm:ring-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#f5f6f8] text-medium-gray">
            <Layers size={26} strokeWidth={2.2} />
          </div>
          <h2 className="mt-5 text-[22px] font-semibold tracking-tight text-midnight-graphite">
            请使用电脑端查看
          </h2>
          <p className="mt-2 max-w-[260px] text-[14px] font-medium leading-6 text-medium-gray">
            该功能涉及较多配置项，手机端暂不开放编辑与查看。
          </p>
        </section>
      </DetailShell>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-7 pb-[calc(116px+env(safe-area-inset-bottom))] sm:gap-6 sm:pb-0">
      <SettingsSection title="账号与安全">
        <SettingsRow
          icon={UserRound}
          title="账号资料"
          subtitle="头像与密码"
          onClick={() => setActivePanel('profile')}
        />
        <SettingsRow
          icon={Bell}
          title="启用通知"
          subtitle="电脑/手机系统通知"
          onClick={() => setActivePanel('notifications')}
        />
        <SettingsRow
          icon={Fingerprint}
          title="Face ID / 通行密钥"
          subtitle="绑定后可用设备密码登录"
          onClick={() => setActivePanel('passkeys')}
        />
      </SettingsSection>

      {isSuperAdmin && adminItems.length > 0 && (
        <div className="lg:hidden">
          <SettingsSection title="系统管理">
            {adminItems.map((item) => (
              <React.Fragment key={item.id}>
                <SettingsRow
                  icon={item.icon}
                  title={item.title}
                  subtitle={item.subtitle}
                  onClick={() => openDesktopOnlyPage(item.title)}
                />
              </React.Fragment>
            ))}
          </SettingsSection>
        </div>
      )}

      {isSuperAdmin && onSelectType && (
        <section className="space-y-2 lg:hidden">
          <h2 className="px-2.5 text-[14px] font-medium text-[#9a9da5] sm:text-[12px] sm:font-semibold sm:uppercase sm:tracking-wider">
            业务模块
          </h2>
          <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(20,24,34,0.018)] ring-1 ring-black/[0.02] sm:rounded-[8px] sm:border sm:border-border-silver sm:shadow-sm sm:ring-0">
            {approvalSchema.modules.map((module) => {
              return (
                <div key={module.name} className="border-b border-black/[0.045] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => openDesktopOnlyPage(module.name)}
                    className="flex min-h-[58px] w-full items-center gap-4 px-6 py-2 text-left transition-colors active:bg-black/[0.035] sm:min-h-[54px] sm:px-5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-midnight-graphite">
                      <Layers size={21} strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[18px] font-medium text-midnight-graphite sm:text-[15px]">
                        {module.name}
                      </span>
                    </span>
                    <ChevronRight size={21} strokeWidth={1.9} className="shrink-0 text-[#a7aab1]" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {onLogout && (
        <div className="lg:hidden">
          <button
            type="button"
            onClick={onLogout}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-[#d93025] shadow-[0_1px_2px_rgba(16,24,40,0.035)] ring-1 ring-black/[0.025] transition-colors active:bg-[#f1f2f5]"
          >
            <LogOut size={17} strokeWidth={2.4} />
            <span>退出登录</span>
          </button>
        </div>
      )}
    </div>
  );
}
