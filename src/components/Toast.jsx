export default function Toast({ msg, type }) {
  if (!msg) return null;
  const colors = {
    ok:   { bg: "#052e16", border: "#166534", text: "#4ade80" },
    err:  { bg: "#2d0a0a", border: "#7f1d1d", text: "#f87171" },
    info: { bg: "#1c1407", border: "#78350f", text: "#fbbf24" },
  };
  const c = colors[type] || colors.info;
  return (
    <div style={{
      position: "fixed", top: 12, left: 12, right: 12, zIndex: 999,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 16, padding: "12px 18px", fontWeight: 800, textAlign: "center",
      fontSize: 14, animation: "slideDown .3s cubic-bezier(.34,1.56,.64,1)",
    }}>{msg}</div>
  );
}
