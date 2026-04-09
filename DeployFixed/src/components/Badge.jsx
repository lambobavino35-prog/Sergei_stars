import { BADGE_TIERS } from "../constants";
export default function Badge({ tier, size = 80, onClick, pulse = false, customTiers = [] }) {
  let t = BADGE_TIERS[tier] || BADGE_TIERS[0];
  let modelUrl = null;

  if (tier >= 100) {
    const custom = customTiers.find(ct => ct.id === tier);
    if (custom) {
      t = {
        ...custom,
        bg: custom.bg || "linear-gradient(135deg,#1a0a2e,#2d1060)",
        border: custom.border || "2px solid #a855f7",
        glow: custom.glow || "0 0 30px #a855f755",
        style: { fontSize: 48 },
      };
      modelUrl = custom.modelUrl || null;
    }
  }

  return (
    <div onClick={onClick} style={{
      width: size, height: size,
      background: t.bg, border: t.border, borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: t.glow, cursor: onClick ? "pointer" : "default",
      animation: pulse ? "pulseBadge 2s ease infinite" : "none",
      transition: "transform .2s", position: "relative", overflow: "hidden",
    }}>
      {tier >= 4 && tier < 100 && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "conic-gradient(from 0deg, transparent, rgba(255,255,255,.15), transparent)",
          animation: "rotateSpin 3s linear infinite",
        }} />
      )}
      {modelUrl ? (
        <model-viewer
          src={modelUrl}
          auto-rotate
          auto-rotate-delay="0"
          rotation-per-second="30deg"
          // НЕ добавляем camera-controls — его присутствие включает камеру
          // interaction-policy="none" блокирует все жесты пользователя
          interaction-policy="none"
          disable-zoom
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "transparent",
            // pointer-events: none — дополнительная защита от кликов по модели
            pointerEvents: "none",
          }}
        />
      ) : (
        <span style={t.style}>{t.emoji}</span>
      )}
    </div>
  );
}
