export default function LogScreen({ st }) {
  const log = st.sergei.log || [];
  const formatDate = ts => {
    const d = new Date(ts);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };
  return (
    <div style={{ padding: "20px 16px", paddingBottom: 100 }}>
      <div style={{ fontFamily: "'Baloo 2',sans-serif", fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 16 }}>📜 История</div>
      <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 18, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { label: "Всего заработано", val: st.sergei.totalEarned + " 💰", color: "#fbbf24" },
            { label: "Текущий баланс",   val: st.sergei.coins + " 💰",       color: "#38bdf8" },
            { label: "Задания выполнено",val: st.sergei.completedTasks.length, color: "#4ade80" },
            { label: "Наград куплено",   val: st.sergei.purchasedRewards.length, color: "#c084fc" },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 10, color: "#475569", fontWeight: 800, textTransform: "uppercase", marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontFamily: "'Baloo 2',sans-serif", fontWeight: 900, fontSize: 18, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
      {log.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#334155" }}><div style={{ fontSize: 40, marginBottom: 8 }}>📭</div><div style={{ fontWeight: 700 }}>История пуста</div></div>
      ) : log.map((entry, i) => (
        <div key={entry.id || i} style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 14, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 10, animation: "fadeUp .3s ease both", animationDelay: i * 0.03 + "s" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>{entry.text}</div>
            <div style={{ fontSize: 11, color: "#334155", fontWeight: 700, marginTop: 3 }}>{formatDate(entry.ts)}</div>
            {entry.comment && (
              <div style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700, marginTop: 4, fontStyle: "italic" }}>
                💬 {entry.comment}
              </div>
            )}
          </div>
          {entry.amount != null && (
            <div style={{ color: entry.amount > 0 ? "#fbbf24" : "#f87171", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
              {entry.amount > 0 ? "+" : ""}{entry.amount} 💰
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
