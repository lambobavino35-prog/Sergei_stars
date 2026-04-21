import { createPortal } from "react-dom";

export default function TaskCard({ task, isPending, isDone, isFailed, onClose, onSubmit, onCancel }) {
  const diffLabel = task.difficulty === "easy" ? "🟢 Лёгкое" : task.difficulty === "medium" ? "🟡 Среднее" : "🔴 Сложное";

  // ВАЖНО: рендерим модалку через portal в document.body.
  // Родительский scroll-контейнер в App.jsx имеет transform: translateY(...),
  // а по спецификации CSS это делает его containing block'ом для
  // position:fixed потомков → модалка прилипала к контейнеру, а не к вьюпорту,
  // и на маленьких/прокрученных экранах оказывалась вне видимой области
  // (или кликалась «в никуда»). Портал в body гарантирует, что position:fixed
  // работает как и задумывалось — относительно окна браузера.
  const modal = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(2,6,23,.88)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      animation: "fadeIn .2s ease",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480,
        background: "linear-gradient(160deg,#0f172a,#020617)",
        border: "1px solid #1e3a5f",
        borderRadius: "24px 24px 0 0",
        padding: "28px 20px 40px",
        animation: "slideUp .35s cubic-bezier(.34,1.56,.64,1)",
      }}>
        <div style={{ width: 40, height: 4, background: "#1e3a5f", borderRadius: 99, margin: "0 auto 24px" }} />
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
          <span style={{ fontSize: 48 }}>{task.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Baloo 2',sans-serif", fontWeight: 900, fontSize: 20, color: "#f1f5f9", lineHeight: 1.2 }}>{task.title}</div>
            <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, marginTop: 4 }}>
              {task.category} • {diffLabel}
            </div>
          </div>
          <div style={{ background: "#1c1407", border: "1px solid #78350f", borderRadius: 12, padding: "8px 14px", fontWeight: 900, color: "#fbbf24", fontSize: 18, flexShrink: 0 }}>
            💰 {task.reward}
          </div>
        </div>
        {task.description && (
          <div style={{ background: "#07111f", border: "1px solid #1e3a5f", borderRadius: 14, padding: "14px 16px", marginBottom: 20, color: "#94a3b8", fontWeight: 600, fontSize: 14, lineHeight: 1.6 }}>
            {task.description}
          </div>
        )}
        {isFailed ? (
          <div style={{ textAlign: "center", padding: "16px", background: "#2d0a0a", border: "1px solid #7f1d1d", borderRadius: 14, color: "#f87171", fontWeight: 800 }}>
            💀 Задание провалено — дедлайн истёк
          </div>
        ) : isDone ? (
          <div style={{ textAlign: "center", padding: "16px", background: "#031a10", border: "1px solid #134e2a", borderRadius: 14, color: "#4ade80", fontWeight: 800 }}>✅ Задание выполнено</div>
        ) : isPending ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ textAlign: "center", padding: "14px", background: "#1c1407", border: "1px solid #78350f", borderRadius: 14, color: "#fbbf24", fontWeight: 800 }}>⏳ На проверке у Admin</div>
            <button onClick={() => { onCancel(); onClose(); }} style={{ padding: 14, background: "#2d0a0a", color: "#f87171", border: "1px solid #7f1d1d", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>↩️ Отменить выполнение</button>
          </div>
        ) : (
          <button onClick={() => { onSubmit(task); onClose(); }} style={{ width: "100%", padding: 16, background: "#0ea5e9", color: "#020617", border: "none", borderRadius: 14, fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 20px #0ea5e955" }}>📤 Отметить как выполненное</button>
        )}
      </div>
    </div>
  );

  // SSR-safe: document может отсутствовать на сервере.
  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
