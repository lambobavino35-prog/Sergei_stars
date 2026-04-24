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

// Ручной «мьют» рассылки — управляется админом (см. AdminScreen → Telegram).
// Состояние хранится в sq_profile.telegram_muted (Supabase), чтобы тумблер
// действовал глобально для всех устройств, а не только там где его нажали.
// Модуль-левел кэш обновляется при initialPull и при realtime-апдейте профиля,
// чтобы sendToTelegram() мог синхронно отсечь отправку без лишнего GET.
let _telegramMutedCache = false;

export function isTelegramMuted() {
  return _telegramMutedCache;
}

// Вызывается из useSupabaseSync при pull/realtime — синкает серверное
// значение в module-level кэш.
export function applyTelegramMutedFromServer(value) {
  _telegramMutedCache = !!value;
}

// Переключение — сразу патчим Supabase. Realtime-подписка вернёт UPDATE
// событие и обновит st.telegramMuted у всех подключённых клиентов.
export async function setTelegramMuted(muted) {
  _telegramMutedCache = !!muted;
  if (!SUPABASE_ENABLED) return;
  try {
    await sbPatch("sq_profile", "id=eq.sergei", { telegram_muted: !!muted });
  } catch (e) {
    console.error("setTelegramMuted error:", e);
  }
}

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
// Не падает если Telegram не настроен / нет подписчиков / включён мьют.
export async function sendToTelegram(text) {
  if (!TELEGRAM_ENABLED) return;
  if (_telegramMutedCache) return;
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

// Отправляет уведомление всем подписчикам Telegram-бота.
// Оставлено имя insertNotification для обратной совместимости со всеми
// местами в коде, которые её вызывают. По сути — тонкая обёртка над sendToTelegram.
export async function insertNotification(title, body) {
  if (!TELEGRAM_ENABLED) return;
  const text = `<b>${title}</b>\n${body}`;
  // fire-and-forget — не ждём ответа, чтобы не тормозить UI
  sendToTelegram(text).catch(e => console.error("Telegram send error:", e));
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

// Читаем флаг мьюта из профиля — положим рядом со стейтом, но извлекаем
// отдельно, чтобы не смешивать с полями Сергея (мьют — это админская настройка).
function extractTelegramMuted(p) {
  return !!p?.telegram_muted;
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
    // cost/category теперь тоже едут с сервера (см. migration v6).
    // Для старых строк, где их ещё нет в БД, будут undefined —
    // UI терпим к этому (проверяем || "Другое", и просто не рисуем 💰 если нет).
    cost:     r.cost != null ? r.cost : undefined,
    category: r.category || undefined,
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
        // Поднимаем лимит с 100 до 500 — в UI мы всё равно срезаем
        // через .slice(0, 500), но хранить в локальном стейте больше
        // БЕЗОПАСНО, а главное — push() больше не будет затирать
        // хвост в БД (см. ниже: sbDelete из push убран).
        sbGet("sq_log", "?select=*&order=ts.desc&limit=500"),
        sbGet("sq_custom_tiers", "?select=*&order=id.asc"),
        sbGet("sq_purchased_rewards", "?select=*&order=bought_at.desc"),
        // Без limit'а: раньше стоял limit=200 и при накоплении истории
        // старые выполненные задания «выпадали» из стейта → снова
        // показывались как активные. Берём всё, задания одноразовые,
        // сериализация через realtime потоковая — размер не проблема.
        sbGet("sq_completed_tasks", "?select=*&order=completed_at.desc"),
      ]);

      if (!profiles.length) { setSyncStatus("online"); return; }

      const p = profiles[0];
      // Сразу подтягиваем мьют в module-level кэш, чтобы sendToTelegram
      // уже в этой сессии мог блокировать рассылку корректно.
      applyTelegramMutedFromServer(p.telegram_muted);
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
          admin:          { pin: p.admin_pin },
          tasks:          tasks.map(mapTaskRow),
          rewards:        rewards.map(mapRewardRow),
          pendingTasks:   pending.map(mapPendingRow),
          customTiers:    customTiers.map(mapCustomTierRow),
          currencyShop:   p.currency_shop || local.currencyShop,
          telegramMuted:  extractTelegramMuted(p),
        };
        if (JSON.stringify(local) === JSON.stringify(next)) return local;
        saveState(next);
        return next;
      });

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
      // Синкаем мьют немедленно — даже если ещё не дошло до setState,
      // следующий sendToTelegram уже увидит свежее значение.
      applyTelegramMutedFromServer(p.telegram_muted);
      setSt(local => {
        const next = {
          ...local,
          sergei: { ...local.sergei, ...mapProfileRow(p) },
          admin:          { pin: p.admin_pin },
          currencyShop:   p.currency_shop || local.currencyShop,
          telegramMuted:  extractTelegramMuted(p),
        };
        saveState(next);
        return next;
      });
    });

    // Tasks
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_tasks" }, (payload) => {
      setSt(local => {
        const next = { ...local, tasks: applyArrayChange(local.tasks, payload, mapTaskRow) };
        saveState(next);
        return next;
      });
    });

    // Rewards
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_rewards" }, (payload) => {
      setSt(local => {
        const next = { ...local, rewards: applyArrayChange(local.rewards, payload, mapRewardRow) };
        saveState(next);
        return next;
      });
    });

    // Pending
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sq_pending" }, (payload) => {
      setSt(local => {
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
        const currentLog = local.sergei.log || [];
        const updatedLog = applyArrayChange(currentLog, payload, mapLogRow).slice(0, 500);
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

  // Начальный pull
  useEffect(() => {
    initialPull().finally(() => { initialized.current = true; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── RECATCH-UP на возврат в онлайн/фокус ────────────────────
  // Supabase Realtime НЕ реплеит пропущенные события. Если WebSocket
  // отвалился (телефон уснул, Wi-Fi моргнул, вкладка в фоне), любые
  // изменения на сервере между disconnect и reconnect теряются навсегда.
  // Лечим это: при возвращении вкладки в активное состояние или при
  // событии online — заново дёргаем initialPull, чтобы стейт догнал
  // сервер. Это также страхует от ситуации, когда approve произошёл на
  // другом устройстве пока Сергей был офлайн.
  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && initialized.current) {
        initialPull();
      }
    };
    const onOnline = () => {
      if (initialized.current) initialPull();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [initialPull]);

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
//  2. ПАТЧИМ профиль (coins, total_earned, failed_tasks) точечно,
//     чтобы не было гонки с полным upsert'ом профиля из других клиентов.
//  3. ПОТОМ удаляем из sq_pending
//  4. Отдельно апсертим log-запись — по той же причине, чтобы запись
//     появилась у Сергея сразу, не дожидаясь debounced-push.
// ══════════════════════════════════════════════════════════════
export async function approveTask(pendingId, completedTask, profileUpdates, logEntry) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbUpsert("sq_completed_tasks", [{
      id:           completedTask.id,
      task_id:      completedTask.taskId,
      completed_at: new Date(completedTask.date).toISOString(),
    }]);
    if (profileUpdates) {
      await sbPatch("sq_profile", "id=eq.sergei", profileUpdates);
    }
    if (logEntry) {
      await sbUpsert("sq_log", [{
        id:       logEntry.id,
        type:     logEntry.type,
        text:     logEntry.text,
        amount:   logEntry.amount || 0,
        ts:       new Date(logEntry.ts).toISOString(),
        comment:  logEntry.comment || null,
        reaction: logEntry.reaction || null,
      }]);
    }
    await sbDelete("sq_pending", `id=eq.${pendingId}`);
  } catch (e) {
    console.error("approveTask error:", e);
  }
}

// Аналогично approveTask, но только для отклонения — патчит failed_tasks и пишет лог.
export async function rejectTask(pendingId, profileUpdates, logEntry) {
  if (!SUPABASE_ENABLED) return;
  try {
    if (profileUpdates) {
      await sbPatch("sq_profile", "id=eq.sergei", profileUpdates);
    }
    if (logEntry) {
      await sbUpsert("sq_log", [{
        id:       logEntry.id,
        type:     logEntry.type,
        text:     logEntry.text,
        amount:   logEntry.amount || 0,
        ts:       new Date(logEntry.ts).toISOString(),
        comment:  logEntry.comment || null,
        reaction: logEntry.reaction || null,
      }]);
    }
    await sbDelete("sq_pending", `id=eq.${pendingId}`);
  } catch (e) {
    console.error("rejectTask error:", e);
  }
}

// ══════════════════════════════════════════════════════════════
//  ТОЧЕЧНЫЕ ХЕЛПЕРЫ — каждое изменение стейта в UI должно
//  сопровождаться явным вызовом одного из этих хелперов.
//  После удаления bulk-push'а других путей к Supabase не осталось,
//  поэтому пропущенный хелпер == потерянное изменение.
// ══════════════════════════════════════════════════════════════

// Профиль — патчим только указанные поля, не трогая остальные.
// Принимает ключи в snake_case (совпадают с колонками в БД):
//   coins, chocolates, stars, name, pin, badge_tier, claimed_tiers,
//   purchased_tiers, failed_tasks, total_earned, currency_shop, admin_pin.
export async function patchProfile(updates) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbPatch("sq_profile", "id=eq.sergei", {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("patchProfile error:", e);
  }
}

// Добавить запись в лог. Принимает локальный формат (id, type, text, ts, amount, ...).
export async function appendLog(entry) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbUpsert("sq_log", [{
      id:       entry.id,
      type:     entry.type,
      text:     entry.text,
      amount:   entry.amount || 0,
      ts:       new Date(entry.ts).toISOString(),
      comment:  entry.comment || null,
      reaction: entry.reaction || null,
    }]);
  } catch (e) {
    console.error("appendLog error:", e);
  }
}

// Купленная награда — INSERT в sq_purchased_rewards.
export async function insertPurchasedReward(entry) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbUpsert("sq_purchased_rewards", [{
      id:        entry.id,
      reward_id: entry.rewardId,
      title:     entry.title,
      emoji:     entry.emoji || "🎁",
      cost:      entry.cost != null ? entry.cost : null,
      category:  entry.category || null,
      bought_at: new Date(entry.boughtAt || Date.now()).toISOString(),
    }]);
  } catch (e) {
    console.error("insertPurchasedReward error:", e);
  }
}

// Новое задание — INSERT в sq_tasks.
export async function insertTask(task) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbUpsert("sq_tasks", [{
      id:          task.id,
      title:       task.title,
      description: task.description || "",
      reward:      task.reward,
      emoji:       task.emoji,
      category:    task.category,
      difficulty:  task.difficulty,
      deadline_at: task.deadlineAt ? new Date(task.deadlineAt).toISOString() : null,
    }]);
  } catch (e) {
    console.error("insertTask error:", e);
  }
}

// Новая награда — INSERT в sq_rewards.
export async function insertReward(reward) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbUpsert("sq_rewards", [{
      id:        reward.id,
      title:     reward.title,
      cost:      reward.cost,
      emoji:     reward.emoji,
      category:  reward.category,
      one_time:  reward.oneTime || false,
    }]);
  } catch (e) {
    console.error("insertReward error:", e);
  }
}

// Новый кастомный тир — INSERT в sq_custom_tiers.
export async function insertCustomTier(tier) {
  if (!SUPABASE_ENABLED) return;
  try {
    await sbUpsert("sq_custom_tiers", [{
      id:        tier.id,
      name:      tier.name,
      cost:      tier.cost,
      emoji:     tier.emoji || "🔮",
      model_url: tier.modelUrl || null,
      particles: tier.particles || ["✨","💫","🌟"],
      label:     tier.label || "Кастомный",
    }]);
  } catch (e) {
    console.error("insertCustomTier error:", e);
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
