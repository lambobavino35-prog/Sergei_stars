import { useState } from "react";
import { SAVE_KEY } from "../constants";

export default function LoginScreen({ onLogin }) {
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  const users = [
    { id: "sergei", label: "Sergei", emoji: "🧔", sub: "Игрок" },
    { id: "admin",  label: "Admin",  emoji: "🔐", sub: "Управление" },
  ];

  const handleKey = (k) => {
    if (!sel) return;
    if (k === "⌫") { setPin(p => p.slice(0, -1)); return; }
    const np = pin + k;
    setPin(np);
    if (np.length === 4) {
      try {
        const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
        const userPin = sel === "admin" ? (saved.admin?.pin || "0000") : (saved.sergei?.pin || "1234");
        if (np === userPin) { onLogin(sel); return; }
      } catch {}
      const correctPin = sel === "admin" ? "0000" : "1234";
      if (np === correctPin) { onLogin(sel); return; }
      setShake(true);
      setTimeout(() => { setShake(false); setPin(""); }, 600);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 50% 0%, #0f172a 0%, #020617 70%)", padding: 24, fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: Math.random() * 100 + "%", top: Math.random() * 100 + "%", width: Math.random() * 3 + 1, height: Math.random() * 3 + 1, borderRadius: "50%", background: "#fff", opacity: Math.random() * 0.6 + 0.1, animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`, animationDelay: Math.random() * 3 + "s" }} />
        ))}
      </div>
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>⚡</div>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 28, fontWeight: 900, background: "linear-gradient(135deg,#fbbf24,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SERGEI QUEST</div>
          <div style={{ color: "#475569", fontSize: 13, fontWeight: 700 }}>Система заданий и наград</div>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {users.map(u => (
            <button key={u.id} onClick={() => { setSel(u.id); setPin(""); }} style={{ flex: 1, padding: "18px 12px", border: sel === u.id ? "2px solid #38bdf8" : "1px solid #1e3a5f", borderRadius: 18, background: sel === u.id ? "linear-gradient(135deg,#0c4a6e55,#1e3a8a33)" : "linear-gradient(135deg,#0f172a,#020617)", cursor: "pointer", color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", boxShadow: sel === u.id ? "0 0 20px #38bdf833" : "none", transition: "all .2s" }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>{u.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{u.label}</div>
              <div style={{ color: "#475569", fontSize: 11, fontWeight: 700 }}>{u.sub}</div>
            </button>
          ))}
        </div>
        {sel && (
          <div style={{ animation: "fadeUp .3s ease" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 24, animation: shake ? "shake .4s ease" : "none" }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: pin.length > i ? "#38bdf8" : "transparent", border: `2px solid ${pin.length > i ? "#38bdf8" : "#1e3a5f"}`, transition: "all .15s", boxShadow: pin.length > i ? "0 0 10px #38bdf8" : "none" }} />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
                k === "" ? <div key={i} /> :
                <button key={i} onClick={() => handleKey(k)} style={{ padding: "20px 0", border: "1px solid #1e3a5f", borderRadius: 14, background: "linear-gradient(135deg,#0f172a,#020617)", color: "#f1f5f9", fontFamily: "'Baloo 2',sans-serif", fontSize: k === "⌫" ? 18 : 24, fontWeight: 900, cursor: "pointer", transition: "transform .1s,background .1s", WebkitAppearance: "none" }}>{k}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
