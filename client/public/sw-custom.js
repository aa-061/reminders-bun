// Custom service worker additions for push notifications
// This file is imported by the generated Workbox service worker

self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("Push event without data");
    return;
  }

  try {
    const data = event.data.json();

    const options = {
      body: data.body,
      icon: data.icon || "/pwa-192x192.png",
      badge: data.badge || "/pwa-64x64.png",
      tag: data.tag || "reminder",
      data: data.data || {},
      actions: data.actions || [],
      vibrate: [200, 100, 200],
      requireInteraction: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error("Error showing push notification:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === "dismiss") {
    return;
  }

  // Default action or "view" action
  const url = data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.focus();
          if (url !== "/") {
            client.navigate(url);
          }
          return;
        }
      }

      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed", event.notification.tag);
});
