import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { SAVE_KEY, INITIAL_STATE, SUPABASE_URL, SUPABASE_KEY, SUPABASE_ENABLED, TELEGRAM_BOT_TOKEN, TELEGRAM_ENABLED } from "./constants";

// ══════════════════════════════════════════════════════════════
//  SUPABASE CLIENT (singleton)
//  Используется как для Realtime-подписок, так и для чтения/записи.
// ══════════════════════════════════════════════════════════════
export const supabase = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  : null;

// ══════════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export function sendNotification(title, body, icon = "/favicon.ico") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon }); } catch (e) { console.warn("Notification failed:", e); }
}

// ─── SERVICE WORKER ──────────────────────────────────────────
// Регистрируем SW один раз при загрузке страницы.
// SW работает независимо от статуса входа пользователя.
export function registerNotificationSW() {
  if (!("serviceWorker" in navigator) || !SUPABASE_ENABLED) return;
  navigator.serviceWorker.register("/sw.js").catch((e) =>
    console.warn("SW registration failed:", e)
  );
}

// Отправляем SW команду проверить Supabase на новые уведомления.
// Credentials передаём с каждым вызовом — SW stateless между сессиями.
export function triggerSWNotificationCheck() {
  if (!("serviceWorker" in navigator) || !SUPABASE_ENABLED) return;
  const msg = {
    type: "CHECK_NOTIFICATIONS",
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY,
  };
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(msg);
  } else {
    // На первом визите controller появляется только после активации SW
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage(msg));
  }
}

// ══════════════════════════════════════════════════════════════
//  LOCAL STATE  (localStorage — быстрый UI без задержек)
// ══════════════════════════════════════════════════════════════

export function loadState() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      return {
        ...INITIAL_STATE,
        ...parsed,
        sergei: { ...INITIAL_STATE.sergei, ...parsed.sergei },
        currencyShop: { ...INITIAL_STATE.currencyShop, ...(parsed.currencyShop || {}) },
      };
    }
  } catch {}
  return { ...INITIAL_STATE };
}

export function saveState(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {}
}

export function useSt() {
  const [st, _setSt] = useState(loadState);
  const setSt = useCallback((fn) => {
    _setSt(prev => {
      const next = typeof fn === "function" ? fn(prev) : { ...prev, ...fn };
      saveState(next);
      return next;
    });
  }, []);
  return [st, setSt];
}

// ══════════════════════════════════════════════════════════════
//  SUPABASE API HELPERS
// ══════════════════════════════════════════════════════════════

function makeHeaders() {
  return {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
  };
}

async function sbGet(table, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: makeHeaders(),
  });
  if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`);
  return res.json();
}

async function sbUpsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: makeHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`UPSERT ${table} failed: ${err}`);
  }
}

async function sbDelete(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: makeHeaders(),
  });
  if (!res.ok) throw new Error(`DELETE ${table} failed: ${res.status}`);
}

async function sbPatch(table, filter, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: makeHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PATCH ${table} failed: ${res.status}`);
}

// ══════════════════════════════════════════════════════════════
//  SYNC — Realtime-подписки вместо polling
//  Каждая сущность в своей таблице, подписка на изменения через WebSocket.
//  Нет polling каждые 8 секунд — трафик и нагрузка падают на порядок.
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  TELEGRAM
//  Отправка сообщений всем подписчикам бота.
//  Список подписчиков ведётся Edge Function'ом /telegram-webhook.
// ══════════════════════════════════════════════════════════════

// Получаем всех подписчиков из Supabase
async function getTelegramSubscribers() {
  if (!SUPABASE_ENABLED) return [];
  try {
    return await sbGet("sq_telegram_subscribers", "?select=chat_id,first_name,username");
  } catch (e) {
    console.error("getTelegramSubscribers error:", e);
    return [];
  }
}

// Отправляет текст всем подписчикам бота.
// Не падает если Telegram не настроен или нет подписчиков.
export async function sendToTelegram(text) {
  if (!TELEGRAM_ENABLED) return;
  const subscribers = await getTelegramSubscribers();
  if (!subscribers.length) return;

  const results = await Promise.allSettled(
    subscribers.map(s =>
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: s.chat_id,
          text,
          parse_mode: "HTML",
        }),
      }).then(r => {
        if (!r.ok) {
          // 403 = юзер заблокировал бота, удаляем его из БД тихо
          if (r.status === 403) {
            sbDelete("sq_telegram_subscribers", `chat_id=eq.${s.chat_id}`).catch(() => {});
          }
          return { ok: false, chatId: s.chat_id, status: r.status };
        }
        return { ok: true, chatId: s.chat_id };
      })
    )
  );

  return results;
}

// Вставляет уведомление в Supabase — доставка через pull на устройстве Sergei.
// В локальном режиме (без Supabase) сразу показывает браузерное уведомление.
// Параллельно отправляет то же сообщение всем подписчикам Telegram-бота.
export async function insertNotification(title, body) {
  // Browser-push (как раньше)
  if (!SUPABASE_ENABLED) {
    sendNotification(title, body);
  } else {
    try {
      await sbUpsert("sq_notifications", [{ id: crypto.randomUUID(), title, body, seen: false }]);
    } catch (e) {
      console.error("insertNotification error:", e);
    }
  }

  // Telegram — fire-and-forget, не ждём ответа, чтобы не тормозить UI
  if (TELEGRAM_ENABLED) {
    const text = `<b>${title}</b>\n${body}`;
    sendToTelegram(text).catch(e => console.error("Telegram send error:", e));
  }
}

// ─── Мапперы БД → локальный стейт ────────────────────────────

function mapProfileRow(p) {
  return {
    name:           p.name,
    pin:            p.pin,
    coins:          p.coins,
    chocolates:     p.chocolates,
    stars:          p.stars,
    badgeTier:      p.badge_tier,
    purchasedTiers: p.purchased_tiers || [0],
    claimedTiers:   p.claimed_tiers || p.purchased_tiers || [0],
    failedTasks:    p.failed_tasks || [],
    totalEarned:    p.total_earned,
  };
}

function mapTaskRow(t) {
  return {
    id:          t.id,
    title:       t.title,
    description: t.description || "",
    reward:      t.reward,
    emoji:       t.emoji,
    category:    t.category,
    difficulty:  t.difficulty,
    deadlineAt:  t.deadline_at ? new Date(t.deadline_at).getTime() : null,
  };
}

function mapRewardRow(r) {
  return {
    id:        r.id,
    title:     r.title,
    cost:      r.cost,
    emoji:     r.emoji,
    category:  r.category,
    oneTime:   r.one_time,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function mapPendingRow(p) {
  return {
    id:          p.id,
    taskId:      p.task_id,
    userId:      "sergei",
    submittedAt: new Date(p.submitted_at).getTime(),
  };
}

function mapLogRow(l) {
  return {
    id:       l.id,
    type:     l.type,
    text:     l.text,
    amount:   l.amount,
    ts:       new Date(l.ts).getTime(),
    comment:  l.comment || null,
    reaction: l.reaction || null,
  };
}

function mapCustomTierRow(ct) {
  return {
    id:        ct.id,
    name:      ct.name,
    cost:      ct.cost,
    emoji:     ct.emoji,
    modelUrl:  ct.model_url,
    particles: ct.particles || ["✨","💫","🌟"],
    label:     ct.label || "Кастомный",
  };
}

function mapPurchasedRewardRow(r) {
  return {
    id:       r.id,
    rewardId: r.reward_id,
    title:    r.title,
    emoji:    r.emoji,
    boughtAt: new Date(r.bought_at).getTime(),
  };
}

function mapCompletedTaskRow(c) {
  return {
    id:     c.id,
    taskId: c.task_id,
    date:   new Date(c.completed_at).getTime(),
  };
}

export function useSupabaseSync(st, setSt, user) {
  const [syncStatus, setSyncStatus] = useState("online");
  const stRef = useRef(st);
  const initialized = useRef(false);
  const skipPush = useRef(false);
  const pushTimer = useRef(null);

  useEffect(() => { stRef.current = st; }, [st]);

  // ─── INITIAL PULL ────────────────────────────────────────────
  // Один раз при загрузке — забираем всё состояние из БД.
  // Дальше — обновления идут через Realtime-подписки.
  const initialPull = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    try {
      const [
        profiles,
        tasks,
        rewards,
        pending,
        log,
        customTiers,
        purchasedRewards,
        completedTasks,
      ] = await Promise.all([
        sbGet("sq_profile", "?id=eq.sergei&select=*"),
        sbGet("sq_tasks", "?select=*&order=created_at.asc"),
        sbGet("sq_rewards", "?select=*&order=created_at.asc"),
        sbGet("sq_pending", "?select=*&order=submitted_at.asc"),
        sbGet("sq_log", "?select=*&order=ts.desc&limit=100"),
        sbGet("sq_custom_tiers", "?select=*&order=id.asc"),
        sbGet("sq_purchased_rewards", "?select=*&order=bought_at.desc"),
        sbGet("sq_completed_tasks", "?select=*&order=completed_at.desc&limit=200"),
      ]);

      if (!profiles.length) { setSyncStatus("online"); return; }

      const p = profiles[0];
      setSt(local => {
        const next = {
          ...local,
          sergei: {
            ...local.sergei,
            ...mapProfileRow(p),
            log:              log.map(mapLogRow),
            completedTasks:   completedTasks.map(mapCompletedTaskRow),
            purchasedRewards: purchasedRewards.map(mapPurchasedRewardRow),
          },
          admin:        { pin: p.admin_pin },
          tasks:        tasks.map(mapTaskRow),
          rewards:      rewards.map(mapRewardRow),
          pendingTasks: pending.map(mapPendingRow),
          customTiers:  customTiers.map(mapCustomTierRow),
          currencyShop: p.currency_shop || local.currencyShop,
        };
        if (JSON.stringify(local) === JSON.stringify(next)) return local;
        skipPush.current = true;
        saveState(next);
        return next;
      });

      try { triggerSWNotificationCheck(); } catch (_) {}
      setSyncStatus("online");
    } catch (e) {
      console.error("Initial pull error:", e);
      setSyncStatus("error");
    }
  }, [setSt]);

  // ─── REALTIME SUBSCRIPTIONS ──────────────────────────────────
  // Подписываемся на изменения каждой таблицы.
  // Каждое событие INSERT/UPDATE/DELETE → точечное обновление локального стейта.
  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) return;

    // Помощник: применяем изменение к массиву по id (insert/update/delete)
    const applyArrayChange = (arr, payload, mapFn, idField = "id") => {
      const newRow = payload.new && Object.keys(payload.new).length ? mapFn(payload.new) : null;
      const oldId  = payload.old?.[idField] ?? payload.old?.id;
      if (payload.eventType === "DELETE") {
        return arr.filter(x => x[idField] !== oldId && x.id !== oldId);
      }
      if (payload.eventType === "INSERT") {
        if (arr.some(x => x.id === newRow.id)) return arr; // уже есть
        return [newRow, ...arr];
      }
      if (payload.eventType === "UPDATE") {
        return arr.map(x => x.id === newRow.id ? { ...x, ...newRow } : x);
      }
      return arr;
    };

    const channel = supabase.channel("sergei-quest-realtime");

    // Профиль — одна строка, просто перезаписываем
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_profile" }, (payload) => {
      if (!payload.new || !payload.new.id) return;
      const p = payload.new;
      setSt(local => {
        skipPush.current = true;
        const next = {
          ...local,
          sergei: { ...local.sergei, ...mapProfileRow(p) },
          admin:  { pin: p.admin_pin },
          currencyShop: p.currency_shop || local.currencyShop,
        };
        saveState(next);
        return next;
      });
    });

    // Tasks
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_tasks" }, (payload) => {
      setSt(local => {
        skipPush.current = true;
        const next = { ...local, tasks: applyArrayChange(local.tasks, payload, mapTaskRow) };
        saveState(next);
        return next;
      });
    });

    // Rewards
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_rewards" }, (payload) => {
      setSt(local => {
        skipPush.current = true;
        const next = { ...local, rewards: applyArrayChange(local.rewards, payload, mapRewardRow) };
        saveState(next);
        return next;
      });
    });

    // Pending
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_pending" }, (payload) => {
      setSt(local => {
        skipPush.current = true;
        const next = {
          ...local,
          pendingTasks: applyArrayChange(local.pendingTasks || [], payload, mapPendingRow),
        };
        saveState(next);
        return next;
      });
    });

    // Log
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_log" }, (payload) => {
      setSt(local => {
        skipPush.current = true;
        const currentLog = local.sergei.log || [];
        const updatedLog = applyArrayChange(currentLog, payload, mapLogRow).slice(0, 100);
        const next = {
          ...local,
          sergei: { ...local.sergei, log: updatedLog },
        };
        saveState(next);
        return next;
      });
    });

    // Custom tiers
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_custom_tiers" }, (payload) => {
      setSt(local => {
        skipPush.current = true;
        const next = {
          ...local,
          customTiers: applyArrayChange(local.customTiers || [], payload, mapCustomTierRow),
        };
        saveState(next);
        return next;
      });
    });

    // Purchased rewards
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_purchased_rewards" }, (payload) => {
      setSt(local => {
        skipPush.current = true;
        const current = local.sergei.purchasedRewards || [];
        const next = {
          ...local,
          sergei: {
            ...local.sergei,
            purchasedRewards: applyArrayChange(current, payload, mapPurchasedRewardRow),
          },
        };
        saveState(next);
        return next;
      });
    });

    // Completed tasks
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_completed_tasks" }, (payload) => {
      setSt(local => {
        skipPush.current = true;
        const current = local.sergei.completedTasks || [];
        const next = {
          ...local,
          sergei: {
            ...local.sergei,
            completedTasks: applyArrayChange(current, payload, mapCompletedTaskRow),
          },
        };
        saveState(next);
        return next;
      });
    });

    // Notifications — триггерим SW, чтобы он забрал и показал системное уведомление
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "sq_notifications" }, () => {
      try { triggerSWNotificationCheck(); } catch (_) {}
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setSyncStatus("online");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setSyncStatus("error");
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setSt]);

  // ─── PUSH ─────────────────────────────────────────────────────
  // Debounced push после изменений — дождаться, и записать всё целиком.
  // Это та же логика, что была — просто теперь работает на изменениях,
  // которые приходят локально (от действий юзера), а не от pull.
  const push = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    const s = stRef.current;
    try {
      setSyncStatus("syncing");
      await Promise.all([
        // Профиль — один upsert для всех скалярных полей
        sbUpsert("sq_profile", {
          id:              "sergei",
          name:            s.sergei.name,
          pin:             s.sergei.pin,
          admin_pin:       s.admin?.pin || "0000",
          coins:           s.sergei.coins,
          chocolates:      s.sergei.chocolates || 0,
          stars:           s.sergei.stars || 0,
          badge_tier:      s.sergei.badgeTier,
          purchased_tiers: s.sergei.claimedTiers || [0],
          claimed_tiers:   s.sergei.claimedTiers || [0],
          failed_tasks:    s.sergei.failedTasks || [],
          total_earned:    s.sergei.totalEarned || 0,
          currency_shop:   s.currencyShop,
          updated_at:      new Date().toISOString(),
        }),
        // Задания
        s.tasks.length > 0 && sbUpsert("sq_tasks",
          s.tasks.map(t => ({
            id:          t.id,
            title:       t.title,
            description: t.description || "",
            reward:      t.reward,
            emoji:       t.emoji,
            category:    t.category,
            difficulty:  t.difficulty,
            deadline_at: t.deadlineAt ? new Date(t.deadlineAt).toISOString() : null,
          }))
        ),
        // Награды
        s.rewards.length > 0 && sbUpsert("sq_rewards",
          s.rewards.map(r => ({
            id:        r.id,
            title:     r.title,
            cost:      r.cost,
            emoji:     r.emoji,
            category:  r.category,
            one_time:  r.oneTime || false,
          }))
        ),
        // Pending
        (s.pendingTasks || []).length > 0 && sbUpsert("sq_pending",
          s.pendingTasks.map(p => ({
            id:           p.id,
            task_id:      p.taskId,
            submitted_at: new Date(p.submittedAt).toISOString(),
          }))
        ),
        // Лог
        s.sergei.log.length > 0 && sbUpsert("sq_log",
          s.sergei.log.map(l => ({
            id:       l.id,
            type:     l.type,
            text:     l.text,
            amount:   l.amount || 0,
            ts:       new Date(l.ts).toISOString(),
            comment:  l.comment || null,
            reaction: l.reaction || null,
          }))
        ),
        // Удаляем старые записи лога за пределами среза 100
        s.sergei.log.length > 0 && (async () => {
          const oldest = s.sergei.log[s.sergei.log.length - 1];
          if (oldest) {
            await sbDelete("sq_log", `ts=lt.${encodeURIComponent(new Date(oldest.ts).toISOString())}&id=neq.${oldest.id}`);
          }
        })(),
        // Кастомные тиры
        (s.customTiers || []).length > 0 && sbUpsert("sq_custom_tiers",
          s.customTiers.map(ct => ({
            id:        ct.id,
            name:      ct.name,
            cost:      ct.cost,
            emoji:     ct.emoji || "🔮",
            model_url: ct.modelUrl || null,
            particles: ct.particles || ["✨","💫","🌟"],
            label:     ct.label || "Кастомный",
          }))
        ),
        // Купленные награды
        (s.sergei.purchasedRewards || []).length > 0 && sbUpsert("sq_purchased_rewards",
          s.sergei.purchasedRewards
            .filter(r => r.id && r.rewardId)
            .map(r => ({
              id:        r.id,
              reward_id: r.rewardId,
              title:     r.title,
              emoji:     r.emoji || "🎁",
              bought_at: new Date(r.boughtAt || Date.now()).toISOString(),
            }))
        ),
        // Выполненные задания
        (s.sergei.completedTasks || []).length > 0 && sbUpsert("sq_completed_tasks",
          s.sergei.completedTasks.map((c) => ({
            id:           c.id,
            task_id:      c.taskId,
            completed_at: new Date(c.date || Date.now()).toISOString(),
          }))
        ),
      ].filter(Boolean));

      setSyncStatus("online");
    } catch (e) {
      console.error("Push error:", e);
      setSyncStatus("error");
    }
  }, []);

  // Начальный pull
  useEffect(() => {
    initialPull().finally(() => { initialized.current = true; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced push после изменений
  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    if (!initialized.current) return;
    if (skipPush.current) { skipPush.current = false; return; }
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(push, 400);
    return () => clearTimeout(pushTimer.current);
  }, [st, push]);

  return syncStatus;
}

// ══════════════════════════════════════════════════════════════
//  Вспомогательные функции: точечные операции с Supabase
// ══════════════════════════════════════════════════════════════

export async function submitPending(entry) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbUpsert("sq_pending", [{
      id:           entry.id,
      task_id:      entry.taskId,
      submitted_at: new Date(entry.submittedAt).toISOString(),
    }]);
  } catch (e) {
    console.error("submitPending error:", e);
  }
}

export async function deletePending(id) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbDelete("sq_pending", `id=eq.${id}`);
  } catch (e) {
    console.error("deletePending error:", e);
  }
}

// ══════════════════════════════════════════════════════════════
//  approveTask — атомарная операция одобрения:
//  1. СНАЧАЛА пишем completed task в sq_completed_tasks
//  2. ПОТОМ удаляем из sq_pending
// ══════════════════════════════════════════════════════════════
export async function approveTask(pendingId, completedTask) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbUpsert("sq_completed_tasks", [{
      id:           completedTask.id,
      task_id:      completedTask.taskId,
      completed_at: new Date(completedTask.date).toISOString(),
    }]);
    await sbDelete("sq_pending", `id=eq.${pendingId}`);
  } catch (e) {
    console.error("approveTask error:", e);
  }
}

// ══════════════════════════════════════════════════════════════
//  Реакция на запись лога — обновляет одно поле в sq_log
// ══════════════════════════════════════════════════════════════
export async function setLogReaction(logId, reaction) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbPatch("sq_log", `id=eq.${logId}`, { reaction });
  } catch (e) {
    console.error("setLogReaction error:", e);
  }
}

// ══════════════════════════════════════════════════════════════
//  BURST ANIMATION
// ══════════════════════════════════════════════════════════════

export function useBurst() {
  const [bursts, setBursts] = useState([]);
  const fire = useCallback((particles, x, y) => {
    const id = Date.now();
    const items = Array.from({ length: 14 }, (_, i) => ({
      id: `${id}-${i}`,
      emoji: particles[i % particles.length],
      x: (Math.random() - 0.5) * 300,
      y: (Math.random() - 0.5) * 300 - 80,
      rot: (Math.random() - 0.5) * 720,
    }));
    setBursts(b => [...b, { id, x, y, items }]);
    setTimeout(() => setBursts(b => b.filter(p => p.id !== id)), 1800);
  }, []);
  return [bursts, fire];
}
