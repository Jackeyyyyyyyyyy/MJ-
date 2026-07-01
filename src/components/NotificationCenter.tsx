import React from 'react';
import { createPortal } from 'react-dom';
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
  X,
  XCircle,
} from 'lucide-react';
import { auth } from '../auth';
import { storage } from '../storage';
import { ApprovalNotification, ApprovalRecord, ApprovalStatus } from '../types';
import { cn } from '../lib/utils';
import { formatLocalDateTime } from '../lib/time';
import { setApprovalAppBadge, showForegroundApprovalNotification } from '../lib/pushNotifications';
import ApprovalDetailModal from './ApprovalDetailModal';

interface NotificationCenterProps {
  activeUsername?: string;
  onOpenRecord?: (notification: ApprovalNotification, record: ApprovalRecord) => void;
}

const notificationPollMs = 5000;

function shouldShowAttentionBadge(notification: ApprovalNotification) {
  return notification.type === 'approval_pending'
    || notification.type === 'approval_processing'
    || notification.type === 'approval_cc';
}

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

export default function NotificationCenter({ activeUsername, onOpenRecord }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<ApprovalNotification[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selectedRecord, setSelectedRecord] = React.useState<ApprovalRecord | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const mobilePanelRef = React.useRef<HTMLDivElement | null>(null);
  const hasLoadedNotificationsRef = React.useRef(false);
  const foregroundNotifiedIdsRef = React.useRef<Set<string>>(new Set());

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const attentionUnreadCount = notifications.filter((notification) => (
    !notification.readAt && shouldShowAttentionBadge(notification)
  )).length;
  const badgeText = attentionUnreadCount > 99 ? '99+' : String(attentionUnreadCount);

  const loadNotifications = React.useCallback(async () => {
    if (!activeUsername) {
      setNotifications([]);
      void setApprovalAppBadge(0);
      hasLoadedNotificationsRef.current = false;
      foregroundNotifiedIdsRef.current.clear();
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const nextNotifications = await storage.getNotifications();
      const unreadNotifications = nextNotifications.filter((notification) => !notification.readAt);
      const attentionUnreadNotifications = unreadNotifications.filter(shouldShowAttentionBadge);

      if (!hasLoadedNotificationsRef.current) {
        unreadNotifications.forEach((notification) => {
          foregroundNotifiedIdsRef.current.add(notification.id);
        });
        hasLoadedNotificationsRef.current = true;
      } else {
        unreadNotifications.forEach((notification) => {
          if (foregroundNotifiedIdsRef.current.has(notification.id)) return;
          if (showForegroundApprovalNotification(notification)) {
            foregroundNotifiedIdsRef.current.add(notification.id);
          }
        });
      }

      setNotifications(nextNotifications);
      void setApprovalAppBadge(attentionUnreadNotifications.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : '通知加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [activeUsername]);

  React.useEffect(() => {
    hasLoadedNotificationsRef.current = false;
    foregroundNotifiedIdsRef.current.clear();
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
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !mobilePanelRef.current?.contains(target)) {
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
    void setApprovalAppBadge(0);

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

      if (onOpenRecord) {
        onOpenRecord(notification, record);
      } else {
        setSelectedRecord(record);
      }
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
    <div ref={rootRef} className={cn('relative', isOpen && 'z-[80]')}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-medium-gray transition-all hover:bg-lightest-gray-background hover:text-midnight-graphite lg:h-11 lg:w-11"
        aria-label="通知"
        title="通知"
      >
        <Bell size={18} strokeWidth={2.4} />
        {attentionUnreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d73737] px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white">
            {badgeText}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <React.Fragment key="notification-panel">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="hidden sm:absolute sm:right-0 sm:top-[calc(100%+10px)] sm:z-50 sm:flex sm:w-[380px] sm:max-w-[calc(100vw-24px)] sm:flex-col sm:overflow-hidden sm:rounded-[18px] sm:border sm:border-black/[0.06] sm:bg-white sm:pb-0 sm:shadow-[0_16px_42px_rgba(20,24,34,0.16)]"
            >
              <div className="flex justify-center py-2 sm:hidden">
                <span className="h-1 w-10 rounded-full bg-border-silver" />
              </div>

            <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 pb-4 pt-2 sm:px-4 sm:py-3">
              <div className="min-w-0">
                <p className="text-[17px] font-semibold text-midnight-graphite sm:text-[15px]">通知</p>
                <p className="mt-0.5 text-[12px] font-medium text-light-gray sm:mt-0 sm:text-[11px]">{unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  disabled={unreadCount === 0 || isUpdating}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#f0f1f4] px-3 text-[12px] font-semibold text-medium-gray transition-colors hover:bg-canvas-white hover:text-midnight-graphite disabled:opacity-35 sm:h-9 sm:w-9 sm:bg-transparent sm:px-0"
                  title="全部已读"
                >
                  {isUpdating ? <Loader2 size={15} strokeWidth={2.5} className="animate-spin" /> : <CheckCheck size={16} strokeWidth={2.5} />}
                  <span className="sm:hidden">全部已读</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f1f4] text-medium-gray transition-colors hover:bg-canvas-white hover:text-midnight-graphite sm:hidden"
                  aria-label="关闭通知"
                  title="关闭"
                >
                  <X size={16} strokeWidth={2.6} />
                </button>
              </div>
            </div>

            {error && (
              <div className="border-b border-[#ffd6d6] bg-[#fff1f0] px-4 py-3 text-[12px] font-semibold text-[#c62828]">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto bg-[#f5f6f8] p-3 pb-5 sm:max-h-[420px] sm:flex-none sm:bg-white sm:p-2">
              {isLoading && notifications.length === 0 && (
                <div className="flex min-h-[220px] items-center justify-center gap-2 text-[13px] font-semibold text-medium-gray sm:h-[160px] sm:min-h-0">
                  <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
                  加载通知
                </div>
              )}

              {!isLoading && notifications.length === 0 && (
                <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center sm:h-[180px] sm:min-h-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-light-gray sm:bg-lightest-gray-background">
                    <Inbox size={19} strokeWidth={2.4} />
                  </div>
                  <p className="text-[13px] font-semibold text-medium-gray">暂无通知</p>
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
                      'group flex w-full items-start gap-3 rounded-[18px] border border-transparent px-3.5 py-3.5 text-left transition-all sm:rounded-xl sm:px-3 sm:py-3',
                      isUnread ? 'border-black/[0.025] bg-white shadow-[0_1px_2px_rgba(20,24,34,0.025)] hover:bg-white' : 'hover:bg-white sm:hover:bg-lightest-gray-background',
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9', getNotificationTone(notification.type))}>
                      <Icon size={17} strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 text-[14px] font-semibold text-midnight-graphite sm:truncate sm:text-[13px]">{notification.title}</span>
                        {isUnread && <Circle size={7} className="shrink-0 fill-interactive-blue text-interactive-blue" />}
                      </span>
                      <span className="mt-1.5 block text-[13px] font-medium leading-5 text-medium-gray sm:mt-1 sm:text-[12px]">
                        {notification.message}
                      </span>
                      <span className="mt-2.5 block text-[10.5px] font-medium text-light-gray sm:mt-2">
                        {formatLocalDateTime(notification.createdAt, 'date-time')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            </motion.div>
            {typeof document !== 'undefined' && createPortal(
              <React.Fragment key="mobile-notification-panel">
                <motion.button
                  type="button"
                  aria-label="关闭通知"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => setIsOpen(false)}
                  className="fixed inset-0 z-[90] bg-black/16 backdrop-blur-[2px] sm:hidden"
                />

                <motion.div
                  ref={mobilePanelRef}
                  initial={{ opacity: 0, y: 32, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 28, scale: 0.985 }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-h-[68dvh] w-[calc(100%-24px)] flex-col overflow-hidden rounded-[24px] border border-white/80 bg-[#f6f7fa] pb-[env(safe-area-inset-bottom)] shadow-[0_-3px_18px_rgba(17,24,39,0.07)] ring-1 ring-black/[0.025] sm:hidden"
                >
                  <div className="flex justify-center pb-1 pt-2">
                    <span className="h-1 w-8 rounded-full bg-[#d7d9df]" />
                  </div>

                  <div className="flex items-center justify-between gap-3 border-b border-black/[0.04] bg-white/95 px-4 pb-3 pt-1">
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold leading-5 text-midnight-graphite">通知</p>
                      <p className="mt-0.5 text-[11px] font-medium text-light-gray">{unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleMarkAllRead()}
                          disabled={isUpdating}
                          className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#f1f2f5] px-3 text-[12px] font-medium text-medium-gray transition-colors hover:bg-[#e9ebf0] hover:text-midnight-graphite disabled:opacity-35"
                          title="全部已读"
                        >
                          {isUpdating ? <Loader2 size={15} strokeWidth={2.5} className="animate-spin" /> : <CheckCheck size={16} strokeWidth={2.5} />}
                          <span>全部已读</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1f2f5] text-medium-gray transition-colors hover:bg-[#e9ebf0] hover:text-midnight-graphite"
                        aria-label="关闭通知"
                        title="关闭"
                      >
                        <X size={16} strokeWidth={2.6} />
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="border-b border-[#ffd6d6] bg-[#fff1f0] px-4 py-3 text-[12px] font-semibold text-[#c62828]">
                      {error}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto px-2.5 py-2.5">
                    {isLoading && notifications.length === 0 && (
                      <div className="flex min-h-[168px] items-center justify-center rounded-[20px] bg-white gap-2 text-[13px] font-medium text-medium-gray shadow-[0_1px_1px_rgba(20,24,34,0.014)]">
                        <Loader2 size={15} strokeWidth={2.5} className="animate-spin" />
                        加载中
                      </div>
                    )}

                    {!isLoading && notifications.length === 0 && (
                      <div className="flex min-h-[168px] flex-col items-center justify-center gap-3 rounded-[20px] bg-white text-center shadow-[0_1px_1px_rgba(20,24,34,0.014)]">
                        <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#f1f2f5] text-light-gray">
                          <Inbox size={20} strokeWidth={2.35} />
                        </div>
                        <p className="text-[13px] font-semibold text-medium-gray">暂无通知</p>
                      </div>
                    )}

                    {notifications.length > 0 && (
                      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_1px_1px_rgba(20,24,34,0.014)]">
                        {notifications.map((notification, index) => {
                          const Icon = getNotificationIcon(notification.type);
                          const isUnread = !notification.readAt;

                          return (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => void openNotificationRecord(notification)}
                              className={cn(
                                'group flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[#f8f9fb]',
                                index < notifications.length - 1 && 'border-b border-black/[0.04]',
                              )}
                            >
                              <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px]', getNotificationTone(notification.type))}>
                                <Icon size={15} strokeWidth={2.45} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className={cn(
                                    'min-w-0 flex-1 truncate text-[13.5px] leading-5 text-midnight-graphite',
                                    isUnread ? 'font-semibold' : 'font-medium',
                                  )}>{notification.title}</span>
                                  {isUnread && <Circle size={7} className="shrink-0 fill-interactive-blue text-interactive-blue" />}
                                </span>
                                <span className="mt-1 block line-clamp-2 text-[12.5px] font-medium leading-[18px] text-medium-gray">
                                  {notification.message}
                                </span>
                                <span className="mt-2 block text-[10.5px] font-medium text-light-gray">
                                  {formatLocalDateTime(notification.createdAt, 'date-time')}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </React.Fragment>,
              document.body,
            )}
          </React.Fragment>
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
