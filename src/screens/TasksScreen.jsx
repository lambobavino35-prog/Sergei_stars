import { useState, useEffect, useRef, useCallback } from "react";
import TaskCard from "../components/TaskCard";
import { deletePending, submitPending, sendToTelegram, patchProfile, appendLog } from "../hooks";

function formatDeadlineLeft(deadlineAt) {
  const ms = deadlineAt - Date.now();
  if (ms <= 0) return "🔴 Просрочено";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `⏰ ${h}ч ${m}м` : `⏰ ${m}м`;
}

// ══════════════════════════════════════════════════════════════
//  DEADLINE WARNINGS (6h и 1h до провала)
//  Храним «уже предупредили» в localStorage, чтобы не спамить
//  повторно при каждой проверке / перезагрузке страницы.
//  Формат: { [taskId]: { "6h": true, "1h": true } }
// ══════════════════════════════════════════════════════════════
const DEADLINE_WARNED_KEY = "sq_deadline_warned_v1";

function loadWarned() {
  try {
    return JSON.parse(localStorage.getItem(DEADLINE_WARNED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveWarned(data) {
  try {
    localStorage.setItem(DEADLINE_WARNED_KEY, JSON.stringify(data));
  } catch {}
}

// Чистим записи о заданиях, которых больше нет (удалены админом
// либо выполнены / провалены), чтобы localStorage не разрастался.
function pruneWarned(warned, knownTaskIds) {
  const pruned = {};
  for (const tid of Object.keys(warned)) {
    if (knownTaskIds.has(tid)) pruned[tid] = warned[tid];
  }
  return pruned;
}

// ══════════════════════════════════════════════════════════════
//  TaskRow — вынесен из TasksScreen, чтобы не пересоздавался
//  как «новый тип компонента» на каждый рендер. Раньше из-за
//  inline-определения React на каждом перерендере (например, при
//  realtime-событии Supabase) размонтировал все строки заново, из-за
//  чего тап по мобилке часто «проваливался».
// ══════════════════════════════════════════════════════════════
function TaskRow({ task, isFailed, isPending, isDone, deadlineLabel, onClick }) {
  const isOverdue = deadlineLabel === "🔴 Просрочено";
  return (
    <div
      onClick={onClick}
      style={{
        background: isFailed ? "linear-gradient(135deg,#2d0a0a,#1a0505)" : isDone ? "linear-gradient(135deg,#031a10,#042a18)" : isPending ? "linear-gradient(135deg,#1c1407,#120c00)" : "linear-gradient(135deg,#0f172a,#020617)",
        border: isFailed ? "1px solid #7f1d1d55" : isDone ? "1px solid #134e2a55" : isPending ? "1px solid #78350f55" : "1px solid #1e3a5f",
        borderRadius: 20, padding: 16, marginBottom: 10, animation: "fadeUp .3s ease both",
        cursor: "pointer",
        opacity: isDone ? 0.65 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>{task.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: isFailed ? "#f87171" : "#f1f5f9", marginBottom: 2 }}>{task.title}</div>
          {task.description && <div style={{ fontSize: 12, color: "#475569", fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.description}</div>}
          <div style={{ fontSize: 11, color: "#334155", fontWeight: 700 }}>
            {task.category} • {task.difficulty === "easy" ? "🟢 Лёгкое" : task.difficulty === "medium" ? "🟡 Среднее" : "🔴 Сложное"}
          </div>
          {deadlineLabel && !isDone && (
            <div style={{ fontSize: 11, fontWeight: 800, color: isOverdue ? "#f87171" : "#fbbf24", marginTop: 3 }}>
              {deadlineLabel}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 15 }}>💰 {task.reward}</span>
          {isFailed    ? <span style={{ color: "#f87171", fontWeight: 800, fontSize: 11 }}>💀 Провалено</span>
          : isDone    ? <span style={{ color: "#4ade80", fontWeight: 800, fontSize: 11 }}>✅ Выполнено</span>
          : isPending ? <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: 11 }}>⏳ Проверка</span>
          :             <span style={{ color: "#38bdf8", fontWeight: 800, fontSize: 11 }}>Нажми →</span>}
        </div>
      </div>
    </div>
  );
}

export default function TasksScreen({ st, setSt, showToast }) {
  const [filter, setFilter] = useState("Все");
  const [selectedTask, setSelectedTask] = useState(null);

  // ─── Тикер «раз в минуту» ────────────────────────────────────
  // Нужен, чтобы лейблы дедлайнов («⏰ 3ч 10м») сами
  // обновлялись без ручных действий пользователя.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const categories = ["Все", ...Array.from(new Set(st.tasks.map(t => t.category)))];

  const pendingIds = (st.pendingTasks || []).filter(p => p.userId === "sergei").map(p => p.taskId);
  const failedTaskIds = new Set(st.sergei.failedTasks || []);

  // ─── Все выполненные задания ─────────────────────────────────
  // Задания одноразовые: если хотя бы раз было одобрено — считаем done.
  // Источник истины — sq_completed_tasks (st.sergei.completedTasks).
  const completedEver = new Set((st.sergei.completedTasks || []).map(c => c.taskId));
  const isDoneTask = useCallback(
    (task) => completedEver.has(task.id),
    [completedEver]
  );

  // Стабильная ссылка на st для чтения актуального состояния внутри
  // интервала, без пересоздания эффекта на каждое изменение.
  const stRef = useRef(st);
  useEffect(() => { stRef.current = st; }, [st]);

  // Check deadlines every 60 seconds
  useEffect(() => {
    const checkDeadlines = () => {
      const now = Date.now();
      const s = stRef.current;

      const currentFailed = new Set(s.sergei.failedTasks || []);
      const currentCompleted = new Set((s.sergei.completedTasks || []).map(c => c.taskId));
      const currentPending = new Set((s.pendingTasks || []).filter(p => p.userId === "sergei").map(p => p.taskId));

      const knownIds = new Set(s.tasks.map(t => t.id));
      const warned = pruneWarned(loadWarned(), knownIds);
      let warnedChanged = false;

      const newFailed = [];
      const newLogs = [];
      const newlyFailedTitles = [];
      const warningsToSend = [];

      for (const task of s.tasks) {
        if (!task.deadlineAt) continue;
        if (currentFailed.has(task.id)) continue;
        if (currentCompleted.has(task.id)) continue;
        if (currentPending.has(task.id)) continue;

        const msLeft = task.deadlineAt - now;

        // Автофейл при просрочке.
        if (msLeft <= 0) {
          newFailed.push(task.id);
          newLogs.push({ id: crypto.randomUUID(), type: "fail", text: `💀 Задание «${task.title}» провалено — дедлайн истёк`, ts: Date.now() });
          newlyFailedTitles.push(task.title);
          continue;
        }

        const hoursLeft = msLeft / 3600000;
        const taskWarned = warned[task.id] || {};

        // 6-часовое окно: срабатываем когда времени ≤6ч, но >1ч
        // (иначе при создании таски с дедлайном меньше 6ч придёт
        // и 6ч-, и 1ч-уведомление почти одновременно).
        if (hoursLeft <= 6 && hoursLeft > 1 && !taskWarned["6h"]) {
          warned[task.id] = { ...taskWarned, "6h": true };
          warnedChanged = true;
          warningsToSend.push({ title: task.title, kind: "6h", hoursLeft });
        }

        // 1-часовое окно: ≤1ч осталось и ещё не слали.
        if (hoursLeft <= 1 && !taskWarned["1h"]) {
          warned[task.id] = { ...(warned[task.id] || {}), "1h": true };
          warnedChanged = true;
          warningsToSend.push({ title: task.title, kind: "1h", hoursLeft });
        }
      }

      if (warnedChanged) saveWarned(warned);

      // Обновляем стейт только если есть новые провалы.
      // Чистый updater-callback (без сайд-эффектов внутри), поэтому
      // безопасен для StrictMode.
      if (newFailed.length > 0) {
        const nextFailed = [...(s.sergei.failedTasks || []), ...newFailed];
        setSt(prev => ({
          ...prev,
          sergei: {
            ...prev.sergei,
            failedTasks: [...(prev.sergei.failedTasks || []), ...newFailed],
            log: [...newLogs, ...prev.sergei.log].slice(0, 500),
          },
        }));
        // Явные вызовы Supabase — нельзя полагаться на debounced push,
        // потому что он удалён. Каждое локальное изменение должно быть
        // продублировано отдельной записью на сервере.
        patchProfile({ failed_tasks: nextFailed });
        for (const entry of newLogs) appendLog(entry);
      }

      // Telegram-отправку делаем ПОСЛЕ setSt, вне updater'а.
      for (const title of newlyFailedTitles) {
        sendToTelegram(`💀 Задание «${title}» провалено — дедлайн истёк`);
      }
      for (const w of warningsToSend) {
        if (w.kind === "6h") {
          const h = Math.max(1, Math.ceil(w.hoursLeft));
          sendToTelegram(`⏰ До провала задания «${w.title}» осталось ${h} ${h === 1 ? "час" : h < 5 ? "часа" : "часов"}!`);
        } else {
          const m = Math.max(1, Math.ceil(w.hoursLeft * 60));
          sendToTelegram(`🚨 Срочно! До провала задания «${w.title}» ${m === 1 ? "осталась 1 минута" : m < 5 ? `осталось ${m} минуты` : `осталось ${m} минут`}!`);
        }
      }
    };

    checkDeadlines();
    const id = setInterval(checkDeadlines, 60000);
    return () => clearInterval(id);
  }, [setSt]);

  const allFiltered = st.tasks.filter(t => filter === "Все" || t.category === filter);
  const activeTasks = allFiltered.filter(t => !isDoneTask(t) && !failedTaskIds.has(t.id));
  const doneTasks   = allFiltered.filter(t => isDoneTask(t));
  const failedTasks = allFiltered.filter(t => failedTaskIds.has(t.id) && !isDoneTask(t));

  const submitTask = async (task) => {
    if (pendingIds.includes(task.id)) return showToast("Уже отправлено на проверку", "info");
    if (isDoneTask(task)) return showToast("Задание уже выполнено", "info");
    const entry = { id: crypto.randomUUID(), taskId: task.id, userId: "sergei", submittedAt: Date.now() };
    const logEntry = { id: crypto.randomUUID(), type: "submit", text: `📤 Отправил задание «${task.title}»`, ts: Date.now() };
    setSt(s => ({
      ...s,
      pendingTasks: [...(s.pendingTasks || []), entry],
      sergei: {
        ...s.sergei,
        log: [logEntry, ...s.sergei.log].slice(0, 500),
      },
    }));
    showToast(`📤 «${task.title}» отправлено на проверку!`, "info");
    setSelectedTask(null);
    // Пишем напрямую в Supabase — debounced push удалён, каждое
    // локальное изменение должно быть продублировано отдельной записью.
    await submitPending(entry);
    appendLog(logEntry);
    // Telegram
    sendToTelegram(`📤 <b>${st.sergei.name}</b> отправил задание «${task.title}» на проверку`);
  };

  const cancelTask = async (task) => {
    const toRemove = (st.pendingTasks || []).filter(p => p.taskId === task.id && p.userId === "sergei");
    await Promise.all(toRemove.map(entry => deletePending(entry.id)));
    const logEntry = { id: crypto.randomUUID(), type: "cancel", text: `↩️ Отменил задание «${task.title}»`, ts: Date.now() };
    setSt(s => ({
      ...s,
      pendingTasks: s.pendingTasks.filter(p => !(p.taskId === task.id && p.userId === "sergei")),
      sergei: {
        ...s.sergei,
        log: [logEntry, ...s.sergei.log].slice(0, 500),
      },
    }));
    showToast(`↩️ «${task.title}» отменено`, "info");
    setSelectedTask(null);
    appendLog(logEntry);
    sendToTelegram(`↩️ <b>${st.sergei.name}</b> отменил задание «${task.title}»`);
  };

  const renderRow = (task, isFailed) => {
    const isPending = pendingIds.includes(task.id);
    const isDone = isDoneTask(task);
    const deadlineLabel = task.deadlineAt ? formatDeadlineLeft(task.deadlineAt) : null;
    return (
      <TaskRow
        key={task.id}
        task={task}
        isFailed={isFailed}
        isPending={isPending}
        isDone={isDone}
        deadlineLabel={deadlineLabel}
        // Клик открывает карточку ВСЕГДА (в том числе для проваленных) —
        // раньше проваленные были некликабельны, и пользователи думали,
        // что «клик не работает».
        onClick={() => setSelectedTask(task)}
      />
    );
  };

  const selectedIsFailed = selectedTask ? failedTaskIds.has(selectedTask.id) : false;

  return (
    <div style={{ padding: "20px 16px", paddingBottom: 100 }}>
      {selectedTask && (
        <TaskCard
          task={selectedTask}
          isPending={pendingIds.includes(selectedTask.id)}
          isDone={isDoneTask(selectedTask)}
          isFailed={selectedIsFailed}
          onClose={() => setSelectedTask(null)}
          onSubmit={submitTask}
          onCancel={() => cancelTask(selectedTask)}
        />
      )}
      <div style={{ fontFamily: "'Baloo 2',sans-serif", fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 16 }}>📋 Задания</div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{ flexShrink: 0, padding: "6px 16px", borderRadius: 99, border: filter === c ? "none" : "1px solid #1e3a5f", background: filter === c ? "#0ea5e9" : "#0f172a", color: filter === c ? "#020617" : "#475569", fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: "pointer", boxShadow: filter === c ? "0 2px 14px #38bdf855" : "none" }}>{c}</button>
        ))}
      </div>
      {activeTasks.length === 0 && doneTasks.length === 0 && failedTasks.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#334155" }}><div style={{ fontSize: 40, marginBottom: 8 }}>📭</div><div style={{ fontWeight: 700 }}>Нет заданий</div></div>
      )}
      {activeTasks.map(task => renderRow(task, false))}
      {failedTasks.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: "#7f1d1d33" }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#f87171", textTransform: "uppercase", letterSpacing: ".05em" }}>💀 Провалено ({failedTasks.length})</span>
            <div style={{ flex: 1, height: 1, background: "#7f1d1d33" }} />
          </div>
          {failedTasks.map(task => renderRow(task, true))}
        </>
      )}
      {doneTasks.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: "#134e2a33" }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: ".05em" }}>✅ Выполнено ({doneTasks.length})</span>
            <div style={{ flex: 1, height: 1, background: "#134e2a33" }} />
          </div>
          {doneTasks.map(task => renderRow(task, false))}
        </>
      )}
    </div>
  );
}
