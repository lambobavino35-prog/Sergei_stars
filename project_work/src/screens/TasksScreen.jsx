import { useState } from "react";
import TaskCard from "../components/TaskCard";
import { deletePending } from "../hooks";

export default function TasksScreen({ st, setSt, showToast }) {
  const [filter, setFilter] = useState("Все");
  const [selectedTask, setSelectedTask] = useState(null);

  const categories = ["Все", ...Array.from(new Set(st.tasks.map(t => t.category)))];
  const today = new Date().toDateString();

  const pendingIds = (st.pendingTasks || []).filter(p => p.userId === "sergei").map(p => p.taskId);
  const completedToday = (st.sergei.completedTasks || [])
    .filter(c => new Date(c.date).toDateString() === today)
    .map(c => c.taskId);

  const allFiltered = st.tasks.filter(t => filter === "Все" || t.category === filter);
  const activeTasks = allFiltered.filter(t => !completedToday.includes(t.id));
  const completedTasks = allFiltered.filter(t => completedToday.includes(t.id));

  const submitTask = (task) => {
    if (pendingIds.includes(task.id)) return showToast("Уже отправлено на проверку", "info");
    if (completedToday.includes(task.id)) {
      return showToast(task.repeatable ? "Подожди одобрения перед повторной отправкой" : "Уже выполнено сегодня", "info");
    }
    const entry = { id: crypto.randomUUID(), taskId: task.id, userId: "sergei", submittedAt: Date.now() };
    setSt(s => ({
      ...s,
      pendingTasks: [...(s.pendingTasks || []), entry],
      sergei: {
        ...s.sergei,
        log: [{ id: crypto.randomUUID(), type: "submit", text: `📤 Отправил задание «${task.title}»`, ts: Date.now() }, ...s.sergei.log].slice(0, 100),
      },
    }));
    showToast(`📤 «${task.title}» отправлено на проверку!`, "info");
    setSelectedTask(null);
  };

  const cancelTask = async (task) => {
    const toRemove = (st.pendingTasks || []).filter(p => p.taskId === task.id && p.userId === "sergei");
    // Физически удаляем из Supabase
    for (const entry of toRemove) {
      await deletePending(entry.id);
    }
    setSt(s => ({
      ...s,
      pendingTasks: s.pendingTasks.filter(p => !(p.taskId === task.id && p.userId === "sergei")),
      sergei: {
        ...s.sergei,
        log: [{ id: crypto.randomUUID(), type: "cancel", text: `↩️ Отменил задание «${task.title}»`, ts: Date.now() }, ...s.sergei.log].slice(0, 100),
      },
    }));
    showToast(`↩️ «${task.title}» отменено`, "info");
    setSelectedTask(null);
  };

  const TaskRow = ({ task }) => {
    const isPending = pendingIds.includes(task.id);
    const isDoneToday = completedToday.includes(task.id);
    return (
      <div
        onClick={() => setSelectedTask(task)}
        style={{
          background: isDoneToday ? "linear-gradient(135deg,#031a10,#042a18)" : isPending ? "linear-gradient(135deg,#1c1407,#120c00)" : "linear-gradient(135deg,#0f172a,#020617)",
          border: isDoneToday ? "1px solid #134e2a55" : isPending ? "1px solid #78350f55" : "1px solid #1e3a5f",
          borderRadius: 20, padding: 16, marginBottom: 10, animation: "fadeUp .3s ease both", cursor: "pointer", opacity: isDoneToday ? 0.65 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 28, flexShrink: 0 }}>{task.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9", marginBottom: 2 }}>{task.title}</div>
            {task.description && <div style={{ fontSize: 12, color: "#475569", fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.description}</div>}
            <div style={{ fontSize: 11, color: "#334155", fontWeight: 700 }}>
              {task.category} • {task.difficulty === "easy" ? "🟢 Лёгкое" : task.difficulty === "medium" ? "🟡 Среднее" : "🔴 Сложное"}
              {task.repeatable ? " • 🔁" : ""}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 15 }}>💰 {task.reward}</span>
            {isDoneToday ? <span style={{ color: "#4ade80", fontWeight: 800, fontSize: 11 }}>✅ Готово</span>
              : isPending ? <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: 11 }}>⏳ Проверка</span>
              : <span style={{ color: "#38bdf8", fontWeight: 800, fontSize: 11 }}>Нажми →</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px 16px", paddingBottom: 100 }}>
      {selectedTask && (
        <TaskCard
          task={selectedTask}
          isPending={pendingIds.includes(selectedTask.id)}
          isDone={completedToday.includes(selectedTask.id)}
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
      {activeTasks.length === 0 && completedTasks.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#334155" }}><div style={{ fontSize: 40, marginBottom: 8 }}>📭</div><div style={{ fontWeight: 700 }}>Нет заданий</div></div>
      )}
      {activeTasks.map(task => <TaskRow key={task.id} task={task} />)}
      {completedTasks.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: "#134e2a33" }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: ".05em" }}>✅ Выполнено сегодня ({completedTasks.length})</span>
            <div style={{ flex: 1, height: 1, background: "#134e2a33" }} />
          </div>
          {completedTasks.map(task => <TaskRow key={task.id} task={task} />)}
        </>
      )}
    </div>
  );
}
