import { useState, useEffect, useCallback } from "react";
import { NAV_ITEMS, SYNC_ICONS, SUPABASE_ENABLED, SAVE_KEY, TEST_SAVE_KEY } from "./constants";
import { useSt, useSupabaseSync, useBurst, setSandboxMode } from "./hooks";
import Toast from "./components/Toast";
import BurstLayer from "./components/BurstLayer";
import Badge from "./components/Badge";
import LoginScreen from "./screens/LoginScreen";
import ProfileScreen from "./screens/ProfileScreen";
import TasksScreen from "./screens/TasksScreen";
import LogScreen from "./screens/LogScreen";
import RewardScreen from "./screens/RewardScreen";
import AdminScreen from "./screens/AdminScreen";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Baloo+2:wght@700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { background: radial-gradient(ellipse at 50% 0%, #0f172a 0%, #020617 70%); min-height: 100dvh; font-family: 'Nunito', sans-serif; }
  @keyframes fadeUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
  @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:none} }
  @keyframes slideUp   { from{opacity:0;transform:translateY(60px)} to{opacity:1;transform:none} }
  @keyframes shake     { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-10px)} 75%{transform:translateX(10px)} }
  @keyframes twinkle   { 0%,100%{opacity:.1} 50%{opacity:.6} }
  @keyframes pulseBadge{ 0%,100%{box-shadow:var(--glow,none),0 0 0 0 rgba(251,191,36,0)} 50%{box-shadow:var(--glow,none),0 0 0 8px rgba(251,191,36,.15)} }
  @keyframes rotateSpin{ to{transform:rotate(360deg)} }
  @keyframes shimmer   { from{transform:translateX(-100%)} to{transform:translateX(250%)} }
  @keyframes burst     { 0%{opacity:1;transform:translate(0,0) scale(0) rotate(0deg)} 80%{opacity:.8} 100%{opacity:0;transform:translate(var(--bx),var(--by)) scale(1.4) rotate(var(--br))} }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
  input, select, textarea { -webkit-appearance: none; }
  button { -webkit-appearance: none; }
`;

export default function App() {
  const [user, setUser] = useState(null);
  // Тестовый пользователь (PIN 7777) хранится в отдельном localStorage,
  // чтобы не трогать боевое состояние Сергея.
  const saveKey = user === "test" ? TEST_SAVE_KEY : SAVE_KEY;
  const [st, setSt] = useSt(saveKey);
  const [tab, setTab] = useState("profile");
  const [toast, setToast] = useState(null);
  const [bursts, fireBurst] = useBurst();
  const syncStatus = useSupabaseSync(st, setSt, user);

  // Загружаем model-viewer для 3D значков
  useEffect(() => {
    if (document.getElementById("model-viewer-script")) return;
    const script = document.createElement("script");
    script.id = "model-viewer-script";
    script.type = "module";
    script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    document.head.appendChild(script);
  }, []);

  // Включаем/выключаем режим песочницы для тестового пользователя (PIN 7777).
  // В режиме песочницы Supabase-запись и Telegram-рассылка становятся no-op,
  // чтобы тестирование не влияло на боевые данные Сергея.
  useEffect(() => {
    setSandboxMode(user === "test");
  }, [user]);

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const handleLogin = (uid) => { setUser(uid); };
  const handleLogout = () => { setUser(null); setTab("profile"); };

  if (!user) return (
    <>
      <style>{CSS}</style>
      <LoginScreen onLogin={handleLogin} />
    </>
  );

  const customTiers = st.customTiers || [];
  const isSergeiLike = user === "sergei" || user === "test";
  // Роль показывается в заголовке для разных пользователей
  const headerTitle = user === "admin"
    ? "Admin"
    : user === "test"
      ? `${st.sergei.name} (TEST)`
      : st.sergei.name;

  return (
    <>
      <style>{CSS}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <BurstLayer bursts={bursts} />

      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(2,6,23,.92)", backdropFilter: "blur(24px)", borderBottom: "1px solid #1e3a5f22", padding: "12px 16px", paddingTop: "calc(12px + env(safe-area-inset-top))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isSergeiLike ? (
              <Badge tier={st.sergei.badgeTier} size={36} customTiers={customTiers} />
            ) : (
              <span style={{ fontSize: 28 }}>🔐</span>
            )}
            <div>
              <div style={{ fontFamily: "'Baloo 2',sans-serif", fontWeight: 900, fontSize: 14, color: "#f1f5f9", lineHeight: 1, display: "flex", alignItems: "center", gap: 6 }}>
                {headerTitle}
                {user === "test" && (
                  <span style={{ fontSize: 9, fontWeight: 900, color: "#020617", background: "#fbbf24", padding: "2px 6px", borderRadius: 6, letterSpacing: ".05em" }}>SANDBOX</span>
                )}
              </div>
              {isSergeiLike && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24" }}>💰 {st.sergei.coins}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b" }}>🍫 {st.sergei.chocolates || 0}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#c084fc" }}>⭐️ {st.sergei.stars || 0}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12 }}>{SYNC_ICONS[syncStatus] || SYNC_ICONS.online}</span>
              {!SUPABASE_ENABLED && <span style={{ fontSize: 9, color: "#334155", fontWeight: 700 }}>LOCAL</span>}
              {user === "test" && <span style={{ fontSize: 9, color: "#fbbf24", fontWeight: 700 }}>TEST</span>}
            </div>
            <button onClick={handleLogout} style={{ padding: "7px 14px", background: "#1e3a5f", color: "#94a3b8", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Выйти</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
          {user === "admin" ? (
            <AdminScreen st={st} setSt={setSt} showToast={showToast} />
          ) : (
            <>
              {tab === "profile" && <ProfileScreen st={st} setSt={setSt} fireBurst={fireBurst} showToast={showToast} />}
              {tab === "tasks"   && <TasksScreen   st={st} setSt={setSt} showToast={showToast} />}
              {tab === "log"     && <LogScreen     st={st} setSt={setSt} user={user} />}
              {tab === "rewards" && <RewardScreen  st={st} setSt={setSt} fireBurst={fireBurst} showToast={showToast} />}
            </>
          )}
        </div>

        {/* Bottom Nav */}
        {isSergeiLike && (
          <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(2,6,23,.94)", backdropFilter: "blur(24px)", borderTop: "1px solid #1e3a5f33", display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" }}>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setTab(item.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 4px 8px", background: "none", border: "none", cursor: "pointer", color: tab === item.id ? "#fbbf24" : "#334155", fontFamily: "'Nunito',sans-serif", fontSize: 10, fontWeight: 800, transition: "color .2s" }}>
                <span style={{ fontSize: tab === item.id ? 24 : 22, transition: "font-size .2s" }}>{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
