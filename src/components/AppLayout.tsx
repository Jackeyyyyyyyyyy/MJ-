import React from 'react';
import { auth } from '../auth';
import Sidebar from './Sidebar';
import { LogOut, User as UserIcon } from 'lucide-react';
import { Role } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  onPerspectiveChange: (role: Role) => void;
  selectedModule?: string;
  selectedType?: string;
  onSelectType: (module: string, type: string) => void;
}

export default function AppLayout({ 
  children, 
  onLogout, 
  onPerspectiveChange,
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

  const getPerspectiveLabel = (p: Role) => {
    switch(p) {
      case 'applicant': return '申请人';
      case 'approver': return '审核员';
      case 'boss': return '老板';
      default: return '开发者';
    }
  };

  const displayRole = getPerspectiveLabel(perspective || user?.role || 'applicant');

  return (
    <div className="flex h-screen bg-canvas-white overflow-hidden relative">
      <Sidebar 
        currentPerspective={perspective || 'applicant'} 
        selectedModule={selectedModule}
        selectedType={selectedType}
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
        <header className="h-16 lg:h-20 glass flex items-center justify-between px-6 lg:px-12 grow-0 shrink-0 z-30">
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
            {user?.role === 'developer' && (
              <div className="hidden sm:flex items-center p-1 bg-lightest-gray-background rounded-apple-btn">
                {(['applicant', 'approver', 'boss'] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => handlePerspectiveChange(r)}
                    className={cn(
                      "px-4 lg:px-6 py-1.5 text-[12px] font-semibold rounded-apple-btn transition-all",
                      perspective === r
                        ? "bg-pure-white text-midnight-graphite shadow-sm"
                        : "text-medium-gray hover:text-midnight-graphite"
                    )}
                  >
                    {getPerspectiveLabel(r)}
                  </button>
                ))}
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
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar pt-12 lg:pt-16 px-6 lg:px-20 pb-40">
          <div className="max-w-[1400px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={perspective}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
            <footer className="pt-12 text-center">
              <p className="text-[11px] font-bold text-light-gray">
                Copyright (C) 2026 MJ 审批. All Rights Reserved
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
