import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Inbox,
  Loader2,
  Send,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { auth } from '../auth';
import { storage } from '../storage';
import { ApprovalNotification, ApprovalRecord, ApprovalStatus } from '../types';
import { cn } from '../lib/utils';
import { formatLocalDateTime } from '../lib/time';
import ApprovalDetailModal from './ApprovalDetailModal';

interface NotificationCenterProps {
  activeUsername?: string;
}

const notificationPollMs = 5000;

function getNotificationIcon(type: ApprovalNotification['type']) {
  switch (type) {
    case 'approval_pending':
      return ClipboardCheck;
    case 'approval_processing':
      return UserCheck;
    case 'approval_rejected':
      return XCircle;
    case 'approval_cc':
      return Send;
    default:
      return CheckCircle2;
  }
}

function getNotificationTone(type: ApprovalNotification['type']) {
  if (type === 'approval_rejected') {
    return 'bg-[#ffebee] text-[#c62828]';
  }
  if (type === 'approval_pending' || type === 'approval_processing') {
    return 'bg-[#fff7e0] text-[#7b5b18]';
  }
  if (type === 'approval_cc') {
    return 'bg-lightest-gray-background text-medium-gray';
  }
  return 'bg-[#e8f5e9] text-[#2e7d32]';
}

export default function NotificationCenter({ activeUsername }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<ApprovalNotification[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selectedRecord, setSelectedRecord] = React.useState<ApprovalRecord | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  const loadNotifications = React.useCallback(async () => {
    if (!activeUsername) {
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const nextNotifications = await storage.getNotifications();
      setNotifications(nextNotifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : '通知加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [activeUsername]);

  React.useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), notificationPollMs);
    const handleNotificationsUpdated = () => void loadNotifications();

    window.addEventListener('approval-notifications-updated', handleNotificationsUpdated);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('approval-notifications-updated', handleNotificationsUpdated);
    };
  }, [loadNotifications]);

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

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isUpdating) return;

    setIsUpdating(true);
    setNotifications((current) => current.map((notification) => (
      notification.readAt ? notification : { ...notification, readAt: new Date().toISOString() }
    )));

    try {
      await storage.markAllNotificationsRead();
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : '全部已读失败');
      await loadNotifications();
    } finally {
      setIsUpdating(false);
    }
  };

  const openNotificationRecord = async (notification: ApprovalNotification) => {
    setError('');
    setIsUpdating(true);
    setNotifications((current) => current.map((item) => (
      item.id === notification.id && !item.readAt
        ? { ...item, readAt: new Date().toISOString() }
        : item
    )));

    try {
      if (!notification.readAt) {
        await storage.markNotificationRead(notification.id);
      }

      const records = await storage.getRecords();
      const record = records.find((item) => item.id === notification.recordId) || null;
      if (!record) {
        setError('这条审批暂时无法打开');
        return;
      }

      setSelectedRecord(record);
      setIsOpen(false);
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : '通知处理失败');
      await loadNotifications();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = async (record: ApprovalRecord) => {
    const user = auth.getCurrentUser();
    if (!user || !window.confirm(`确认通过审批单 ${record.id}？`)) return;

    try {
      const updatedRecord = await storage.updateStatus(record.id, ApprovalStatus.APPROVED, user.name);
      setSelectedRecord(updatedRecord);
      await loadNotifications();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '审批失败');
    }
  };

  const handleReject = async (record: ApprovalRecord) => {
    const user = auth.getCurrentUser();
    if (!user) return;

    const reason = window.prompt(`请输入审批单 ${record.id} 的驳回原因`);
    if (!reason?.trim()) return;

    try {
      const updatedRecord = await storage.updateStatus(record.id, ApprovalStatus.REJECTED, user.name, reason.trim());
      setSelectedRecord(updatedRecord);
      await loadNotifications();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '驳回失败');
    }
  };

  const handleCompleteProcess = async (record: ApprovalRecord) => {
    const comment = window.prompt(`填写 ${record.processorTaskName || '办理任务'} 的办理备注，可留空`, '');
    if (comment === null) return;

    try {
      const updatedRecord = await storage.completeProcessing(record.id, comment.trim());
      setSelectedRecord(updatedRecord);
      await loadNotifications();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '办理失败');
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-medium-gray transition-all hover:bg-lightest-gray-background hover:text-midnight-graphite lg:h-11 lg:w-11"
        aria-label="通知"
        title="通知"
      >
        <Bell size={18} strokeWidth={2.4} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#c62828] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
            {badgeText}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-[calc(100%+10px)] z-50 w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-border-silver bg-white shadow-apple-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border-silver px-4 py-3">
              <div className="min-w-0">
                <p className="text-[15px] font-black text-midnight-graphite">通知</p>
                <p className="text-[11px] font-bold text-medium-gray">{unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={unreadCount === 0 || isUpdating}
                className="flex h-9 w-9 items-center justify-center rounded-full text-medium-gray transition-colors hover:bg-lightest-gray-background hover:text-midnight-graphite disabled:opacity-35"
                title="全部已读"
              >
                {isUpdating ? <Loader2 size={15} strokeWidth={2.5} className="animate-spin" /> : <CheckCheck size={16} strokeWidth={2.5} />}
              </button>
            </div>

            {error && (
              <div className="border-b border-[#ffd6d6] bg-[#fff1f0] px-4 py-3 text-[12px] font-bold text-[#c62828]">
                {error}
              </div>
            )}

            <div className="max-h-[420px] overflow-y-auto p-2">
              {isLoading && notifications.length === 0 && (
                <div className="flex h-[160px] items-center justify-center gap-2 text-[13px] font-bold text-medium-gray">
                  <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
                  加载通知
                </div>
              )}

              {!isLoading && notifications.length === 0 && (
                <div className="flex h-[180px] flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-lightest-gray-background text-medium-gray">
                    <Inbox size={19} strokeWidth={2.4} />
                  </div>
                  <p className="text-[13px] font-bold text-medium-gray">暂无通知</p>
                </div>
              )}

              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const isUnread = !notification.readAt;

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void openNotificationRecord(notification)}
                    className={cn(
                      'group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all',
                      isUnread ? 'bg-[#fbfbfd] hover:bg-lightest-gray-background' : 'hover:bg-lightest-gray-background',
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', getNotificationTone(notification.type))}>
                      <Icon size={16} strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-black text-midnight-graphite">{notification.title}</span>
                        {isUnread && <Circle size={7} className="shrink-0 fill-interactive-blue text-interactive-blue" />}
                      </span>
                      <span className="mt-1 block text-[12px] font-semibold leading-5 text-deep-gray">
                        {notification.message}
                      </span>
                      <span className="mt-2 block text-[10px] font-black uppercase tracking-wider text-light-gray">
                        {formatLocalDateTime(notification.createdAt, 'date-time')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ApprovalDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        showAiSuggestion
        onApprove={selectedRecord?.currentUserCanApprove ? (record) => void handleApprove(record) : undefined}
        onReject={selectedRecord?.currentUserCanApprove ? (record) => void handleReject(record) : undefined}
        onCompleteProcess={selectedRecord?.currentUserCanProcess ? (record) => void handleCompleteProcess(record) : undefined}
      />
    </div>
  );
}
