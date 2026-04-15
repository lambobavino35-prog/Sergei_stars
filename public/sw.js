// ══════════════════════════════════════════════════════════════
//  SERVICE WORKER — доставка push-уведомлений
//  Работает независимо от того, залогинен пользователь или нет.
//  Получает команду CHECK_NOTIFICATIONS от главной страницы,
//  запрашивает Supabase и показывает системные уведомления.
// ══════════════════════════════════════════════════════════════

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Главная страница отправляет тип CHECK_NOTIFICATIONS вместе с credentials.
// Credentials передаются с каждым вызовом — SW не хранит состояние между
// перезапусками браузера.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CHECK_NOTIFICATIONS" && data.supabaseUrl && data.supabaseKey) {
    event.waitUntil(checkNotifications(data.supabaseUrl, data.supabaseKey));
  }
});

// Клик по уведомлению — фокусируем вкладку или открываем новую
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow("/");
    })
  );
});

async function checkNotifications(supabaseUrl, supabaseKey) {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/sq_notifications?seen=eq.false&select=*&order=created_at.asc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    if (!res.ok) return;

    const list = await res.json();
    for (const n of list) {
      // Показываем системное уведомление (работает даже при свёрнутой вкладке)
      await self.registration.showNotification(n.title, {
        body: n.body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: n.id, // предотвращает дубликаты если SW вызван дважды подряд
      });

      // Помечаем как seen сразу после показа
      fetch(`${supabaseUrl}/rest/v1/sq_notifications?id=eq.${n.id}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ seen: true }),
      }).catch(() => {});
    }
  } catch (_) {}
}
