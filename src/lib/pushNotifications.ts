import { storage } from '../storage';

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

function isIosLikeDevice() {
  const navigatorWithTouch = navigator as Navigator & { maxTouchPoints?: number };
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && Number(navigatorWithTouch.maxTouchPoints || 0) > 1);
}

function isStandaloneWebApp() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as NavigatorWithStandalone).standalone === true;
}

function getEnvironmentIssue(): ApprovalPushState | null {
  if (!window.isSecureContext) {
    return {
      status: 'unsupported',
      message: '手机系统通知需要 HTTPS 域名，当前地址不能开启。',
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
        message: '手机系统通知已开启。',
        canEnable: false,
      };
    }

    return {
      status: 'disabled',
      message: '开启后，新审批、待办、抄送和审批结果会推送到手机。',
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
      message: '已开启，之后有新的审批通知会推送到手机。',
      canEnable: false,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '开启手机通知失败。',
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
      message: '已关闭这台设备的手机系统通知。',
      canEnable: true,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '关闭手机通知失败。',
      canEnable: true,
    };
  }
}
