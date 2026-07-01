import { storage } from '../storage';
import { type ApprovalNotification } from '../types';

type ApprovalPushStatus =
  | 'unsupported'
  | 'not-configured'
  | 'needs-install'
  | 'denied'
  | 'disabled'
  | 'enabled'
  | 'error';

export interface ApprovalPushState {
  status: ApprovalPushStatus;
  message: string;
  canEnable: boolean;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

type NavigatorWithBadging = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const notificationIconUrl = '/icons/icon-192.png';

function isIosLikeDevice() {
  if (typeof navigator === 'undefined') return false;
  const navigatorWithTouch = navigator as Navigator & { maxTouchPoints?: number };
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && Number(navigatorWithTouch.maxTouchPoints || 0) > 1);
}

function isStandaloneWebApp() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as NavigatorWithStandalone).standalone === true;
}

function getEnvironmentIssue(): ApprovalPushState | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      status: 'unsupported',
      message: '当前浏览器环境不支持电脑/手机系统通知。',
      canEnable: false,
    };
  }

  if (!window.isSecureContext) {
    return {
      status: 'unsupported',
      message: '电脑/手机系统通知需要 HTTPS 域名，当前地址不能开启。',
      canEnable: false,
    };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return {
      status: 'unsupported',
      message: '当前浏览器不支持网页推送通知。',
      canEnable: false,
    };
  }

  if (isIosLikeDevice() && !isStandaloneWebApp()) {
    return {
      status: 'needs-install',
      message: 'iPhone 需要先用 Safari 添加到主屏幕，再从桌面图标打开后开启通知。',
      canEnable: false,
    };
  }

  return null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export async function setApprovalAppBadge(unreadCount: number) {
  const navigatorWithBadging = navigator as NavigatorWithBadging;
  if (!navigatorWithBadging.setAppBadge) return;

  const badgeCount = Math.max(0, Math.floor(unreadCount));

  try {
    if (badgeCount > 0) {
      await navigatorWithBadging.setAppBadge(badgeCount);
    } else if (navigatorWithBadging.clearAppBadge) {
      await navigatorWithBadging.clearAppBadge();
    } else {
      await navigatorWithBadging.setAppBadge(0);
    }
  } catch {
    // Badging is platform-controlled; unsupported or denied devices can ignore it.
  }
}

function getNotificationLaunchUrl(notification: ApprovalNotification) {
  let path = '/work/requests';
  if (notification.type === 'approval_pending') path = '/work/approvals';
  if (notification.type === 'approval_processing') path = '/work/processing';
  if (notification.type === 'approval_cc') path = '/work/cc';

  const params = new URLSearchParams();
  if (notification.id) params.set('notificationId', notification.id);
  if (notification.recordId) params.set('recordId', notification.recordId);
  if (notification.type) params.set('type', notification.type);

  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function canShowBrowserNotification() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && Notification.permission === 'granted';
}

export function showForegroundApprovalNotification(notification: ApprovalNotification) {
  if (!canShowBrowserNotification()) return false;

  try {
    const browserNotification = new Notification(notification.title || 'MJ 审批中心', {
      body: notification.message || '你有新的审批通知',
      icon: notificationIconUrl,
      tag: `approval-foreground-${notification.id}`,
      data: {
        url: getNotificationLaunchUrl(notification),
        notificationId: notification.id,
        recordId: notification.recordId,
        type: notification.type,
      },
    });

    browserNotification.onclick = () => {
      window.focus();
      const targetUrl = browserNotification.data?.url || getNotificationLaunchUrl(notification);
      window.location.assign(targetUrl);
      browserNotification.close();
    };

    return true;
  } catch {
    return false;
  }
}

async function getPushConfigState() {
  const config = await storage.getPushConfig();

  if (!config.configured || !config.publicKey) {
    return {
      config,
      issue: {
        status: 'not-configured',
        message: '服务器还没配置推送密钥，配置后这里就能开启。',
        canEnable: false,
      } satisfies ApprovalPushState,
    };
  }

  return { config, issue: null };
}

export async function readApprovalPushState(): Promise<ApprovalPushState> {
  const environmentIssue = getEnvironmentIssue();
  if (environmentIssue) return environmentIssue;

  try {
    const { issue } = await getPushConfigState();
    if (issue) return issue;

    if (Notification.permission === 'denied') {
      return {
        status: 'denied',
        message: '通知权限已被系统拒绝，需要到浏览器或系统设置里重新允许。',
        canEnable: false,
      };
    }

    const registration = await navigator.serviceWorker.getRegistration('/service-worker.js');
    const subscription = await registration?.pushManager.getSubscription();

    if (Notification.permission === 'granted' && subscription) {
      await storage.savePushSubscription(subscription.toJSON());
      return {
        status: 'enabled',
        message: '电脑/手机系统通知已开启。',
        canEnable: false,
      };
    }

    return {
      status: 'disabled',
      message: '开启后，新审批、待办、抄送和审批结果会弹出系统通知。',
      canEnable: true,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '读取通知状态失败。',
      canEnable: true,
    };
  }
}

export async function enableApprovalPushNotifications(): Promise<ApprovalPushState> {
  const environmentIssue = getEnvironmentIssue();
  if (environmentIssue) return environmentIssue;

  try {
    const { config, issue } = await getPushConfigState();
    if (issue) return issue;

    const registration = await navigator.serviceWorker.register('/service-worker.js');
    const readyRegistration = await navigator.serviceWorker.ready;
    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'denied') {
      return {
        status: 'denied',
        message: '通知权限已被拒绝，需要到系统设置里重新允许。',
        canEnable: false,
      };
    }

    if (permission !== 'granted') {
      return {
        status: 'disabled',
        message: '这次没有授权通知，之后还可以再开启。',
        canEnable: true,
      };
    }

    const pushRegistration = readyRegistration || registration;
    const existingSubscription = await pushRegistration.pushManager.getSubscription();
    const subscription = existingSubscription || await pushRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });

    await storage.savePushSubscription(subscription.toJSON());

    return {
      status: 'enabled',
      message: '已开启，之后有新的审批通知会弹出系统通知。',
      canEnable: false,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '开启系统通知失败。',
      canEnable: true,
    };
  }
}

export async function disableApprovalPushNotifications(): Promise<ApprovalPushState> {
  const environmentIssue = getEnvironmentIssue();
  if (environmentIssue) return environmentIssue;

  try {
    const registration = await navigator.serviceWorker.getRegistration('/service-worker.js');
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      await storage.deletePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }

    return {
      status: 'disabled',
      message: '已关闭这台设备的系统通知。',
      canEnable: true,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '关闭系统通知失败。',
      canEnable: true,
    };
  }
}
