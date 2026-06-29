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

    void readApprovalPushState().then((nextState) => {
      if (!isCancelled) setPushState(nextState);
    });

    return () => {
      isCancelled = true;
    };
  }, [activeUsername]);

  const handleEnablePush = async () => {
    if (isPushUpdating) return;

    setIsPushUpdating(true);
    const nextState = await enableApprovalPushNotifications();
    setPushState(nextState);
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

  const isEnabled = pushState?.status === 'enabled';
  const canDisable = isEnabled && !isPushUpdating;

  return (
    <section className="rounded-[8px] border border-border-silver bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
          isEnabled ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-lightest-gray-background text-medium-gray',
        )}>
          {isEnabled ? <BellRing size={20} strokeWidth={2.5} /> : <Bell size={20} strokeWidth={2.5} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-black text-midnight-graphite">手机系统通知</h2>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-medium-gray">
                {pushState?.message || '读取通知状态中...'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {pushState?.canEnable && (
                <button
                  type="button"
                  onClick={() => void handleEnablePush()}
                  disabled={isPushUpdating}
                  className="flex h-9 items-center justify-center gap-2 rounded-full bg-midnight-graphite px-4 text-[12px] font-black text-white transition-colors hover:bg-deep-gray disabled:opacity-50"
                >
                  {isPushUpdating && <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />}
                  {isPushUpdating ? '开启中' : '开启'}
                </button>
              )}
              {canDisable && (
                <button
                  type="button"
                  onClick={() => void handleDisablePush()}
                  className="flex h-9 items-center justify-center rounded-full border border-border-silver bg-white px-4 text-[12px] font-black text-medium-gray transition-colors hover:text-midnight-graphite"
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
