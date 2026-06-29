import React from 'react';
import { ClipboardList, FileText, LayoutDashboard, Send, UserCheck } from 'lucide-react';
import ApplicantHome from './ApplicantHome';
import ApproverHome from './ApproverHome';
import BossDashboard from './BossDashboard';
import CcHome from './CcHome';
import ProcessorHome from './ProcessorHome';
import { cn } from '../lib/utils';

export type WorkTab = 'requests' | 'approvals' | 'processing' | 'cc' | 'global';

interface WorkHomeProps {
  showGlobal?: boolean;
  activeTab?: WorkTab;
  onTabChange?: (tab: WorkTab) => void;
}

export default function WorkHome({ showGlobal = false, activeTab: controlledTab, onTabChange }: WorkHomeProps) {
  const [internalTab, setInternalTab] = React.useState<WorkTab>(showGlobal ? 'global' : 'requests');
  const activeTab = controlledTab ?? internalTab;

  const setActiveTab = (tab: WorkTab) => {
    if (controlledTab === undefined) {
      setInternalTab(tab);
    }
    onTabChange?.(tab);
  };

  React.useEffect(() => {
    if (!showGlobal && activeTab === 'global') {
      setActiveTab('requests');
    }
  }, [activeTab, showGlobal]);

  const tabs: Array<{ id: WorkTab; label: string; mobileLabel: string; icon: React.ElementType }> = [
    { id: 'requests', label: '我的申请', mobileLabel: '申请', icon: FileText },
    { id: 'approvals', label: '我的待审批', mobileLabel: '审批', icon: ClipboardList },
    { id: 'processing', label: '我的待办理', mobileLabel: '办理', icon: UserCheck },
    { id: 'cc', label: '我的抄送', mobileLabel: '抄送', icon: Send },
    ...(showGlobal ? [{ id: 'global' as const, label: '全部记录', mobileLabel: '全部', icon: LayoutDashboard }] : []),
  ];

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="-mx-1 flex gap-1 overflow-x-auto no-scrollbar rounded-[16px] bg-[#ececf0] p-1 lg:mx-0 lg:w-fit lg:gap-0 lg:rounded-xl lg:bg-lightest-gray-background">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "h-8 shrink-0 rounded-[12px] px-3 text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap lg:h-auto lg:flex-1 lg:border-0 lg:rounded-lg lg:px-6 lg:py-2.5 lg:text-[13px] lg:font-bold lg:gap-2",
              activeTab === tab.id
                ? "bg-white text-midnight-graphite shadow-sm lg:bg-white lg:text-black lg:shadow-sm"
                : "text-medium-gray hover:text-black lg:bg-transparent lg:text-light-gray"
            )}
          >
            <tab.icon size={13} strokeWidth={2.2} className="lg:h-[15px] lg:w-[15px]" />
            <span className="lg:hidden">{tab.mobileLabel}</span>
            <span className="hidden lg:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'requests' && <ApplicantHome />}
      {activeTab === 'approvals' && <ApproverHome />}
      {activeTab === 'processing' && <ProcessorHome />}
      {activeTab === 'cc' && <CcHome />}
      {activeTab === 'global' && showGlobal && <BossDashboard />}
    </div>
  );
}
