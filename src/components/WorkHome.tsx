import React from 'react';
import { ClipboardList, FileText, LayoutDashboard, Send, UserCheck } from 'lucide-react';
import ApplicantHome from './ApplicantHome';
import ApproverHome from './ApproverHome';
import BossDashboard from './BossDashboard';
import CcHome from './CcHome';
import ProcessorHome from './ProcessorHome';
import { cn } from '../lib/utils';
import { storage } from '../storage';
import { ApprovalNotification } from '../types';

export type WorkTab = 'requests' | 'approvals' | 'processing' | 'cc' | 'global';
type BadgeableWorkTab = Exclude<WorkTab, 'global'>;

interface WorkHomeProps {
  showGlobal?: boolean;
  activeTab?: WorkTab;
  activeUsername?: string;
  onTabChange?: (tab: WorkTab) => void;
}

const notificationBadgePollMs = 5000;

function createEmptyNotificationCounts(): Record<BadgeableWorkTab, number> {
  return {
    requests: 0,
    approvals: 0,
    processing: 0,
    cc: 0,
  };
}

function getNotificationBadgeTab(type: ApprovalNotification['type']): BadgeableWorkTab {
  switch (type) {
    case 'approval_pending':
      return 'approvals';
    case 'approval_processing':
      return 'processing';
    case 'approval_cc':
      return 'cc';
    default:
      return 'requests';
  }
}

function getUnreadNotificationCounts(notifications: ApprovalNotification[]) {
  return notifications.reduce((counts, notification) => {
    if (!notification.readAt) {
      counts[getNotificationBadgeTab(notification.type)] += 1;
    }

    return counts;
  }, createEmptyNotificationCounts());
}

function formatBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

export default function WorkHome({ showGlobal = false, activeTab: controlledTab, activeUsername, onTabChange }: WorkHomeProps) {
  const [internalTab, setInternalTab] = React.useState<WorkTab>(showGlobal ? 'global' : 'requests');
  const [notificationCounts, setNotificationCounts] = React.useState<Record<BadgeableWorkTab, number>>(
    createEmptyNotificationCounts,
  );
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

  React.useEffect(() => {
    let isMounted = true;

    const loadNotificationCounts = async () => {
      if (!activeUsername) {
        if (isMounted) setNotificationCounts(createEmptyNotificationCounts());
        return;
      }

      try {
        const notifications = await storage.getNotifications();
        if (isMounted) setNotificationCounts(getUnreadNotificationCounts(notifications));
      } catch {
        if (isMounted) setNotificationCounts(createEmptyNotificationCounts());
      }
    };

    void loadNotificationCounts();
    const timer = window.setInterval(() => void loadNotificationCounts(), notificationBadgePollMs);
    const handleNotificationsUpdated = () => void loadNotificationCounts();

    window.addEventListener('approval-notifications-updated', handleNotificationsUpdated);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
      window.removeEventListener('approval-notifications-updated', handleNotificationsUpdated);
    };
  }, [activeUsername]);

  const tabs: Array<{ id: WorkTab; label: string; mobileLabel: string; icon: React.ElementType }> = [
    { id: 'requests', label: '我的申请', mobileLabel: '申请', icon: FileText },
    { id: 'approvals', label: '我的待审批', mobileLabel: '审批', icon: ClipboardList },
    { id: 'processing', label: '我的待办理', mobileLabel: '办理', icon: UserCheck },
    { id: 'cc', label: '我的抄送', mobileLabel: '抄送', icon: Send },
    ...(showGlobal ? [{ id: 'global' as const, label: '全部记录', mobileLabel: '全部', icon: LayoutDashboard }] : []),
  ];

  return (
    <div className="space-y-2.5 lg:space-y-6">
      <div className="-mx-1 flex gap-1 overflow-x-auto no-scrollbar rounded-[15px] bg-[#ececf0] p-1 lg:mx-0 lg:w-fit lg:gap-0 lg:rounded-xl lg:bg-lightest-gray-background">
        {tabs.map((tab) => {
          const notificationCount = tab.id === 'global' ? 0 : notificationCounts[tab.id as BadgeableWorkTab];

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-label={`${tab.label}${notificationCount > 0 ? `，${notificationCount} 条新通知` : ''}`}
              className={cn(
                "h-7 shrink-0 rounded-[11px] px-2.5 text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap lg:h-auto lg:flex-1 lg:border-0 lg:rounded-lg lg:px-6 lg:py-2.5 lg:text-[13px] lg:font-bold lg:gap-2",
                activeTab === tab.id
                  ? "bg-white text-midnight-graphite shadow-sm lg:bg-white lg:text-black lg:shadow-sm"
                  : "text-medium-gray hover:text-black lg:bg-transparent lg:text-light-gray"
              )}
            >
              <tab.icon size={13} strokeWidth={2.2} className="lg:h-[15px] lg:w-[15px]" />
              <span className="lg:hidden">{tab.mobileLabel}</span>
              <span className="hidden lg:inline">{tab.label}</span>
              {notificationCount > 0 && (
                <span className="flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#c62828] px-1 text-[9px] font-black leading-none text-white ring-1 ring-white lg:h-[17px] lg:min-w-[17px] lg:text-[10px]">
                  {formatBadgeCount(notificationCount)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'requests' && <ApplicantHome />}
      {activeTab === 'approvals' && <ApproverHome />}
      {activeTab === 'processing' && <ProcessorHome />}
      {activeTab === 'cc' && <CcHome />}
      {activeTab === 'global' && showGlobal && <BossDashboard />}
    </div>
  );
}
