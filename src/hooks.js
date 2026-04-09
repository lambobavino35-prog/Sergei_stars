import { useState, useEffect, useRef, useCallback } from "react";
import { SAVE_KEY, INITIAL_STATE, SUPABASE_URL, SUPABASE_KEY, SUPABASE_ENABLED } from "./constants";

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
        _cancelledIds: parsed._cancelledIds || [],
      };
    }
  } catch {}
  return { ...INITIAL_STATE, _cancelledIds: [] };
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

// ─── Merge pendingTasks: удаления побеждают ─────────────────────────
// cancelledIds — объединение локальных И удалённых отменённых id.
// Ключевое исправление: берём _cancelledIds с ОБОИХ устройств,
// иначе одобрение/отклонение от админа не доходит до Сергея.
function mergePending(local = [], remote = [], cancelledIds = []) {
  const cancelled = new Set(cancelledIds);
  const map = new Map();
  local.forEach(p => { if (!cancelled.has(p.id)) map.set(p.id, p); });
  remote.forEach(p => { if (!cancelled.has(p.id) && !map.has(p.id)) map.set(p.id, p); });
  return [...map.values()];
}

export function useSupabaseSync(st, setSt) {
  const [syncStatus, setSyncStatus] = useState("online");
  const stRef = useRef(st);
  // lastPushTime: когда МЫ последний раз успешно пушили.
  // Используем ref чтобы не вызывать лишних рендеров и не создавать
  // бесконечный цикл push->setSt->push.
  const lastPushTime = useRef(st._updatedAt || 0);
  // skipNextPush: флаг, что изменение состояния пришло от pull,
  // а не от пользователя — push в этом случае не нужен.
  const skipNextPush = useRef(false);
  const pushTimer = useRef(null);

  useEffect(() => { stRef.current = st; }, [st]);

  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
  };

  const push = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    try {
      setSyncStatus("syncing");
      const now = Date.now();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/sergei_quest_state`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "main",
          data: stRef.current,
          updated_at: new Date(now).toISOString(),
        }),
      });
      if (res.ok) {
        lastPushTime.current = now;
        setSyncStatus("online");
      } else {
        setSyncStatus("error");
      }
    } catch {
      setSyncStatus("error");
    }
  }, []);

  const pull = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/sergei_quest_state?id=eq.main&select=*`,
        { headers }
      );
      if (!res.ok) { setSyncStatus("error"); return; }
      const rows = await res.json();
      if (!rows.length || !rows[0].data) { setSyncStatus("online"); return; }

      const remote = rows[0].data;
      const remoteTime = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : 0;

      setSt(local => {
        // localTime = максимум между тем что записано в состоянии
        // и тем когда мы сами последний раз пушили.
        // Это гарантирует что наш свежий push не будет перезаписан
        // нашим же старым remote.
        const localTime = Math.max(local._updatedAt || 0, lastPushTime.current);
        if (remoteTime <= localTime) return local; // Ничего нового в remote

        // FIX: объединяем _cancelledIds с ОБОИХ сторон
        // Без этого одобрение/отклонение задания админом не попадает
        // в список отменённых на устройстве Сергея, и задание
        // возвращается в pendingTasks при следующем pull.
        const cancelledIds = [
          ...new Set([
            ...(local._cancelledIds || []),
            ...(remote._cancelledIds || []),
          ]),
        ];

        const pendingTasks = mergePending(
          local.pendingTasks,
          remote.pendingTasks,
          cancelledIds
        );

        const merged = {
          ...local,
          ...remote,
          // sergei: спред remote поверх local — remote побеждает для
          // монет/логов (после одобрения), но не стирает локальные
          // поля если они не пришли от remote
          sergei: { ...local.sergei, ...remote.sergei },
          pendingTasks,
          _cancelledIds: cancelledIds,
          _updatedAt: remoteTime,
        };

        if (JSON.stringify(local) === JSON.stringify(merged)) return local;

        // Помечаем что это изменение от pull — не пушим обратно
        skipNextPush.current = true;
        saveState(merged);
        return merged;
      });

      setSyncStatus("online");
    } catch {
      setSyncStatus("error");
    }
  }, [setSt]);

  // Начальный pull
  useEffect(() => { pull(); }, []);

  // Интервал pull каждые 8 секунд
  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    const id = setInterval(pull, 8000);
    return () => clearInterval(id);
  }, [pull]);

  // Дебаунс push: 400мс после изменения состояния.
  // skipNextPush предотвращает push после pull (избегаем цикл).
  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(push, 400);
    return () => clearTimeout(pushTimer.current);
  }, [st, push]);

  return syncStatus;
}

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
