import { useState } from "react";
import { BADGE_TIERS } from "../constants";
import Badge from "../components/Badge";
import Toast from "../components/Toast";

export default function ProfileScreen({ st, setSt, fireBurst }) {
  const [editing, setEditing] = useState(null);
  const [nameVal, setNameVal] = useState(st.sergei.name);
  const [pinVal, setPinVal] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [toast, setToast] = useState(null);
  const customTiers = st.customTiers || [];

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleBadgeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tierData = st.sergei.badgeTier >= 100
      ? (customTiers.find(ct => ct.id === st.sergei.badgeTier) || { particles: ["✨","💫","⭐"] })
      : BADGE_TIERS[st.sergei.badgeTier];
    fireBurst(tierData.particles || ["✨","💫","⭐"], rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const selectBadge = (tierId) => {
    setSt(s => ({ ...s, sergei: { ...s.sergei, badgeTier: tierId } }));
    showToast("Бейдж выбран! ✨");
  };

  const saveName = () => {
    if (!nameVal.trim()) return showToast("Введи имя!", "err");
    setSt(s => ({ ...s, sergei: { ...s.sergei, name: nameVal.trim() } }));
    setEditing(null); showToast("Имя обновлено! ✅");
  };

  const savePin = () => {
    if (pinVal.length !== 4 || !/^\d{4}$/.test(pinVal)) return showToast("PIN — 4 цифры", "err");
    if (pinVal !== pinConfirm) return showToast("PIN не совпадает", "err");
    setSt(s => ({ ...s, sergei: { ...s.sergei, pin: pinVal } }));
    setPinVal(""); setPinConfirm(""); setEditing(null);
    showToast("PIN изменён! 🔐");
  };

  const purchasedTiers = st.sergei.purchasedTiers || [0];

  // Все купленные тиры — стандартные + кастомные
  const allPurchased = [
    ...BADGE_TIERS.filter(t => purchasedTiers.includes(t.id)),
    ...customTiers.filter(ct => purchasedTiers.includes(ct.id)),
  ];
  const hasMultipleBadges = allPurchased.length > 1;

  const tier = st.sergei.badgeTier >= 100
    ? (customTiers.find(ct => ct.id === st.sergei.badgeTier) || BADGE_TIERS[0])
    : BADGE_TIERS[st.sergei.badgeTier] || BADGE_TIERS[0];
  const nextTier = st.sergei.badgeTier < 5 ? BADGE_TIERS[st.sergei.badgeTier + 1] : null;
  const progress = nextTier ? Math.min(100, (st.sergei.totalEarned / nextTier.cost) * 100) : 100;

  return (
    <div style={{ padding: "20px 16px", paddingBottom: 100 }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-block", marginBottom: 16 }}>
          <Badge tier={st.sergei.badgeTier} size={100} onClick={handleBadgeClick} pulse ambient customTiers={customTiers} />
        </div>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
          {tier.label || "Кастомный"} • {tier.name}
        </div>
        <div style={{ fontFamily: "'Baloo 2',sans-serif", fontSize: 28, fontWeight: 900, color: "#f1f5f9" }}>
          {st.sergei.name}
        </div>
        <div style={{ color: "#38bdf8", fontWeight: 800, fontSize: 18, marginTop: 4 }}>
          💰 {st.sergei.coins} монет
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
          <div style={{ background: "#1c1407", border: "1px solid #78350f33", borderRadius: 12, padding: "6px 14px", fontWeight: 800, fontSize: 14, color: "#fbbf24" }}>
            🍫 {st.sergei.chocolates || 0}
          </div>
          <div style={{ background: "#1c1438", border: "1px solid #7c3aed33", borderRadius: 12, padding: "6px 14px", fontWeight: 800, fontSize: 14, color: "#c084fc" }}>
            ⭐️ {st.sergei.stars || 0}
          </div>
        </div>
      </div>

      {/* ─── ВЫБОР БЕЙДЖА ─── */}
      {hasMultipleBadges && (
        <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 18, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
            🏅 Выбрать бейдж
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {allPurchased.map(t => {
              const isActive = st.sergei.badgeTier === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => selectBadge(t.id)}
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    opacity: isActive ? 1 : 0.55,
                    transition: "opacity .2s, transform .2s",
                    transform: isActive ? "scale(1.08)" : "scale(1)",
                  }}
                >
                  <div style={{
                    borderRadius: "50%",
                    padding: 3,
                    background: isActive ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "transparent",
                    boxShadow: isActive ? "0 0 16px #fbbf2455" : "none",
                    transition: "all .25s",
                  }}>
                    <Badge tier={t.id} size={52} customTiers={customTiers} />
                  </div>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: isActive ? "#fbbf24" : "#475569",
                    textAlign: "center",
                    maxWidth: 58,
                    lineHeight: 1.2,
                    transition: "color .2s",
                  }}>
                    {t.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {nextTier && (
        <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 18, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>До следующего тира</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#f59e0b" }}>{nextTier.emoji} {nextTier.name}</span>
          </div>
          <div style={{ height: 12, background: "#0d1526", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", width: progress + "%", borderRadius: 99, background: "linear-gradient(90deg,#0ea5e9,#38bdf8,#7dd3fc)", boxShadow: "0 0 14px #38bdf888", transition: "width 1s cubic-bezier(.34,1.56,.64,1)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)", animation: "shimmer 2s linear infinite" }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", fontWeight: 700 }}>
            <span>Заработано: {st.sergei.totalEarned}</span>
            <span>Нужно: {nextTier.cost}</span>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Монет",   value: st.sergei.coins,                emoji: "💰" },
          { label: "Заданий", value: st.sergei.completedTasks.length, emoji: "✅" },
        ].map(s => (
          <div key={s.label} style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 14, padding: "12px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 22 }}>{s.emoji}</div>
            <div style={{ fontFamily: "'Baloo 2',sans-serif", fontWeight: 900, fontSize: 18, color: "#f1f5f9" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 800, textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Edit name */}
      <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 18, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 10 }}>✏️ Имя</div>
        {editing === "name" ? (
          <>
            <input value={nameVal} onChange={e => setNameVal(e.target.value)} style={{ width: "100%", padding: "12px 14px", background: "#07111f", border: "1px solid #1e3a5f", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveName} style={{ flex: 1, padding: 12, background: "#059669", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, cursor: "pointer" }}>Сохранить</button>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: 12, background: "#1e3a5f", color: "#94a3b8", border: "none", borderRadius: 12, fontWeight: 800, cursor: "pointer" }}>Отмена</button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, color: "#f1f5f9" }}>{st.sergei.name}</span>
            <button onClick={() => setEditing("name")} style={{ padding: "8px 16px", background: "#1e3a5f", color: "#38bdf8", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Изменить</button>
          </div>
        )}
      </div>

      {/* Edit PIN */}
      <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 10 }}>🔐 PIN-код</div>
        {editing === "pin" ? (
          <>
            <input type="password" inputMode="numeric" maxLength={4} placeholder="Новый PIN (4 цифры)" value={pinVal} onChange={e => setPinVal(e.target.value.replace(/\D/g,"").slice(0,4))} style={{ width: "100%", padding: "12px 14px", background: "#07111f", border: "1px solid #1e3a5f", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none", marginBottom: 8 }} />
            <input type="password" inputMode="numeric" maxLength={4} placeholder="Повтори PIN" value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g,"").slice(0,4))} style={{ width: "100%", padding: "12px 14px", background: "#07111f", border: "1px solid #1e3a5f", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={savePin} style={{ flex: 1, padding: 12, background: "#059669", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, cursor: "pointer" }}>Сохранить</button>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: 12, background: "#1e3a5f", color: "#94a3b8", border: "none", borderRadius: 12, fontWeight: 800, cursor: "pointer" }}>Отмена</button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, color: "#475569" }}>• • • •</span>
            <button onClick={() => setEditing("pin")} style={{ padding: "8px 16px", background: "#1e3a5f", color: "#38bdf8", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Изменить</button>
          </div>
        )}
      </div>
    </div>
  );
}
