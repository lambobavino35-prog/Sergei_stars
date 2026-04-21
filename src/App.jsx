import { useState, useEffect, useCallback, useRef } from "react";
import { NAV_ITEMS, SYNC_ICONS, SUPABASE_ENABLED } from "./constants";
import { useSt, useSupabaseSync, useBurst } from "./hooks";
import Toast from "./components/Toast";
import BurstLayer from "./components/BurstLayer";
import Badge from "./components/Badge";
import LoginScreen from "./screens/LoginScreen";
import ProfileScreen from "./screens/ProfileScreen";
import TasksScreen from "./screens/TasksScreen";
import LogScreen from "./screens/LogScreen";
import RewardScreen from "./screens/RewardScreen";
import AdminScreen from "./screens/AdminScreen";

// ══════════════════════════════════════════════════════════════
//  PULL-TO-REFRESH
//  Сверху скролла пальцем вниз → на пороге делаем force reload:
//  чистим Cache Storage (Service Worker / PWA) и reload'им страницу.
//  Тянет тач-событиями — для мобильных браузеров; на десктопе
//  мышью не срабатывает и не мешает.
// ══════════════════════════════════════════════════════════════
const PULL_THRESHOLD = 110;  // px — при каком смещении запускаем reload
const PULL_MAX       = 170;  // px — визуальный потолок индикатора
const PULL_RESIST    = 0.35; // коэффициент «тугости» (чем меньше, тем тяжелее тянуть)
const PULL_ACTIVATE  = 24;   // px — минимальный drag по Y до активации жеста
                              //     (раньше 5px → случайные касания запускали pull)

async function forceReload() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {}
  // Bust HTTP-кеш через query-param — надёжнее обычного reload().
  const url = new URL(window.location.href);
  url.searchParams.set("_r", Date.now().toString());
  window.location.replace(url.toString());
}

// ══════════════════════════════════════════════════════════════
//  Сохраняем залогиненного пользователя, чтобы pull-to-refresh
//  (или любой другой reload) не сбрасывал обратно на экран PIN.
// ══════════════════════════════════════════════════════════════
const USER_KEY = "sq_current_user";

function loadUser() {
  try {
    const v = localStorage.getItem(USER_KEY);
    return v === "sergei" || v === "admin" ? v : null;
  } catch {
    return null;
  }
}

function saveUser(u) {
  try {
    if (u) localStorage.setItem(USER_KEY, u);
    else   localStorage.removeItem(USER_KEY);
  } catch {}
}

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
  const [user, setUser] = useState(loadUser);
  const [st, setSt] = useSt();
  const [tab, setTab] = useState("profile");
  const [toast, setToast] = useState(null);
  const [bursts, fireBurst] = useBurst();
  const syncStatus = useSupabaseSync(st, setSt, user);

  // ─── Pull-to-refresh ────────────────────────────────────────
  const scrollRef = useRef(null);
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullState = useRef({ startY: null, active: false, dist: 0 });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      // Активируем pull только если мы на самом верху скролла —
      // иначе это обычный скролл страницы.
      if (el.scrollTop <= 0 && e.touches.length === 1) {
        pullState.current.startY = e.touches[0].clientY;
        pullState.current.active = false;
        pullState.current.dist = 0;
      } else {
        pullState.current.startY = null;
      }
    };

    const onTouchMove = (e) => {
      const st = pullState.current;
      if (st.startY === null) return;
      // Если пользователь успел прокрутить вниз — отменяем pull.
      if (el.scrollTop > 0) {
        st.startY = null;
        st.active = false;
        st.dist = 0;
        setPullDist(0);
        return;
      }
      const deltaY = e.touches[0].clientY - st.startY;
      if (deltaY <= 0) {
        // Палец поднимается / не тянет вниз — сбрасываем.
        if (st.dist !== 0) {
          st.dist = 0;
          setPullDist(0);
        }
        return;
      }
      // Начинаем жест только когда пересекли PULL_ACTIVATE px вниз —
      // иначе любой случайный скролл/тап запускал pull.
      if (!st.active && deltaY > PULL_ACTIVATE) st.active = true;
      if (!st.active) return;

      // Вычитаем PULL_ACTIVATE из deltaY, чтобы индикатор «стартовал с 0»
      // ровно в момент активации, а не прыгал сразу на ~PULL_ACTIVATE*RESIST.
      const distance = Math.min((deltaY - PULL_ACTIVATE) * PULL_RESIST, PULL_MAX);
      st.dist = distance;
      setPullDist(distance);
    };

    const onTouchEnd = () => {
      const st = pullState.current;
      if (st.active && st.dist >= PULL_THRESHOLD) {
        setRefreshing(true);
        setPullDist(PULL_THRESHOLD); // «защёлкиваем» индикатор на пороге
        // Небольшой таймаут — чтобы пользователь увидел, что рефреш принят.
        setTimeout(() => { forceReload(); }, 200);
      } else {
        setPullDist(0);
      }
      st.startY = null;
      st.active = false;
      st.dist = 0;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [user]); // пересоздаём после логина, когда контейнер меняется

  // Загружаем model-viewer для 3D значков
  useEffect(() => {
    if (document.getElementById("model-viewer-script")) return;
    const script = document.createElement("script");
    script.id = "model-viewer-script";
    script.type = "module";
    script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    document.head.appendChild(script);
  }, []);

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const handleLogin = (uid) => { saveUser(uid); setUser(uid); };
  const handleLogout = () => { saveUser(null); setUser(null); setTab("profile"); };

  if (!user) return (
    <>
      <style>{CSS}</style>
      <LoginScreen onLogin={handleLogin} />
    </>
  );

  const customTiers = st.customTiers || [];
  const isSergei = user === "sergei";
  const headerTitle = user === "admin" ? "Admin" : st.sergei.name;

  return (
    <>
      <style>{CSS}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <BurstLayer bursts={bursts} />

      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(2,6,23,.92)", backdropFilter: "blur(24px)", borderBottom: "1px solid #1e3a5f22", padding: "12px 16px", paddingTop: "calc(12px + env(safe-area-inset-top))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isSergei ? (
              <Badge tier={st.sergei.badgeTier} size={36} customTiers={customTiers} />
            ) : (
              <span style={{ fontSize: 28 }}>🔐</span>
            )}
            <div>
              <div style={{ fontFamily: "'Baloo 2',sans-serif", fontWeight: 900, fontSize: 14, color: "#f1f5f9", lineHeight: 1 }}>
                {headerTitle}
              </div>
              {isSergei && (
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
            </div>
            <button onClick={handleLogout} style={{ padding: "7px 14px", background: "#1e3a5f", color: "#94a3b8", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Выйти</button>
          </div>
        </div>

        {/* ─── Pull-to-refresh индикатор ─────────────────────────
            Рендерим ВНЕ scrollRef и позиционируем абсолютно —
            иначе `overflow:auto` контейнера клипал его (marginTop
            -PULL_MAX выносил индикатор за границу viewport'а и он
            был не виден). Теперь висит поверх всего и плавно
            выезжает сверху, когда пользователь тянет. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            // Выезжает сверху: при pullDist = 0 полностью спрятан,
            // при pullDist ≥ PULL_THRESHOLD — плотно прижат сразу под header.
            transform: `translateY(${Math.max(0, pullDist - 20)}px)`,
            opacity: pullDist > 10 || refreshing ? Math.min(1, pullDist / (PULL_THRESHOLD * 0.6)) : 0,
            transition: pullState.current?.active
              ? "opacity .1s"
              : "transform .25s ease-out, opacity .2s ease-out",
          }}
        >
          <div
            style={{
              marginTop: 72, // ниже header'а (~60px) + небольшой отступ
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              background: "rgba(15,23,42,0.95)",
              borderRadius: 99,
              border: pullDist >= PULL_THRESHOLD || refreshing
                ? "1px solid #fbbf24"
                : "1px solid #1e3a5f",
              boxShadow: pullDist >= PULL_THRESHOLD || refreshing
                ? "0 4px 24px #fbbf2455, 0 0 0 4px #fbbf2422"
                : "0 4px 20px #00000066",
              color: pullDist >= PULL_THRESHOLD || refreshing ? "#fbbf24" : "#94a3b8",
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "'Nunito',sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                fontSize: 18,
                display: "inline-block",
                animation: refreshing ? "rotateSpin 1s linear infinite" : "none",
                transform: refreshing
                  ? "none"
                  : `rotate(${Math.min(180, (pullDist / PULL_THRESHOLD) * 180)}deg)`,
                transition: "transform .08s",
              }}
            >
              {refreshing ? "⟳" : "↓"}
            </span>
            {refreshing
              ? "Обновляем…"
              : pullDist >= PULL_THRESHOLD
                ? "Отпусти для обновления"
                : "Потяни сильнее…"}
          </div>
        </div>

        {/* Content */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            paddingBottom: 80,
            // «Оттягиваем» содержимое вниз на pullDist px, чтобы
            // пользователь видел, что жест работает.
            // Translate — анимация на GPU без перерисовки layout.
            transform: `translateY(${pullDist}px)`,
            transition: pullState.current?.active ? "none" : "transform .25s ease-out",
            // На iOS Safari нужен, иначе скролл «заедает» при оттягивании
            WebkitOverflowScrolling: "touch",
            // Отключаем нативный chrome-style pull-to-refresh (он вступает
            // в конфликт с нашим — в результате жест ломается)
            overscrollBehaviorY: "contain",
          }}
        >
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
        {isSergei && (
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
