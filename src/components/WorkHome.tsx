import React from 'react';
import { ClipboardList, FileText, LayoutDashboard, Send } from 'lucide-react';
import ApplicantHome from './ApplicantHome';
import ApproverHome from './ApproverHome';
import BossDashboard from './BossDashboard';
import CcHome from './CcHome';
import { cn } from '../lib/utils';

export type WorkTab = 'requests' | 'approvals' | 'cc' | 'global';

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

  const tabs: Array<{ id: WorkTab; label: string; icon: React.ElementType }> = [
    { id: 'requests', label: '我的申请', icon: FileText },
    { id: 'approvals', label: '我的待审批', icon: ClipboardList },
    { id: 'cc', label: '我的抄送', icon: Send },
    ...(showGlobal ? [{ id: 'global' as const, label: '全部记录', icon: LayoutDashboard }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex p-1 bg-lightest-gray-background rounded-xl w-full lg:w-fit overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 lg:flex-none px-6 py-2.5 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap",
              activeTab === tab.id ? "bg-white text-black shadow-sm" : "text-light-gray hover:text-black"
            )}
          >
            <tab.icon size={15} strokeWidth={2.4} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'requests' && <ApplicantHome />}
      {activeTab === 'approvals' && <ApproverHome />}
      {activeTab === 'cc' && <CcHome />}
      {activeTab === 'global' && showGlobal && <BossDashboard />}
    </div>
  );
}
