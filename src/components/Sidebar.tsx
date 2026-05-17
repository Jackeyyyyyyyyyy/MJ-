import React, { useState } from 'react';
import { approvalSchema } from '../approvalSchema';
import { AdminView, Role } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot,
  ChevronRight, 
  ChevronDown, 
  Layers, 
  Home,
  LayoutDashboard,
  ShieldCheck,
  Building2,
  Workflow,
  X
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
  onOpenOrganizationAdmin?: () => void;
  onOpenWorkflowAdmin?: () => void;
  isOpen?: boolean;
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
  onOpenOrganizationAdmin,
  onOpenWorkflowAdmin,
  isOpen,
  onClose,
}: SidebarProps) {
  const isSuperAdminPerspective = Boolean(isSuperAdmin && currentPerspective === 'developer');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    [approvalSchema.modules[0].name]: true
  });

  const toggleModule = (moduleName: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName]
    }));
  };

  const menuItems = [
    { 
      id: 'home', 
      label: currentPerspective === 'applicant' ? '我的申请台账' : (currentPerspective === 'approver' ? '审批任务中心' : '全局数据透视'),
      icon: currentPerspective === 'boss' ? LayoutDashboard : Home,
      onClick: () => onSelectType('', '') 
    },
  ];

  const adminItems = [
    ...(currentPerspective === 'boss' || isSuperAdminPerspective
      ? [
          {
            id: 'ai-assistant',
            label: 'AI 助手',
            icon: Bot,
            onClick: onOpenAiAssistant,
          },
        ]
      : []),
    ...(isSuperAdminPerspective
      ? [
          {
            id: 'accounts',
            label: '账号权限管理',
            icon: ShieldCheck,
            onClick: onOpenAccountAdmin,
          },
          {
            id: 'organization',
            label: '组织架构',
            icon: Building2,
            onClick: onOpenOrganizationAdmin,
          },
          {
            id: 'workflows',
            label: '审批流配置',
            icon: Workflow,
            onClick: onOpenWorkflowAdmin,
          },
        ]
      : []),
  ];

  return (
    <div className={cn(
      "fixed lg:relative inset-y-0 left-0 w-[240px] bg-canvas-white border-r border-border-silver flex flex-col h-full shrink-0 z-50 transition-transform duration-500 lg:translate-x-0",
      isOpen ? "translate-x-0 shadow-apple-xl" : "-translate-x-full"
    )}>
      <div className="h-16 lg:h-20 flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <img
            src="/mj-logo.png"
            alt="MJ 审批"
            className="h-7 w-7 object-contain"
          />
          <span className="text-[18px] font-bold text-midnight-graphite tracking-tight">MJ 审批</span>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden w-8 h-8 flex items-center justify-center text-medium-gray hover:text-midnight-graphite transition-colors"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 no-scrollbar space-y-10 pt-8 text-sf-pro-text">
        {/* Navigation Section */}
        <section>
          <div className="px-2 text-[11px] font-semibold text-light-gray uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>导航</span>
          </div>
          <div className="space-y-0.5">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-apple-btn text-[14px] font-medium transition-all group",
                  (!selectedModule && !selectedType && !activeAdminView)
                    ? "bg-interactive-blue text-white"
                    : "text-deep-gray hover:bg-lightest-gray-background"
                )}
              >
                <item.icon size={16} strokeWidth={2} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        {adminItems.length > 0 && (
          <section>
            <div className="px-2 text-[11px] font-semibold text-light-gray uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>系统管理</span>
            </div>
            <div className="space-y-0.5">
              {adminItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-apple-btn text-[14px] font-medium transition-all group",
                    activeAdminView === item.id
                      ? "bg-interactive-blue text-white"
                      : "text-deep-gray hover:bg-lightest-gray-background"
                  )}
                >
                  <item.icon size={16} strokeWidth={2} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Modules Section */}
        <section>
          <div className="px-2 text-[11px] font-semibold text-light-gray uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>业务模块</span>
          </div>
          <div className="space-y-0.5">
            {approvalSchema.modules.map((module) => (
              <div key={module.name} className="space-y-0.5">
                <button
                  onClick={() => toggleModule(module.name)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-apple-btn text-[14px] font-medium transition-all",
                    selectedModule === module.name
                      ? "text-interactive-blue bg-pure-white shadow-sm"
                      : "text-deep-gray hover:bg-lightest-gray-background"
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
                      className="overflow-hidden ml-4 pl-4 border-l border-border-silver space-y-0.5 mt-0.5"
                    >
                      {module.approvalTypes.map((type) => (
                        <button
                          key={type.name}
                          onClick={() => onSelectType(module.name, type.name)}
                          className={cn(
                            "w-full text-left px-3 py-1.5 rounded-apple-btn text-[13px] font-medium transition-all",
                            selectedType === type.name
                              ? "text-interactive-blue font-bold"
                              : "text-medium-gray hover:text-midnight-graphite hover:bg-lightest-gray-background"
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
