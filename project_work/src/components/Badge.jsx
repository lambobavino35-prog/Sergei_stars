import { BADGE_TIERS } from "../constants";
import { useEffect, useRef, useState, useCallback } from "react";

let _pid = 0;
const uid = () => ++_pid;

const FLYOUT_CSS = `
@keyframes badgeFlyOut {
  0%   { transform: translate(-50%,-50%) scale(0.3); opacity: 1; }
  80%  { opacity: 0.7; }
  100% { transform: translate(calc(-50% + var(--bdx)), calc(-50% + var(--bdy))) scale(var(--bs,0.5)); opacity: 0; }
}
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
    const dist = burst
      ? (size * 0.9 + Math.random() * size * 0.7)
      : (size * 0.4 + Math.random() * size * 0.5);
    const emoji = tierParticles[Math.floor(Math.random() * tierParticles.length)];
    const duration = burst ? (0.55 + Math.random() * 0.35) : (1.1 + Math.random() * 0.9);
    const scale = burst ? (0.7 + Math.random() * 0.9) : (0.3 + Math.random() * 0.5);
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * dist;
    const dy = Math.sin(rad) * dist;

    setParticles(prev => [...prev, { id, dx, dy, emoji, duration, scale }]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), duration * 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, tierParticles.join(",")]);

  useEffect(() => {
    if (!ambient) return;
    const iv = setInterval(() => spawnParticle(false), 380);
    return () => clearInterval(iv);
  }, [ambient, spawnParticle]);

  const handleClick = (e) => {
    if (ambient) {
      for (let i = 0; i < 14; i++) setTimeout(() => spawnParticle(true), i * 28);
    }
    if (modelUrl && modelRef.current) {
      modelRef.current.setAttribute("rotation-per-second", "200deg");
      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = setTimeout(() => {
        if (modelRef.current) modelRef.current.setAttribute("rotation-per-second", "30deg");
      }, 1400);
    }
    if (onClick) onClick(e);
  };

  const fontSize = t.style?.fontSize ?? Math.round(size * 0.5);

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
      }}
    >
      <style>{FLYOUT_CSS}</style>

      {particles.map(p => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: "50%", top: "50%",
            fontSize: Math.max(10, Math.round(size * 0.18 * p.scale)),
            lineHeight: 1,
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 20,
            "--bdx": `${p.dx}px`,
            "--bdy": `${p.dy}px`,
            "--bs": p.scale,
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
        <model-viewer
          ref={modelRef}
          src={modelUrl}
          auto-rotate
          auto-rotate-delay="0"
          rotation-per-second="30deg"
          interaction-policy="none"
          disable-zoom
          style={{
            width: "140%",
            height: "140%",
            background: "transparent",
            pointerEvents: "none",
          }}
        />
      ) : (
        <span style={{ fontSize, lineHeight: 1, position: "relative", zIndex: 1 }}>{t.emoji}</span>
      )}
    </div>
  );
}
