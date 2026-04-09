export default function BurstLayer({ bursts }) {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {bursts.map(b => b.items.map(p => (
        <div key={p.id} style={{
          position: "fixed",
          left: (b.x ?? window.innerWidth / 2) + "px",
          top: (b.y ?? window.innerHeight / 2) + "px",
          fontSize: 24,
          animation: `burst 1.6s cubic-bezier(.2,1,.4,1) forwards`,
          "--bx": p.x + "px", "--by": p.y + "px", "--br": p.rot + "deg",
          opacity: 0,
        }}>{p.emoji}</div>
      )))}
    </div>
  );
}
