import React from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import {
  ApprovalPushState,
  disableApprovalPushNotifications,
  enableApprovalPushNotifications,
  readApprovalPushState,
  setApprovalAppBadge,
} from '../lib/pushNotifications';
import { cn } from '../lib/utils';

interface NotificationSettingsCardProps {
  activeUsername?: string;
}

export default function NotificationSettingsCard({ activeUsername }: NotificationSettingsCardProps) {
  const [pushState, setPushState] = React.useState<ApprovalPushState | null>(null);
  const [isPushUpdating, setIsPushUpdating] = React.useState(false);

  React.useEffect(() => {
    let isCancelled = false;

    if (!activeUsername) {
      setPushState(null);
      return () => {
        isCancelled = true;
      };
    }

    void readApprovalPushState()
      .then((nextState) => {
        if (!isCancelled) setPushState(nextState);
      })
      .catch((error) => {
        if (!isCancelled) {
          setPushState({
            status: 'error',
            message: error instanceof Error ? error.message : '读取通知状态失败。',
            canEnable: false,
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeUsername]);

  const handleEnablePush = async () => {
    if (isPushUpdating) return;

    setIsPushUpdating(true);
    try {
      const nextState = await enableApprovalPushNotifications();
      setPushState(nextState);
    } catch (error) {
      setPushState({
        status: 'error',
        message: error instanceof Error ? error.message : '开启电脑/手机系统通知失败。',
        canEnable: true,
      });
    } finally {
      setIsPushUpdating(false);
    }
  };

  const handleDisablePush = async () => {
    if (isPushUpdating) return;

    setIsPushUpdating(true);
    try {
      const nextState = await disableApprovalPushNotifications();
      setPushState(nextState);
      void setApprovalAppBadge(0);
    } catch (error) {
      setPushState({
        status: 'error',
        message: error instanceof Error ? error.message : '关闭电脑/手机系统通知失败。',
        canEnable: true,
      });
    } finally {
      setIsPushUpdating(false);
    }
  };

  const isEnabled = pushState?.status === 'enabled';
  const canDisable = isEnabled && !isPushUpdating;

  return (
    <section className="mj-mobile-card overflow-hidden sm:rounded-[8px] sm:border-border-silver sm:p-4 sm:shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-0 sm:py-0">
        <span className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] sm:h-9 sm:w-9 sm:rounded-full',
          isEnabled ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#f6f7fb] text-medium-gray sm:bg-lightest-gray-background',
        )}>
          {isEnabled ? <BellRing size={18} strokeWidth={2.4} /> : <Bell size={18} strokeWidth={2.4} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-semibold text-midnight-graphite sm:text-[15px] sm:font-bold">电脑/手机系统通知</h2>
              <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-[18px] text-light-gray sm:font-semibold sm:text-medium-gray">
                {pushState?.message || '读取通知状态中...'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {pushState?.canEnable && (
                <button
                  type="button"
                  onClick={() => void handleEnablePush()}
                  disabled={isPushUpdating}
                  className="flex h-8 items-center justify-center gap-1 text-[12px] font-semibold text-interactive-blue transition-colors hover:text-action-blue disabled:text-light-silver sm:gap-1.5 sm:rounded-full sm:bg-midnight-graphite sm:px-3.5 sm:text-white sm:shadow-none sm:hover:bg-deep-gray"
                >
                  {isPushUpdating && <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />}
                  {isPushUpdating ? '开启中' : '开启'}
                </button>
              )}
              {canDisable && (
                <button
                  type="button"
                  onClick={() => void handleDisablePush()}
                  className="flex h-8 items-center justify-center text-[12px] font-semibold text-medium-gray transition-colors hover:text-midnight-graphite sm:rounded-full sm:border sm:border-border-silver sm:bg-white sm:px-3.5"
                >
                  关闭
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
