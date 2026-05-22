import React, { useState } from 'react';
import { approvalSchema } from '../approvalSchema';
import { AdminView, Role } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  Home,
  Layers,
  LayoutDashboard,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Workflow,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentPerspective: Role;
  selectedModule?: string;
  selectedType?: string;
  onSelectType: (module: string, type: string) => void;
  isSuperAdmin?: boolean;
  activeAdminView?: AdminView | null;
  onOpenAccountAdmin?: () => void;
  onOpenAiAssistant?: () => void;
  onOpenAiAssistantPrompt?: () => void;
  onOpenOrganizationAdmin?: () => void;
  onOpenWorkflowAdmin?: () => void;
  onOpenBusinessFormAdmin?: () => void;
  onOpenAiBranchLogs?: () => void;
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
  onOpenAccountAdmin,
  onOpenAiAssistant,
  onOpenAiAssistantPrompt,
  onOpenOrganizationAdmin,
  onOpenWorkflowAdmin,
  onOpenBusinessFormAdmin,
  onOpenAiBranchLogs,
  isOpen,
  isDesktopCollapsed,
  onClose,
}: SidebarProps) {
  const isSuperAdminPerspective = Boolean(isSuperAdmin && currentPerspective === 'developer');
  const canUseAiAssistant = currentPerspective === 'boss' || isSuperAdminPerspective;
  const isAiAssistantActive = activeAdminView === 'ai-assistant' || activeAdminView === 'ai-assistant-prompt' || activeAdminView === 'ai-branch-logs';
  const [isAiAssistantExpanded, setIsAiAssistantExpanded] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    [approvalSchema.modules[0].name]: true,
  });

  const toggleModule = (moduleName: string) => {
    setExpandedModules((current) => ({
      ...current,
      [moduleName]: !current[moduleName],
    }));
  };

  const homeLabel = currentPerspective === 'boss' || isSuperAdminPerspective ? '工作台与全局数据' : '员工工作台';

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
      id: 'ai-assistant-prompt' as AdminView,
      label: '提示词设置',
      icon: Settings2,
      onClick: onOpenAiAssistantPrompt,
      visible: isSuperAdminPerspective,
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
      'fixed inset-y-0 left-0 z-50 flex h-full w-[240px] shrink-0 flex-col border-r border-border-silver bg-canvas-white transition-transform duration-500 lg:relative',
      isOpen ? 'translate-x-0 shadow-apple-xl' : '-translate-x-full',
      isDesktopCollapsed ? 'lg:absolute lg:-translate-x-full lg:pointer-events-none' : 'lg:translate-x-0',
    )}>
      <div className="flex h-16 items-center justify-between px-8 lg:h-20">
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
          className="flex h-8 w-8 items-center justify-center text-medium-gray transition-colors hover:text-midnight-graphite lg:hidden"
          aria-label="关闭侧边栏"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className="no-scrollbar flex-1 space-y-10 overflow-y-auto px-6 pt-8 text-sf-pro-text">
        <section>
          <div className="mb-4 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-light-gray">
            <span>导航</span>
          </div>
          <button
            onClick={() => onSelectType('', '')}
            className={cn(
              'group flex w-full items-center gap-3 rounded-apple-btn px-3 py-2 text-[14px] font-medium transition-all',
              !selectedModule && !selectedType && !activeAdminView
                ? 'bg-interactive-blue text-white'
                : 'text-deep-gray hover:bg-lightest-gray-background',
            )}
          >
            {currentPerspective === 'boss' ? <LayoutDashboard size={16} strokeWidth={2} /> : <Home size={16} strokeWidth={2} />}
            <span>{homeLabel}</span>
          </button>
        </section>

        {(aiAssistantItems.length > 0 || adminItems.length > 0) && (
          <section>
            <div className="mb-4 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-light-gray">
              <span>系统管理</span>
            </div>

            <div className="space-y-0.5">
              {aiAssistantItems.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsAiAssistantExpanded((current) => !current)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-apple-btn px-3 py-2 text-[14px] font-medium transition-all',
                      isAiAssistantActive
                        ? 'bg-interactive-blue text-white'
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
                        className="ml-4 mt-0.5 space-y-0.5 overflow-hidden border-l border-border-silver pl-4"
                      >
                        {aiAssistantItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={item.onClick}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-apple-btn px-3 py-1.5 text-left text-[13px] font-medium transition-all',
                              activeAdminView === item.id
                                ? 'font-bold text-interactive-blue'
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
                    'group flex w-full items-center gap-3 rounded-apple-btn px-3 py-2 text-[14px] font-medium transition-all',
                    activeAdminView === item.id
                      ? 'bg-interactive-blue text-white'
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

        <section>
          <div className="mb-4 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-light-gray">
            <span>业务模块</span>
          </div>
          <div className="space-y-0.5">
            {approvalSchema.modules.map((module) => (
              <div key={module.name} className="space-y-0.5">
                <button
                  onClick={() => toggleModule(module.name)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-apple-btn px-3 py-2 text-[14px] font-medium transition-all',
                    selectedModule === module.name
                      ? 'bg-pure-white text-interactive-blue shadow-sm'
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
                      className="ml-4 mt-0.5 space-y-0.5 overflow-hidden border-l border-border-silver pl-4"
                    >
                      {module.approvalTypes.map((type) => (
                        <button
                          key={type.name}
                          onClick={() => onSelectType(module.name, type.name)}
                          className={cn(
                            'w-full rounded-apple-btn px-3 py-1.5 text-left text-[13px] font-medium transition-all',
                            selectedType === type.name
                              ? 'font-bold text-interactive-blue'
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
      </div>
    </div>
  );
}
