import React from 'react';
import { auth } from '../auth';
import Sidebar from './Sidebar';
import { LogOut } from 'lucide-react';
import { AdminView, Role } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  onPerspectiveChange: (role: Role) => void;
  activeAdminView?: AdminView | null;
  onOpenAccountAdmin: () => void;
  onOpenAiAssistant: () => void;
  onOpenOrganizationAdmin: () => void;
  onOpenWorkflowAdmin: () => void;
  selectedModule?: string;
  selectedType?: string;
  onSelectType: (module: string, type: string) => void;
}

const PERSPECTIVE_ROLES: Role[] = ['applicant', 'approver', 'boss', 'developer'];

function getPerspectiveLabel(role: Role) {
  switch(role) {
    case 'applicant': return '申请';
    case 'approver': return '审批';
    case 'boss': return '老板';
    default: return '超管';
  }
}

interface PerspectiveSwitcherProps {
  perspective: Role | null;
  onChange: (role: Role) => void;
}

function PerspectiveSwitcher({ perspective, onChange }: PerspectiveSwitcherProps) {
  return (
    <div
      className="grid grid-cols-4 items-center gap-1 p-1 bg-lightest-gray-background rounded-apple-btn"
      aria-label="超管视角切换"
    >
      {PERSPECTIVE_ROLES.map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => onChange(role)}
          aria-pressed={perspective === role}
          className={cn(
            "h-10 px-3 lg:px-5 text-[13px] lg:text-[12px] font-bold rounded-apple-btn transition-all whitespace-nowrap",
            perspective === role
              ? "bg-pure-white text-midnight-graphite shadow-sm"
              : "text-medium-gray hover:text-midnight-graphite"
          )}
        >
          {getPerspectiveLabel(role)}
        </button>
      ))}
    </div>
  );
}

export default function AppLayout({ 
  children, 
  onLogout, 
  onPerspectiveChange,
  activeAdminView,
  onOpenAccountAdmin,
  onOpenAiAssistant,
  onOpenOrganizationAdmin,
  onOpenWorkflowAdmin,
  selectedModule,
  selectedType,
  onSelectType
}: AppLayoutProps) {
  const user = auth.getCurrentUser();
  const perspective = auth.getPerspective();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const handlePerspectiveChange = (role: Role) => {
    auth.setPerspective(role);
    onPerspectiveChange(role);
  };

  const displayRole = getPerspectiveLabel(perspective || user?.role || 'applicant');
  const isDeveloper = user?.role === 'developer';

  return (
    <div className="flex h-screen bg-canvas-white overflow-hidden relative">
      <Sidebar 
        currentPerspective={perspective || 'applicant'} 
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
        onSelectType={(m, t) => {
          onSelectType(m, t);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Mobile Overlay */}
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
            <div className="flex items-center gap-4 lg:gap-6">
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
                  <PerspectiveSwitcher
                    perspective={perspective}
                    onChange={handlePerspectiveChange}
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
              <PerspectiveSwitcher
                perspective={perspective}
                onChange={handlePerspectiveChange}
              />
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar pt-12 lg:pt-16 px-6 lg:px-20 pb-40">
          <div className="max-w-[1400px] mx-auto min-h-full flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={perspective}
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
