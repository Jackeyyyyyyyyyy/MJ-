const appTitle = 'MJ \u5ba1\u6279\u4e2d\u5fc3';
const defaultUrl = '/work/requests';
const iconUrl = '/icons/icon-192.png';
const badgeUrl = '/icons/icon-180.png';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function getBadgeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

async function setAppBadgeCount(count) {
  if (!navigator.setAppBadge) return;

  try {
    if (count > 0) {
      await navigator.setAppBadge(count);
    } else if (navigator.clearAppBadge) {
      await navigator.clearAppBadge();
    } else {
      await navigator.setAppBadge(0);
    }
  } catch {
    // Some platforms expose Badging API but still gate it behind permissions.
  }
}

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || appTitle;
  const options = {
    body: data.body || data.message || '\u4f60\u6709\u65b0\u7684\u5ba1\u6279\u901a\u77e5',
    icon: iconUrl,
    badge: badgeUrl,
    tag: data.tag || data.notificationId || 'approval-notification',
    renotify: true,
    data: {
      url: data.url || defaultUrl,
      notificationId: data.notificationId,
      recordId: data.recordId,
      type: data.type,
    },
  };

  event.waitUntil(Promise.all([
    setAppBadgeCount(getBadgeCount(data.badgeCount)),
    self.registration.showNotification(title, options),
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || defaultUrl, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of windows) {
      const clientUrl = new URL(client.url);
      if (clientUrl.origin === self.location.origin) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }

    return self.clients.openWindow(targetUrl);
  })());
});
