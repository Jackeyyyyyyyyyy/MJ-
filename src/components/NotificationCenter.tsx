import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  BellRing,
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
import {
  ApprovalPushState,
  disableApprovalPushNotifications,
  enableApprovalPushNotifications,
  readApprovalPushState,
  setApprovalAppBadge,
} from '../lib/pushNotifications';
import ApprovalDetailModal from './ApprovalDetailModal';

interface NotificationCenterProps {
  activeUsername?: string;
  onOpenRecord?: (notification: ApprovalNotification, record: ApprovalRecord) => void;
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

export default function NotificationCenter({ activeUsername, onOpenRecord }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<ApprovalNotification[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selectedRecord, setSelectedRecord] = React.useState<ApprovalRecord | null>(null);
  const [pushState, setPushState] = React.useState<ApprovalPushState | null>(null);
  const [isPushUpdating, setIsPushUpdating] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const mobilePanelRef = React.useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  const loadNotifications = React.useCallback(async () => {
    if (!activeUsername) {
      setNotifications([]);
      void setApprovalAppBadge(0);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const nextNotifications = await storage.getNotifications();
      setNotifications(nextNotifications);
      void setApprovalAppBadge(nextNotifications.filter((notification) => !notification.readAt).length);
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
    let isCancelled = false;

    if (!activeUsername) {
      setPushState(null);
      return () => {
        isCancelled = true;
      };
    }

    void readApprovalPushState().then((nextState) => {
      if (!isCancelled) setPushState(nextState);
    });

    return () => {
      isCancelled = true;
    };
  }, [activeUsername]);

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

  const handleEnablePush = async () => {
    if (isPushUpdating) return;

    setIsPushUpdating(true);
    const nextState = await enableApprovalPushNotifications();
    setPushState(nextState);
    void setApprovalAppBadge(unreadCount);
    setIsPushUpdating(false);
  };

  const handleDisablePush = async () => {
    if (isPushUpdating) return;

    setIsPushUpdating(true);
    const nextState = await disableApprovalPushNotifications();
    setPushState(nextState);
    void setApprovalAppBadge(0);
    setIsPushUpdating(false);
  };

  const renderPushCard = () => {
    if (!pushState) return null;

    const isEnabled = pushState.status === 'enabled';
    const canDisable = isEnabled && !isPushUpdating;

    return (
      <div className="border-b border-border-silver px-3 py-3">
        <div className={cn(
          'flex items-start gap-3 rounded-2xl border px-3 py-3',
          isEnabled ? 'border-[#c8ead1] bg-[#f1fbf3]' : 'border-border-silver bg-lightest-gray-background',
        )}>
          <span className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            isEnabled ? 'bg-[#dff4e5] text-[#2e7d32]' : 'bg-white text-medium-gray',
          )}>
            {isEnabled ? <BellRing size={16} strokeWidth={2.5} /> : <Bell size={16} strokeWidth={2.5} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black text-midnight-graphite">
              {isEnabled ? '手机通知已开启' : '手机系统通知'}
            </span>
            <span className="mt-1 block text-[12px] font-semibold leading-5 text-deep-gray">
              {pushState.message}
            </span>
            <span className="mt-3 flex flex-wrap gap-2">
              {pushState.canEnable && (
                <button
                  type="button"
                  onClick={() => void handleEnablePush()}
                  disabled={isPushUpdating}
                  className="flex h-8 items-center justify-center rounded-full bg-midnight-graphite px-3 text-[11px] font-black text-white transition-colors hover:bg-deep-gray disabled:opacity-50"
                >
                  {isPushUpdating ? '开启中' : '开启'}
                </button>
              )}
              {canDisable && (
                <button
                  type="button"
                  onClick={() => void handleDisablePush()}
                  className="flex h-8 items-center justify-center rounded-full bg-white px-3 text-[11px] font-black text-medium-gray transition-colors hover:text-midnight-graphite"
                >
                  关闭
                </button>
              )}
            </span>
          </span>
        </div>
      </div>
    );
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
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#c62828] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
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
              className="hidden sm:absolute sm:right-0 sm:top-[calc(100%+10px)] sm:z-50 sm:flex sm:w-[380px] sm:max-w-[calc(100vw-24px)] sm:flex-col sm:overflow-hidden sm:rounded-2xl sm:border sm:border-border-silver sm:bg-white sm:pb-0 sm:shadow-apple-xl"
            >
              <div className="flex justify-center py-2 sm:hidden">
                <span className="h-1 w-10 rounded-full bg-border-silver" />
              </div>

            <div className="flex items-center justify-between gap-3 border-b border-border-silver px-5 pb-4 pt-2 sm:px-4 sm:py-3">
              <div className="min-w-0">
                <p className="text-[18px] font-black text-midnight-graphite sm:text-[15px]">通知</p>
                <p className="mt-0.5 text-[12px] font-bold text-medium-gray sm:mt-0 sm:text-[11px]">{unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  disabled={unreadCount === 0 || isUpdating}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-lightest-gray-background px-3 text-[12px] font-black text-medium-gray transition-colors hover:bg-canvas-white hover:text-midnight-graphite disabled:opacity-35 sm:w-9 sm:bg-transparent sm:px-0"
                  title="全部已读"
                >
                  {isUpdating ? <Loader2 size={15} strokeWidth={2.5} className="animate-spin" /> : <CheckCheck size={16} strokeWidth={2.5} />}
                  <span className="sm:hidden">全部已读</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-lightest-gray-background text-medium-gray transition-colors hover:bg-canvas-white hover:text-midnight-graphite sm:hidden"
                  aria-label="关闭通知"
                  title="关闭"
                >
                  <X size={16} strokeWidth={2.6} />
                </button>
              </div>
            </div>

            {renderPushCard()}

            {error && (
              <div className="border-b border-[#ffd6d6] bg-[#fff1f0] px-4 py-3 text-[12px] font-bold text-[#c62828]">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 pb-5 sm:max-h-[420px] sm:flex-none sm:p-2">
              {isLoading && notifications.length === 0 && (
                <div className="flex min-h-[220px] items-center justify-center gap-2 text-[13px] font-bold text-medium-gray sm:min-h-0 sm:h-[160px]">
                  <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
                  加载通知
                </div>
              )}

              {!isLoading && notifications.length === 0 && (
                <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center sm:h-[180px] sm:min-h-0">
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
                      'group flex w-full items-start gap-3 rounded-2xl px-4 py-4 text-left transition-all sm:rounded-xl sm:px-3 sm:py-3',
                      isUnread ? 'bg-[#fbfbfd] hover:bg-lightest-gray-background' : 'hover:bg-lightest-gray-background',
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9', getNotificationTone(notification.type))}>
                      <Icon size={17} strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 text-[14px] font-black text-midnight-graphite sm:truncate sm:text-[13px]">{notification.title}</span>
                        {isUnread && <Circle size={7} className="shrink-0 fill-interactive-blue text-interactive-blue" />}
                      </span>
                      <span className="mt-1.5 block text-[13px] font-semibold leading-5 text-deep-gray sm:mt-1 sm:text-[12px]">
                        {notification.message}
                      </span>
                      <span className="mt-3 block text-[10px] font-black uppercase tracking-wider text-light-gray sm:mt-2">
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
                  className="fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px] sm:hidden"
                />

                <motion.div
                  ref={mobilePanelRef}
                  initial={{ opacity: 0, y: 28, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 24, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  className="fixed inset-x-0 bottom-0 z-[100] mx-auto flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-border-silver bg-white pb-[env(safe-area-inset-bottom)] shadow-apple-xl sm:hidden"
                >
                  <div className="flex justify-center py-2">
                    <span className="h-1 w-10 rounded-full bg-border-silver" />
                  </div>

                  <div className="flex items-center justify-between gap-3 border-b border-border-silver px-5 pb-4 pt-2">
                    <div className="min-w-0">
                      <p className="text-[18px] font-black text-midnight-graphite">通知</p>
                      <p className="mt-0.5 text-[12px] font-bold text-medium-gray">{unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleMarkAllRead()}
                        disabled={unreadCount === 0 || isUpdating}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-lightest-gray-background px-3 text-[12px] font-black text-medium-gray transition-colors hover:bg-canvas-white hover:text-midnight-graphite disabled:opacity-35"
                        title="全部已读"
                      >
                        {isUpdating ? <Loader2 size={15} strokeWidth={2.5} className="animate-spin" /> : <CheckCheck size={16} strokeWidth={2.5} />}
                        <span>全部已读</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-lightest-gray-background text-medium-gray transition-colors hover:bg-canvas-white hover:text-midnight-graphite"
                        aria-label="关闭通知"
                        title="关闭"
                      >
                        <X size={16} strokeWidth={2.6} />
                      </button>
                    </div>
                  </div>

                  {renderPushCard()}

                  {error && (
                    <div className="border-b border-[#ffd6d6] bg-[#fff1f0] px-4 py-3 text-[12px] font-bold text-[#c62828]">
                      {error}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-3 pb-5">
                    {isLoading && notifications.length === 0 && (
                      <div className="flex min-h-[220px] items-center justify-center gap-2 text-[13px] font-bold text-medium-gray">
                        <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
                        加载通知
                      </div>
                    )}

                    {!isLoading && notifications.length === 0 && (
                      <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
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
                            'group flex w-full items-start gap-3 rounded-2xl px-4 py-4 text-left transition-all',
                            isUnread ? 'bg-[#fbfbfd] hover:bg-lightest-gray-background' : 'hover:bg-lightest-gray-background',
                          )}
                        >
                          <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full', getNotificationTone(notification.type))}>
                            <Icon size={17} strokeWidth={2.5} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="min-w-0 text-[14px] font-black text-midnight-graphite">{notification.title}</span>
                              {isUnread && <Circle size={7} className="shrink-0 fill-interactive-blue text-interactive-blue" />}
                            </span>
                            <span className="mt-1.5 block text-[13px] font-semibold leading-5 text-deep-gray">
                              {notification.message}
                            </span>
                            <span className="mt-3 block text-[10px] font-black uppercase tracking-wider text-light-gray">
                              {formatLocalDateTime(notification.createdAt, 'date-time')}
                            </span>
                          </span>
                        </button>
                      );
                    })}
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
