import { BADGE_TIERS } from "../constants";
import { useEffect, useRef, useState, useCallback } from "react";

let _pid = 0;
const uid = () => ++_pid;

const FLYOUT_CSS = `
@keyframes badgeFlyOut {
  0%   { transform: translate(-50%,-50%) scale(0.6) rotate(0deg); opacity: 1; }
  70%  { opacity: 0.8; }
  100% { transform: translate(calc(-50% + var(--bdx)), calc(-50% + var(--bdy))) scale(var(--bs,0.2)) rotate(var(--bdr,270deg)); opacity: 0; }
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
    // Ambient: particles fly far beyond the badge boundaries — like the starfield in the photo
    const dist = burst
      ? (size * 1.4 + Math.random() * size * 1.6)
      : (size * 0.8 + Math.random() * size * 1.2);
    const emoji = tierParticles[Math.floor(Math.random() * tierParticles.length)];
    const duration = burst ? (0.4 + Math.random() * 0.25) : (1.5 + Math.random() * 1.2);
    const scale = burst ? (0.9 + Math.random() * 1.3) : (0.2 + Math.random() * 0.5);
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * dist;
    const dy = Math.sin(rad) * dist;
    const rotation = (Math.random() - 0.5) * 540;

    setParticles(prev => [...prev, { id, dx, dy, emoji, duration, scale, rotation }]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), duration * 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, tierParticles.join(",")]);

  useEffect(() => {
    if (!ambient) return;
    // Spawn every 200ms — dense starfield effect matching the photo
    const iv = setInterval(() => spawnParticle(false), 200);
    return () => clearInterval(iv);
  }, [ambient, spawnParticle]);

  const handleClick = (e) => {
    if (ambient) {
      // Explosion on click — 24 particles, rapid fire
      for (let i = 0; i < 24; i++) setTimeout(() => spawnParticle(true), i * 15);
    }
    if (modelUrl && modelRef.current) {
      // 3D model spins fast on click, then returns to normal
      modelRef.current.setAttribute("rotation-per-second", "250deg");
      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = setTimeout(() => {
        if (modelRef.current) modelRef.current.setAttribute("rotation-per-second", "30deg");
      }, 1500);
    }
    if (onClick) onClick(e);
  };

  const fontSize = t.style?.fontSize ?? Math.round(size * 0.5);

  return (
    // overflow: visible so particles escape the circle and 3D model isn't clipped
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
        overflow: "visible",      // ← KEY: no clipping of particles or 3D model
      }}
    >
      <style>{FLYOUT_CSS}</style>

      {particles.map(p => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: "50%", top: "50%",
            fontSize: Math.max(10, Math.round(size * 0.22 * p.scale)),
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
        // 3D model: positioned absolutely, 180% of badge size — NOT clipped by circle
        <div style={{
          position: "absolute",
          width: "180%",
          height: "180%",
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
