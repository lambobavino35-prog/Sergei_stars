import { useState, useEffect, useRef, useCallback } from "react";
import { SAVE_KEY, INITIAL_STATE, SUPABASE_URL, SUPABASE_KEY, SUPABASE_ENABLED } from "./constants";

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

// ══════════════════════════════════════════════════════════════
//  SYNC — каждая сущность в своей таблице, нет конфликтов
// ══════════════════════════════════════════════════════════════

// Вставляет уведомление в Supabase — доставка через pull на устройстве Sergei.
// В локальном режиме (без Supabase) сразу показывает браузерное уведомление.
export async function insertNotification(title, body) {
  if (!SUPABASE_ENABLED) {
    sendNotification(title, body);
    return;
  }
  try {
    await sbUpsert("sq_notifications", [{ id: crypto.randomUUID(), title, body, seen: false }]);
  } catch (e) {
    console.error("insertNotification error:", e);
  }
}

export function useSupabaseSync(st, setSt, user) {
  const [syncStatus, setSyncStatus] = useState("online");
  const stRef = useRef(st);
  const initialized = useRef(false);
  const pulling = useRef(false);
  const skipPush = useRef(false);
  const pushTimer = useRef(null);


  useEffect(() => { stRef.current = st; }, [st]);

  // ─── PULL ─────────────────────────────────────────────────────────────
  // Читаем каждую таблицу отдельно и собираем состояние.
  // Нет единого timestamp → нет конфликтов "кто новее".
  const pull = useCallback(async () => {
    if (!SUPABASE_ENABLED || pulling.current) return;
    pulling.current = true;
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
            name:             p.name,
            pin:              p.pin,
            coins:            p.coins,
            chocolates:       p.chocolates,
            stars:            p.stars,
            badgeTier:        p.badge_tier,
            purchasedTiers:   p.purchased_tiers || [0],
            claimedTiers:     p.claimed_tiers || p.purchased_tiers || [0],
            failedTasks:      p.failed_tasks || [],
            totalEarned:      p.total_earned,
            log:              log.map(l => ({
              id:      l.id,
              type:    l.type,
              text:    l.text,
              amount:  l.amount,
              ts:      new Date(l.ts).getTime(),
              comment: l.comment || null,
            })),
            completedTasks:   completedTasks.map(c => ({
              id:     c.id,
              taskId: c.task_id,
              date:   new Date(c.completed_at).getTime(),
            })),
            purchasedRewards: purchasedRewards.map(r => ({
              id:       r.id,
              rewardId: r.reward_id,
              title:    r.title,
              emoji:    r.emoji,
              boughtAt: new Date(r.bought_at).getTime(),
            })),
          },
          admin:      { pin: p.admin_pin },
          tasks:      tasks.map(t => ({
            id:          t.id,
            title:       t.title,
            description: t.description || "",
            reward:      t.reward,
            emoji:       t.emoji,
            category:    t.category,
            difficulty:  t.difficulty,
            deadlineAt:  t.deadline_at ? new Date(t.deadline_at).getTime() : null,
          })),
          rewards:    rewards.map(r => ({
            id:        r.id,
            title:     r.title,
            cost:      r.cost,
            emoji:     r.emoji,
            category:  r.category,
            oneTime:   r.one_time,
            createdAt: new Date(r.created_at).getTime(),
          })),
          pendingTasks: pending.map(p2 => ({
            id:          p2.id,
            taskId:      p2.task_id,
            userId:      "sergei",
            submittedAt: new Date(p2.submitted_at).getTime(),
          })),
          customTiers: customTiers.map(ct => ({
            id:        ct.id,
            name:      ct.name,
            cost:      ct.cost,
            emoji:     ct.emoji,
            modelUrl:  ct.model_url,
            particles: ct.particles || ["✨","💫","🌟"],
            label:     ct.label || "Кастомный",
          })),
          currencyShop: p.currency_shop || local.currencyShop,
        };

        if (JSON.stringify(local) === JSON.stringify(next)) return local;
        skipPush.current = true;
        saveState(next);
        return next;
      });

      // Уведомления — отдельный fetch, не ломает pull если таблица не создана.
      // Delivery через SW: показывает системное уведомление даже при свёрнутой вкладке.
      try {
        triggerSWNotificationCheck();
      } catch (_) {}

      setSyncStatus("online");
    } catch (e) {
      console.error("Pull error:", e);
      setSyncStatus("error");
    } finally {
      pulling.current = false;
    }
  }, [setSt]);

  // ─── PUSH ─────────────────────────────────────────────────────────────
  // Каждая сущность пишется в свою таблицу независимо.
  // Никаких конфликтов — монеты и задания не мешают друг другу.
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
        // Задания — upsert всего списка
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
        // Награды — upsert всего списка
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
        // Pending tasks — upsert (удаление при approve/reject — см. ниже)
        (s.pendingTasks || []).length > 0 && sbUpsert("sq_pending",
          s.pendingTasks.map(p => ({
            id:           p.id,
            task_id:      p.taskId,
            submitted_at: new Date(p.submittedAt).toISOString(),
          }))
        ),
        // Лог — upsert (только добавляем, не удаляем)
        s.sergei.log.length > 0 && sbUpsert("sq_log",
          s.sergei.log.map(l => ({
            id:      l.id,
            type:    l.type,
            text:    l.text,
            amount:  l.amount || 0,
            ts:      new Date(l.ts).toISOString(),
            comment: l.comment || null,
          }))
        ),
        // Удаляем из sq_log записи старше тех, что уже не входят в срез 100
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
            .filter(r => r.id && r.rewardId)   // skip malformed entries without proper IDs
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
            id:           c.id,   // always a proper UUID — set in approve()
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
    pull().finally(() => { initialized.current = true; });
  }, []);

  // Pull каждые 8 секунд
  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    const id = setInterval(pull, 8000);
    return () => clearInterval(id);
  }, [pull]);

  // Debounced push после изменений (400мс)
  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    if (!initialized.current) return;
    if (skipPush.current) { skipPush.current = false; return; }
    clearTimeout(pushTimer.current);
    // Ждём завершения pull перед push — если pull ещё идёт, откладываем дольше
    const delay = pulling.current ? 1200 : 400;
    pushTimer.current = setTimeout(push, delay);
    return () => clearTimeout(pushTimer.current);
  }, [st, push]);

  return syncStatus;
}

// ══════════════════════════════════════════════════════════════
//  Вспомогательный хук: удаление pending task из Supabase
//  (reject / cancel — запись нужно физически удалить)
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
//
//  Это исключает race condition: если другое устройство делает
//  pull между удалением pending и записью completed — задание
//  больше не появится как "доступное для выполнения".
// ══════════════════════════════════════════════════════════════
export async function approveTask(pendingId, completedTask) {
  if (!SUPABASE_ENABLED) {
    return;
  }
  try {
    // Шаг 1: записываем completed task — теперь он виден всем устройствам
    await sbUpsert("sq_completed_tasks", [{
      id:           completedTask.id,
      task_id:      completedTask.taskId,
      completed_at: new Date(completedTask.date).toISOString(),
    }]);
    // Шаг 2: только после этого удаляем pending
    await sbDelete("sq_pending", `id=eq.${pendingId}`);
  } catch (e) {
    console.error("approveTask error:", e);
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
