import { useState } from "react";
import { REACTION_EMOJIS, OWN_ACTION_TYPES } from "../constants";
import { setLogReaction } from "../hooks";

export default function LogScreen({ st, setSt, user }) {
  // Открытая панель реакций (храним id записи, для которой показываем палитру)
  const [openPicker, setOpenPicker] = useState(null);

  const log = st.sergei.log || [];
  const formatDate = ts => {
    const d = new Date(ts);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  // Может ли Сергей реагировать на эту запись?
  // Только если user === 'sergei' (не админ) И тип события — НЕ его собственное действие.
  const canReact = (entry) => user === "sergei" && !OWN_ACTION_TYPES.includes(entry.type);

  const handleReact = (entry, emoji) => {
    // Тумблер: если уже стоит эта же реакция — снимаем, иначе ставим
    const newReaction = entry.reaction === emoji ? null : emoji;
    setSt(s => ({
      ...s,
      sergei: {
        ...s.sergei,
        log: s.sergei.log.map(l => l.id === entry.id ? { ...l, reaction: newReaction } : l),
      },
    }));
    // Пишем сразу в Supabase (точечный PATCH, без debounced push)
    setLogReaction(entry.id, newReaction);
    setOpenPicker(null);
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
      ) : log.map((entry, i) => {
        const reactable = canReact(entry);
        const hasReaction = !!entry.reaction;
        const isPickerOpen = openPicker === entry.id;
        return (
          <div key={entry.id || i} style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 14, padding: "12px 14px", marginBottom: 8, animation: "fadeUp .3s ease both", animationDelay: i * 0.03 + "s" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
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

            {/* ─── РЕАКЦИЯ ─── */}
            {(reactable || hasReaction) && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {/* Если реакция уже есть — показываем её как кнопку (тапнуть = убрать) */}
                {hasReaction && (
                  <button
                    onClick={() => reactable && handleReact(entry, entry.reaction)}
                    disabled={!reactable}
                    style={{
                      background: "linear-gradient(135deg,#1e3a5f,#0c1e3a)",
                      border: "1px solid #38bdf855",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#f1f5f9",
                      cursor: reactable ? "pointer" : "default",
                      lineHeight: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title={reactable ? "Нажми чтобы убрать" : ""}
                  >
                    <span>{entry.reaction}</span>
                  </button>
                )}

                {/* Если реакции нет и Сергей может реагировать — показываем кнопку "+" */}
                {reactable && !hasReaction && !isPickerOpen && (
                  <button
                    onClick={() => setOpenPicker(entry.id)}
                    style={{
                      background: "transparent",
                      border: "1px dashed #1e3a5f",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#475569",
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                  >
                    + 😀
                  </button>
                )}

                {/* Палитра эмодзи */}
                {reactable && isPickerOpen && (
                  <div style={{
                    display: "flex",
                    gap: 4,
                    background: "#07111f",
                    border: "1px solid #1e3a5f",
                    borderRadius: 999,
                    padding: "4px 6px",
                    animation: "fadeIn .15s ease",
                  }}>
                    {REACTION_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(entry, emoji)}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: "4px 6px",
                          fontSize: 20,
                          cursor: "pointer",
                          lineHeight: 1,
                          transition: "transform .1s",
                          borderRadius: 8,
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = "scale(1.25)"}
                        onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={() => setOpenPicker(null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: "4px 8px",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#475569",
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
