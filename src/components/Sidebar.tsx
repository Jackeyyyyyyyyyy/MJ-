import React, { useState } from 'react';
import { approvalSchema } from '../approvalSchema';
import { AdminView, Role } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Bot,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  Layers,
  LogOut,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Workflow,
  X,
} from 'lucide-react';
import type { WorkTab } from './WorkHome';
import type { SettingsPanel } from './SettingsPage';

interface SidebarProps {
  currentPerspective: Role;
  selectedModule?: string;
  selectedType?: string;
  onSelectType: (module: string, type: string) => void;
  isSuperAdmin?: boolean;
  activeAdminView?: AdminView | null;
  activeWorkTab?: WorkTab;
  onWorkTabChange?: (tab: WorkTab) => void;
  onOpenAccountAdmin?: () => void;
  onOpenAiAssistant?: () => void;
  onOpenOrganizationAdmin?: () => void;
  onOpenWorkflowAdmin?: () => void;
  onOpenBusinessFormAdmin?: () => void;
  onOpenAiBranchLogs?: () => void;
  onOpenSettings?: (panel?: SettingsPanel) => void;
  onLogout?: () => void;
  isOpen?: boolean;
  isDesktopCollapsed?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  currentPerspective,
  selectedModule,
  selectedType,
  onSelectType,
  isSuperAdmin,
  activeAdminView,
  activeWorkTab,
  onWorkTabChange,
  onOpenAccountAdmin,
  onOpenAiAssistant,
  onOpenOrganizationAdmin,
  onOpenWorkflowAdmin,
  onOpenBusinessFormAdmin,
  onOpenAiBranchLogs,
  onOpenSettings,
  onLogout,
  isOpen,
  isDesktopCollapsed,
  onClose,
}: SidebarProps) {
  const isSuperAdminPerspective = Boolean(isSuperAdmin && currentPerspective === 'developer');
  const canUseAiAssistant = currentPerspective === 'boss' || isSuperAdminPerspective;
  const isAiAssistantActive = activeAdminView === 'ai-assistant' || activeAdminView === 'ai-branch-logs';
  const businessModules = isSuperAdminPerspective ? approvalSchema.modules : [];
  const [isAiAssistantExpanded, setIsAiAssistantExpanded] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    [businessModules[0]?.name || '']: true,
  });

  const toggleModule = (moduleName: string) => {
    setExpandedModules((current) => ({
      ...current,
      [moduleName]: !current[moduleName],
    }));
  };

  const handleWorkTabChange = (tab: WorkTab) => {
    if (onWorkTabChange) {
      onWorkTabChange(tab);
      return;
    }

    if (tab !== 'efficiency') {
      onSelectType('', '');
    }
  };

  const workNavItems = [
    { id: 'approvals', label: '审批中心', icon: ClipboardCheck, tab: 'approvals' as WorkTab },
    { id: 'efficiency', label: '效率诊断', icon: BarChart3, tab: 'efficiency' as WorkTab },
  ];

  const adminItems = [
    ...(isSuperAdminPerspective
      ? [
          {
            id: 'accounts' as AdminView,
            label: '账号权限管理',
            icon: ShieldCheck,
            onClick: onOpenAccountAdmin,
          },
          {
            id: 'organization' as AdminView,
            label: '组织架构',
            icon: Building2,
            onClick: onOpenOrganizationAdmin,
          },
          {
            id: 'workflows' as AdminView,
            label: '审批流配置',
            icon: Workflow,
            onClick: onOpenWorkflowAdmin,
          },
          {
            id: 'business-forms' as AdminView,
            label: '业务表单',
            icon: FilePlus2,
            onClick: onOpenBusinessFormAdmin,
          },
        ]
      : []),
  ];

  const aiAssistantItems = [
    {
      id: 'ai-assistant' as AdminView,
      label: '助手概览',
      icon: MessageSquareText,
      onClick: onOpenAiAssistant,
      visible: canUseAiAssistant,
    },
    {
      id: 'ai-branch-logs' as AdminView,
      label: '分化日志',
      icon: ClipboardList,
      onClick: onOpenAiBranchLogs,
      visible: isSuperAdminPerspective,
    },
  ].filter((item) => item.visible);

  return (
    <div className={cn(
      'fixed inset-y-0 left-0 z-50 flex h-full w-full max-w-none shrink-0 flex-col border-r-0 bg-[#f4f4f8] transition-transform duration-300 lg:relative lg:w-[240px] lg:max-w-none lg:border-r lg:border-border-silver lg:bg-canvas-white',
      isOpen ? 'translate-x-0 lg:shadow-apple-xl' : '-translate-x-full',
      isDesktopCollapsed ? 'lg:absolute lg:-translate-x-full lg:pointer-events-none' : 'lg:translate-x-0',
    )}>
      <div className="flex h-[76px] items-center justify-between px-5 pb-2 pt-3 lg:h-20 lg:px-8 lg:pb-0 lg:pt-0">
        <div className="flex items-center gap-3">
          <img
            src="/mj-logo.png"
            alt="MJ 审批"
            className="h-7 w-7 object-contain"
          />
          <span className="text-[18px] font-bold tracking-tight text-midnight-graphite">MJ 审批</span>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-medium-gray shadow-[0_1px_2px_rgba(16,24,40,0.035)] ring-1 ring-black/[0.035] transition-colors hover:text-midnight-graphite lg:hidden"
          aria-label="关闭侧边栏"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-1 text-sf-pro-text lg:space-y-10 lg:px-6 lg:pb-0 lg:pt-8">
        <section className="rounded-[22px] bg-white p-2.5 shadow-[0_1px_2px_rgba(20,24,34,0.022)] ring-1 ring-black/[0.025] lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0">
          <div className="mb-1.5 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-light-gray lg:mb-4">
            <span>导航</span>
          </div>
          {workNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = !selectedModule && !selectedType && !activeAdminView && (
              item.id === 'approvals'
                ? activeWorkTab !== 'efficiency'
                : activeWorkTab === item.tab
            );

            return (
              <button
                key={item.id}
                onClick={() => handleWorkTabChange(item.tab)}
                className={cn(
                  'group mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-[16px] px-3 py-2 text-[14px] font-medium transition-all first:mt-0 lg:min-h-0 lg:rounded-apple-btn',
                  isActive
                    ? 'bg-[#f1f2f5] text-midnight-graphite lg:bg-interactive-blue lg:text-white'
                    : 'text-deep-gray hover:bg-lightest-gray-background',
                )}
              >
                <Icon size={16} strokeWidth={2} />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => onOpenSettings?.('home')}
            className={cn(
              'group mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-[16px] px-3 py-2 text-[14px] font-medium transition-all lg:min-h-0 lg:rounded-apple-btn',
              activeAdminView === 'settings'
                ? 'bg-[#f1f2f5] text-midnight-graphite lg:bg-interactive-blue lg:text-white'
                : 'text-deep-gray hover:bg-lightest-gray-background',
            )}
          >
            <Settings size={16} strokeWidth={2} />
            <span>设置</span>
          </button>
        </section>

        {(aiAssistantItems.length > 0 || adminItems.length > 0) && (
          <section className={cn(
            "rounded-[22px] bg-white p-2.5 shadow-[0_1px_2px_rgba(20,24,34,0.022)] ring-1 ring-black/[0.025] lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0",
            isSuperAdminPerspective && "hidden lg:block",
          )}>
            <div className="mb-1.5 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-light-gray lg:mb-4">
              <span>系统管理</span>
            </div>

            <div className="space-y-0.5">
              {aiAssistantItems.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsAiAssistantExpanded((current) => !current)}
                    className={cn(
                      'flex min-h-[44px] w-full items-center justify-between rounded-[16px] px-3 py-2 text-[14px] font-medium transition-all lg:min-h-0 lg:rounded-apple-btn',
                      isAiAssistantActive
                        ? 'bg-[#f1f2f5] text-midnight-graphite lg:bg-interactive-blue lg:text-white'
                        : 'text-deep-gray hover:bg-lightest-gray-background',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Bot size={16} strokeWidth={2} />
                      <span>简洁 AI 助手</span>
                    </span>
                    {isAiAssistantExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <AnimatePresence>
                    {isAiAssistantExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-5 mt-1 space-y-0.5 overflow-hidden border-l border-black/[0.06] pl-3 lg:ml-4 lg:border-border-silver lg:pl-4"
                      >
                        {aiAssistantItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={item.onClick}
                            className={cn(
                              'flex min-h-[38px] w-full items-center gap-2 rounded-[14px] px-3 py-1.5 text-left text-[13px] font-medium transition-all lg:min-h-0 lg:rounded-apple-btn',
                              activeAdminView === item.id
                                ? 'bg-[#f1f6ff] font-bold text-interactive-blue lg:bg-transparent'
                                : 'text-medium-gray hover:bg-lightest-gray-background hover:text-midnight-graphite',
                            )}
                          >
                            <item.icon size={14} strokeWidth={2.2} />
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {adminItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={cn(
                    'group flex min-h-[44px] w-full items-center gap-3 rounded-[16px] px-3 py-2 text-[14px] font-medium transition-all lg:min-h-0 lg:rounded-apple-btn',
                    activeAdminView === item.id
                      ? 'bg-[#f1f2f5] text-midnight-graphite lg:bg-interactive-blue lg:text-white'
                      : 'text-deep-gray hover:bg-lightest-gray-background',
                  )}
                >
                  <item.icon size={16} strokeWidth={2} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {isSuperAdminPerspective && businessModules.length > 0 && (
          <section className="hidden rounded-[22px] bg-white p-2.5 shadow-[0_1px_2px_rgba(20,24,34,0.022)] ring-1 ring-black/[0.025] lg:block lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0">
            <div className="mb-1.5 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-light-gray lg:mb-4">
              <span>业务模块</span>
            </div>
            <div className="space-y-0.5">
              {businessModules.map((module) => (
                <div key={module.name} className="space-y-0.5">
                  <button
                    onClick={() => toggleModule(module.name)}
                    className={cn(
                      'flex min-h-[44px] w-full items-center justify-between rounded-[16px] px-3 py-2 text-[14px] font-medium transition-all lg:min-h-0 lg:rounded-apple-btn',
                      selectedModule === module.name
                        ? 'bg-[#f1f2f5] text-midnight-graphite lg:bg-pure-white lg:text-interactive-blue lg:shadow-sm'
                        : 'text-deep-gray hover:bg-lightest-gray-background',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Layers size={16} strokeWidth={2} />
                      <span>{module.name}</span>
                    </div>
                    {expandedModules[module.name] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <AnimatePresence>
                    {expandedModules[module.name] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-5 mt-1 space-y-0.5 overflow-hidden border-l border-black/[0.06] pl-3 lg:ml-4 lg:border-border-silver lg:pl-4"
                      >
                        {module.approvalTypes.map((type) => (
                          <button
                            key={type.name}
                            onClick={() => onSelectType(module.name, type.name)}
                            className={cn(
                              'min-h-[38px] w-full rounded-[14px] px-3 py-1.5 text-left text-[13px] font-medium transition-all lg:min-h-0 lg:rounded-apple-btn',
                              selectedType === type.name
                                ? 'bg-[#f1f6ff] font-bold text-interactive-blue lg:bg-transparent'
                                : 'text-medium-gray hover:bg-lightest-gray-background hover:text-midnight-graphite',
                            )}
                          >
                            {type.name}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {onLogout && (
        <div className="border-t border-black/[0.04] bg-white px-6 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <button
            type="button"
            onClick={onLogout}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[13px] font-semibold text-[#d93025] shadow-[0_1px_2px_rgba(16,24,40,0.035)] transition-colors active:bg-[#f1f2f5]"
          >
            <LogOut size={16} strokeWidth={2.4} />
            <span>退出登录</span>
          </button>
        </div>
      )}
    </div>
  );
}
