import { BADGE_TIERS } from "../constants";
import { useEffect, useRef, useState, useCallback } from "react";

let _pid = 0;
const uid = () => ++_pid;

const FLYOUT_CSS = `
@keyframes badgeFlyOut {
  0%   { transform: translate(-50%,-50%) scale(0.5) rotate(0deg); opacity: 1; }
  60%  { opacity: 0.9; }
  100% { transform: translate(calc(-50% + var(--bdx)), calc(-50% + var(--bdy))) scale(var(--bs,0.3)) rotate(var(--bdr,180deg)); opacity: 0; }
}
@keyframes rotateSpin { to { transform: rotate(360deg); } }
@keyframes pulseBadge { 0%,100%{transform:scale(1)}50%{transform:scale(1.07)} }
`;

export default function Badge({ tier, size = 80, onClick, pulse = false, ambient = false, customTiers = [] }) {
  const [particles, setParticles] = useState([]);
  const modelRef = useRef(null);
  const spinTimerRef = useRef(null);

  let t = BADGE_TIERS[tier] || BADGE_TIERS[0];
  let modelUrl = null;
  let tierParticles = (t.particles || ["✨", "💫", "⭐"]);

  if (tier >= 100) {
    const custom = customTiers.find(ct => ct.id === tier);
    if (custom) {
      t = {
        ...custom,
        bg: custom.bg || "linear-gradient(135deg,#1a0a2e,#2d1060)",
        border: custom.border || "2px solid #a855f7",
        glow: custom.glow || "0 0 30px #a855f755",
        style: { fontSize: Math.round(size * 0.48) },
      };
      modelUrl = custom.modelUrl || null;
      tierParticles = custom.particles || ["✨", "💫", "🌟"];
    }
  }

  const spawnParticle = useCallback((burst) => {
    const id = uid();
    const angle = Math.random() * 360;
    // Ambient: fly far out beyond the badge boundaries (like photo)
    const dist = burst
      ? (size * 1.2 + Math.random() * size * 1.4)
      : (size * 0.7 + Math.random() * size * 1.1);
    const emoji = tierParticles[Math.floor(Math.random() * tierParticles.length)];
    const duration = burst ? (0.45 + Math.random() * 0.3) : (1.4 + Math.random() * 1.1);
    const scale = burst ? (0.8 + Math.random() * 1.2) : (0.25 + Math.random() * 0.55);
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * dist;
    const dy = Math.sin(rad) * dist;
    const rotation = (Math.random() - 0.5) * 360;

    setParticles(prev => [...prev, { id, dx, dy, emoji, duration, scale, rotation }]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), duration * 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, tierParticles.join(",")]);

  useEffect(() => {
    if (!ambient) return;
    // More frequent spawning for starfield effect, with varied timing
    const iv = setInterval(() => spawnParticle(false), 220);
    return () => clearInterval(iv);
  }, [ambient, spawnParticle]);

  const handleClick = (e) => {
    if (ambient) {
      // Big burst on click — more particles, faster
      for (let i = 0; i < 22; i++) setTimeout(() => spawnParticle(true), i * 18);
    }
    if (modelUrl && modelRef.current) {
      modelRef.current.setAttribute("rotation-per-second", "240deg");
      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = setTimeout(() => {
        if (modelRef.current) modelRef.current.setAttribute("rotation-per-second", "30deg");
      }, 1400);
    }
    if (onClick) onClick(e);
  };

  const fontSize = t.style?.fontSize ?? Math.round(size * 0.5);
  // For 3D models: no clip, overflow visible so model can breathe
  const is3D = !!modelUrl;

  return (
    <div
      onClick={handleClick}
      style={{
        width: size, height: size,
        background: t.bg, border: t.border, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: t.glow, cursor: onClick ? "pointer" : "default",
        animation: pulse ? "pulseBadge 2s ease infinite" : "none",
        transition: "transform .2s",
        position: "relative",
        // Allow particles and 3D model to overflow the circle
        overflow: "visible",
      }}
    >
      <style>{FLYOUT_CSS}</style>

      {particles.map(p => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: "50%", top: "50%",
            fontSize: Math.max(10, Math.round(size * 0.2 * p.scale)),
            lineHeight: 1,
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 20,
            "--bdx": `${p.dx}px`,
            "--bdy": `${p.dy}px`,
            "--bs": p.scale,
            "--bdr": `${p.rotation}deg`,
            animation: `badgeFlyOut ${p.duration}s ease-out forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}

      {tier >= 4 && tier < 100 && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "conic-gradient(from 0deg, transparent, rgba(255,255,255,.15), transparent)",
          animation: "rotateSpin 3s linear infinite",
          pointerEvents: "none",
        }} />
      )}

      {modelUrl ? (
        // 3D model: bigger, not clipped by the circle
        <div style={{
          position: "absolute",
          width: "170%",
          height: "170%",
          pointerEvents: "none",
          zIndex: 1,
        }}>
          <model-viewer
            ref={modelRef}
            src={modelUrl}
            auto-rotate
            auto-rotate-delay="0"
            rotation-per-second="30deg"
            interaction-policy="none"
            disable-zoom
            style={{
              width: "100%",
              height: "100%",
              background: "transparent",
              pointerEvents: "none",
            }}
          />
        </div>
      ) : (
        <span style={{ fontSize, lineHeight: 1, position: "relative", zIndex: 1 }}>{t.emoji}</span>
      )}
    </div>
  );
}
