import { useState } from "react";
import Badge from "../components/Badge";
import { deletePending, approveTask } from "../hooks";

export default function AdminScreen({ st, setSt, showToast }) {
  const [tab, setTab] = useState("pending");
  const [newReward, setNewReward] = useState({ title: "", cost: "", emoji: "🎁", category: "Отдых", oneTime: false });
  const [newTask, setNewTask] = useState({ title: "", description: "", reward: "", emoji: "⭐", category: "Дом", difficulty: "medium"});
  const [manualCoins, setManualCoins] = useState("");
  const [manualChocolates, setManualChocolates] = useState("");
  const [manualStars, setManualStars] = useState("");
  const [newTier, setNewTier] = useState({ name: "", cost: "", emoji: "🔮", modelUrl: "", particles: "✨,💫,🌟" });
  const [previewTier, setPreviewTier] = useState(null);

  const pending = (st.pendingTasks || []).filter(p => p.userId === "sergei");
  const getTaskById = id => st.tasks.find(t => t.id === id);
  const customTiers = st.customTiers || [];
  const currencyShop = st.currencyShop || { chocolate: { enabled: false, price: 100 }, star: { enabled: false, price: 150 } };

  const approve = async (entry) => {
    const task = getTaskById(entry.taskId);
    if (!task) return;
    // Формируем запись о выполненном задании
    const completedEntry = { id: crypto.randomUUID(), taskId: task.id, date: Date.now() };
    // Сначала пишем в sq_completed_tasks, потом удаляем из sq_pending —
    // это исключает race condition, при котором другое устройство могло
    // увидеть задание как доступное в промежутке между двумя операциями.
    await approveTask(entry.id, completedEntry);
    setSt(s => ({
      ...s,
      pendingTasks: s.pendingTasks.filter(p => p.id !== entry.id),
      sergei: {
        ...s.sergei,
        coins:          s.sergei.coins + task.reward,
        totalEarned:    (s.sergei.totalEarned || 0) + task.reward,
        completedTasks: [...s.sergei.completedTasks, completedEntry],
        log: [
          { id: crypto.randomUUID(), type: "earn", text: `✅ Задание «${task.title}» одобрено`, amount: task.reward, ts: Date.now() },
          ...s.sergei.log,
        ].slice(0, 100),
      },
    }));
    showToast(`✅ Начислено ${task.reward} монет!`, "ok");
  };

  const reject = async (entry) => {
    const task = getTaskById(entry.taskId);
    // Удаляем из Supabase сразу
    await deletePending(entry.id);
    setSt(s => ({
      ...s,
      pendingTasks: s.pendingTasks.filter(p => p.id !== entry.id),
      sergei: {
        ...s.sergei,
        log: [
          { id: crypto.randomUUID(), type: "reject", text: `❌ Задание «${task?.title || "—"}» отклонено`, ts: Date.now() },
          ...s.sergei.log,
        ].slice(0, 100),
      },
    }));
    showToast("❌ Задание отклонено", "err");
  };

  const addReward = () => {
    if (!newReward.title.trim() || !newReward.cost) return showToast("Заполни все поля", "err");
    const r = { ...newReward, id: crypto.randomUUID(), cost: parseInt(newReward.cost), createdAt: Date.now() };
    setSt(s => ({ ...s, rewards: [...s.rewards, r] }));
    setNewReward({ title: "", cost: "", emoji: "🎁", category: "Отдых", oneTime: false });
    showToast("🎁 Награда добавлена!", "ok");
  };

  const deleteReward = async (id) => {
    // Физически удаляем из Supabase
    try {
      const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_ENABLED } = await import("../constants");
      if (SUPABASE_ENABLED) {
        await fetch(`${SUPABASE_URL}/rest/v1/sq_rewards?id=eq.${id}`, {
          method: "DELETE",
          headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
        });
      }
    } catch {}
    setSt(s => ({ ...s, rewards: s.rewards.filter(x => x.id !== id) }));
  };

  const addTaskFn = () => {
    if (!newTask.title.trim() || !newTask.reward) return showToast("Заполни все поля", "err");
    const t = { ...newTask, id: crypto.randomUUID(), reward: parseInt(newTask.reward) };
    setSt(s => ({ ...s, tasks: [...s.tasks, t] }));
    setNewTask({ title: "", description: "", reward: "", emoji: "⭐", category: "Дом", difficulty: "medium"});
    showToast("📋 Задание добавлено!", "ok");
  };

  const deleteTask = async (id) => {
    try {
      const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_ENABLED } = await import("../constants");
      if (SUPABASE_ENABLED) {
        await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/sq_tasks?id=eq.${id}`, {
            method: "DELETE",
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
          }),
          fetch(`${SUPABASE_URL}/rest/v1/sq_completed_tasks?task_id=eq.${id}`, {
            method: "DELETE",
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
          }),
        ]);
      }
    } catch {}
    setSt(s => ({
      ...s,
      tasks: s.tasks.filter(x => x.id !== id),
      sergei: {
        ...s.sergei,
        completedTasks: s.sergei.completedTasks.filter(c => c.taskId !== id),
      },
    }));
  };

  const addManual = () => {
    const n = parseInt(manualCoins);
    if (!n || n === 0) return showToast("Введи кол-во монет", "err");
    setSt(s => ({ ...s, sergei: { ...s.sergei, coins: Math.max(0, s.sergei.coins + n), totalEarned: n > 0 ? (s.sergei.totalEarned || 0) + n : s.sergei.totalEarned, log: [{ id: crypto.randomUUID(), type: "manual", text: `🛡️ Ручное начисление: ${n > 0 ? "+" : ""}${n} монет`, amount: n, ts: Date.now() }, ...s.sergei.log].slice(0, 100) } }));
    setManualCoins(""); showToast(`${n > 0 ? "+" : ""}${n} монет начислено`, "ok");
  };

  const addManualChocolate = () => {
    const n = parseInt(manualChocolates);
    if (!n || n === 0) return showToast("Введи кол-во", "err");
    setSt(s => ({ ...s, sergei: { ...s.sergei, chocolates: Math.max(0, (s.sergei.chocolates || 0) + n) } }));
    setManualChocolates(""); showToast(`${n > 0 ? "+" : ""}${n} 🍫 обновлено`, "ok");
  };

  const addManualStars = () => {
    const n = parseInt(manualStars);
    if (!n || n === 0) return showToast("Введи кол-во", "err");
    setSt(s => ({ ...s, sergei: { ...s.sergei, stars: Math.max(0, (s.sergei.stars || 0) + n) } }));
    setManualStars(""); showToast(`${n > 0 ? "+" : ""}${n} ⭐️ обновлено`, "ok");
  };

  const addCustomTier = () => {
    if (!newTier.name.trim() || !newTier.cost) return showToast("Заполни название и цену", "err");
    const maxId = customTiers.reduce((m, ct) => Math.max(m, ct.id), 99);
    const tier = {
      id: maxId + 1,
      name: newTier.name.trim(),
      cost: parseInt(newTier.cost),
      emoji: newTier.emoji || "🔮",
      modelUrl: newTier.modelUrl.trim() || null,
      particles: newTier.particles.split(",").map(p => p.trim()).filter(Boolean),
      label: "Кастомный",
    };
    setSt(s => ({ ...s, customTiers: [...(s.customTiers || []), tier] }));
    setNewTier({ name: "", cost: "", emoji: "🔮", modelUrl: "", particles: "✨,💫,🌟" });
    showToast("✨ Кастомный тир добавлен!", "ok");
  };

  const deleteCustomTier = async (id) => {
    try {
      const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_ENABLED } = await import("../constants");
      if (SUPABASE_ENABLED) {
        await fetch(`${SUPABASE_URL}/rest/v1/sq_custom_tiers?id=eq.${id}`, {
          method: "DELETE",
          headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
        });
      }
    } catch {}
    setSt(s => ({ ...s, customTiers: (s.customTiers || []).filter(x => x.id !== id) }));
  };

  const iField = (label, val, onChange, opts = {}) => (
    <div style={{ marginBottom: 8 }}>
      {label && <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>}
      {opts.type === "select" ? (
        <select value={val} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "11px 14px", background: "#07111f", border: "1px solid #1e3a5f", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none" }}>
          {opts.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : opts.type === "textarea" ? (
        <textarea value={val} onChange={e => onChange(e.target.value)} placeholder={opts.placeholder} rows={3} style={{ width: "100%", padding: "11px 14px", background: "#07111f", border: "1px solid #1e3a5f", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none", resize: "vertical" }} />
      ) : (
        <input type={opts.type || "text"} value={val} onChange={e => onChange(e.target.value)} placeholder={opts.placeholder} style={{ width: "100%", padding: "11px 14px", background: "#07111f", border: "1px solid #1e3a5f", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none" }} />
      )}
    </div>
  );

  return (
    <div style={{ padding: "20px 16px", paddingBottom: 100 }}>

      {/* ─── 3D PREVIEW MODAL ─── */}
      {previewTier && (
        <div
          onClick={() => setPreviewTier(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.90)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)",
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: "linear-gradient(135deg,#0f172a,#020617)",
            border: "1px solid #7c3aed55",
            borderRadius: 28,
            padding: "28px 24px 20px",
            width: "min(340px, 90vw)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            boxShadow: "0 0 60px #7c3aed33",
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: ".08em" }}>
              👁 Превью тира
            </div>
            <div style={{ fontFamily: "'Baloo 2',sans-serif", fontSize: 22, fontWeight: 900, color: "#f1f5f9" }}>
              {previewTier.name}
            </div>
            {previewTier.modelUrl ? (
              <div style={{
                width: 220, height: 220,
                borderRadius: 24,
                overflow: "hidden",
                border: "2px solid #7c3aed44",
                background: "linear-gradient(135deg,#1a0a2e,#0a0520)",
                boxShadow: "0 0 40px #7c3aed44",
              }}>
                <model-viewer
                  src={previewTier.modelUrl}
                  auto-rotate
                  auto-rotate-delay="0"
                  rotation-per-second="30deg"
                  camera-controls
                  style={{ width: "100%", height: "100%", background: "transparent" }}
                />
              </div>
            ) : (
              <div style={{
                width: 140, height: 140, borderRadius: "50%",
                background: previewTier.bg || "linear-gradient(135deg,#1a0a2e,#2d1060)",
                border: previewTier.border || "2px solid #a855f7",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 64,
                boxShadow: previewTier.glow || "0 0 40px #a855f755",
              }}>
                {previewTier.emoji}
              </div>
            )}
            <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, textAlign: "center" }}>
              {previewTier.modelUrl ? "Потяни для вращения 🔄" : "Эмодзи-тир"}
            </div>
            {previewTier.particles && (
              <div style={{ fontSize: 20 }}>{previewTier.particles.join("  ")}</div>
            )}
            <button
              onClick={() => setPreviewTier(null)}
              style={{ width: "100%", padding: "12px 0", background: "#1e3a5f", color: "#94a3b8", border: "none", borderRadius: 14, fontWeight: 800, cursor: "pointer" }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Baloo 2',sans-serif", fontSize: 22, fontWeight: 900, color: "#f1f5f9" }}>🔐 Админ</div>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ background: "#1c1407", border: "1px solid #78350f", borderRadius: 10, padding: "6px 10px", fontWeight: 900, color: "#fbbf24", fontSize: 13 }}>💰 {st.sergei.coins}</div>
          <div style={{ background: "#1c0a00", border: "1px solid #78350f33", borderRadius: 10, padding: "6px 10px", fontWeight: 900, color: "#f59e0b", fontSize: 13 }}>🍫 {st.sergei.chocolates || 0}</div>
          <div style={{ background: "#0a0a2e", border: "1px solid #4c1d9533", borderRadius: 10, padding: "6px 10px", fontWeight: 900, color: "#c084fc", fontSize: 13 }}>⭐️ {st.sergei.stars || 0}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {[
          ["pending", "⏳ Проверка" + (pending.length ? ` (${pending.length})` : "")],
          ["rewards", "🎁 Награды"],
          ["tasks", "📋 Задания"],
          ["tiers", "🔮 Тиры"],
          ["balance", "💰 Баланс"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flexShrink: 0, padding: "9px 14px", border: tab === id ? "none" : "1px solid #1e3a5f", borderRadius: 12, background: tab === id ? "#fbbf24" : "#0f172a", color: tab === id ? "#020617" : "#475569", fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      {/* ─── ПРОВЕРКА ─── */}
      {tab === "pending" && (
        <>
          {pending.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#334155" }}><div style={{ fontSize: 40, marginBottom: 8 }}>✨</div><div style={{ fontWeight: 700 }}>Нет заданий на проверку</div></div>
          ) : pending.map(entry => {
            const task = getTaskById(entry.taskId);
            if (!task) return null;
            return (
              <div key={entry.id} style={{ background: "linear-gradient(135deg,#1c1a07,#1c0a00)", border: "1px solid #78350f", borderRadius: 20, padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>{task.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>{task.title}</div>
                    {task.description && <div style={{ fontSize: 12, color: "#475569", fontWeight: 600, marginTop: 2 }}>{task.description}</div>}
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, marginTop: 2 }}>{task.category} • 💰 {task.reward}</div>
                    <div style={{ fontSize: 10, color: "#334155", fontWeight: 700 }}>{new Date(entry.submittedAt).toLocaleString("ru-RU")}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => approve(entry)} style={{ flex: 1, padding: 12, background: "#059669", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, cursor: "pointer" }}>✅ Одобрить</button>
                  <button onClick={() => reject(entry)} style={{ flex: 1, padding: 12, background: "#dc2626", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, cursor: "pointer" }}>❌ Отклонить</button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ─── НАГРАДЫ ─── */}
      {tab === "rewards" && (
        <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 20, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>➕ Новая награда</div>
          {iField("Название", newReward.title, v => setNewReward(p => ({ ...p, title: v })), { placeholder: "Например: Ужин в ресторане" })}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {iField("Эмодзи", newReward.emoji, v => setNewReward(p => ({ ...p, emoji: v })), { placeholder: "🎁" })}
            {iField("Цена 💰", newReward.cost, v => setNewReward(p => ({ ...p, cost: v })), { type: "number", placeholder: "100" })}
          </div>
          {iField("Категория", newReward.category, v => setNewReward(p => ({ ...p, category: v })), { type: "select", options: ["Отдых","Еда","Развлечения","Свидание","Другое"] })}
          <div style={{ background: "#07111f", border: "1px solid #1e3a5f", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>Повторность покупки</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setNewReward(p => ({ ...p, oneTime: false }))} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: !newReward.oneTime ? "#059669" : "#0f172a", color: !newReward.oneTime ? "#fff" : "#475569", fontWeight: 800, fontSize: 13, cursor: "pointer", border: !newReward.oneTime ? "none" : "1px solid #1e3a5f" }}>♾️ Неограниченно</button>
              <button onClick={() => setNewReward(p => ({ ...p, oneTime: true }))} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: newReward.oneTime ? "#f59e0b" : "#0f172a", color: newReward.oneTime ? "#020617" : "#475569", fontWeight: 800, fontSize: 13, cursor: "pointer", border: newReward.oneTime ? "none" : "1px solid #1e3a5f" }}>1️⃣ Одноразово</button>
            </div>
          </div>
          <button onClick={addReward} style={{ width: "100%", padding: 14, background: "#fbbf24", color: "#020617", border: "none", borderRadius: 14, fontWeight: 800, cursor: "pointer", marginTop: 4 }}>Добавить награду</button>
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 10 }}>Все награды ({st.rewards.length})</div>
            {(() => {
              const purchasedRewards = st.sergei.purchasedRewards || [];
              const notBought = st.rewards.filter(r => !r.oneTime || !purchasedRewards.some(pr => pr.rewardId === r.id || pr.id === r.id));
              const bought = st.rewards.filter(r => r.oneTime && purchasedRewards.some(pr => pr.rewardId === r.id || pr.id === r.id));
              const renderReward = r => {
                const purchases = purchasedRewards.filter(pr => pr.rewardId === r.id || pr.id === r.id);
                const isBought = purchases.length > 0;
                return (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0f172a", background: isBought ? "linear-gradient(90deg,#03180a00,#03180a44)" : "none" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 20 }}>{r.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: isBought ? "#4ade80" : "#f1f5f9", display: "flex", alignItems: "center", gap: 6 }}>
                          {r.title}
                          {isBought && <span style={{ fontSize: 10, background: "#052e16", color: "#4ade80", border: "1px solid #134e2a", borderRadius: 6, padding: "1px 6px", fontWeight: 800 }}>🎁 {purchases.length > 1 ? `×${purchases.length}` : "Куплено"}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "#475569" }}>{r.category} • {r.oneTime ? "1️⃣ Одноразово" : "♾️ Повторно"}</div>
                        {isBought && <div style={{ fontSize: 10, color: "#166534", fontWeight: 700 }}>Последняя: {new Date(purchases[purchases.length - 1]?.boughtAt || 0).toLocaleDateString("ru-RU")}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "#fbbf24", fontWeight: 900 }}>💰 {r.cost}</span>
                      <button onClick={() => deleteReward(r.id)} style={{ padding: "4px 10px", background: "#2d0a0a", color: "#f87171", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                );
              };
              return (
                <>
                  {notBought.map(renderReward)}
                  {bought.length > 0 && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px" }}>
                        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#134e2a,#052e16)" }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap" }}>🎁 Куплено ({bought.length})</span>
                        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#052e16,#134e2a)" }} />
                      </div>
                      {bought.map(renderReward)}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── ЗАДАНИЯ ─── */}
      {tab === "tasks" && (
        <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 20, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>➕ Новое задание</div>
          {iField("Название", newTask.title, v => setNewTask(p => ({ ...p, title: v })), { placeholder: "Например: Помочь с покупками" })}
          {iField("Описание", newTask.description, v => setNewTask(p => ({ ...p, description: v })), { type: "textarea", placeholder: "Подробности задания..." })}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {iField("Эмодзи", newTask.emoji, v => setNewTask(p => ({ ...p, emoji: v })), { placeholder: "⭐" })}
            {iField("Монеты 💰", newTask.reward, v => setNewTask(p => ({ ...p, reward: v })), { type: "number", placeholder: "30" })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {iField("Категория", newTask.category, v => setNewTask(p => ({ ...p, category: v })), { type: "select", options: ["Дом","Кухня","Романтика","Другое"] })}
            {iField("Сложность", newTask.difficulty, v => setNewTask(p => ({ ...p, difficulty: v })), { type: "select", options: ["easy","medium","hard"] })}
          </div>
          <button onClick={addTaskFn} style={{ width: "100%", padding: 14, background: "#38bdf8", color: "#020617", border: "none", borderRadius: 14, fontWeight: 800, cursor: "pointer" }}>Добавить задание</button>
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 10 }}>Все задания ({st.tasks.length})</div>
            {(() => {
              const notDone = st.tasks.filter(t => !(st.sergei.completedTasks || []).some(ct => ct.taskId === t.id));
              const done = st.tasks.filter(t => (st.sergei.completedTasks || []).some(ct => ct.taskId === t.id));
              const renderTask = t => {
                const completions = (st.sergei.completedTasks || []).filter(ct => ct.taskId === t.id);
                const isDone = completions.length > 0;
                return (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0f172a", background: isDone ? "linear-gradient(90deg,#03180a00,#03180a66)" : "none" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{t.emoji}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: isDone ? "#4ade80" : "#f1f5f9", display: "flex", alignItems: "center", gap: 6 }}>
                          {t.title}
                          {isDone && <span style={{ fontSize: 10, background: "#052e16", color: "#4ade80", border: "1px solid #134e2a", borderRadius: 6, padding: "1px 6px", fontWeight: 800 }}>✅ Выполнено</span>}
                        </div>
                        {t.description && <div style={{ fontSize: 11, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>}
                        {isDone && <div style={{ fontSize: 10, color: "#166534", fontWeight: 700 }}>Последнее: {new Date(completions[completions.length - 1]?.date || 0).toLocaleDateString("ru-RU")}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <span style={{ color: "#fbbf24", fontWeight: 900 }}>💰 {t.reward}</span>
                      <button onClick={() => deleteTask(t.id)} style={{ padding: "4px 10px", background: "#2d0a0a", color: "#f87171", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                );
              };
              return (
                <>
                  {notDone.map(renderTask)}
                  {done.length > 0 && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px" }}>
                        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#134e2a,#052e16)" }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap" }}>✅ Выполнено ({done.length})</span>
                        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#052e16,#134e2a)" }} />
                      </div>
                      {done.map(renderTask)}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── КАСТОМНЫЕ ТИРЫ ─── */}
      {tab === "tiers" && (
        <div>
          <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #4c1d9555", borderRadius: 20, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>✨ Добавить 3D-тир</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {iField("Название", newTier.name, v => setNewTier(p => ({ ...p, name: v })), { placeholder: "Кристальный" })}
              {iField("Цена 💰", newTier.cost, v => setNewTier(p => ({ ...p, cost: v })), { type: "number", placeholder: "500" })}
            </div>
            {iField("URL .glb модели", newTier.modelUrl, v => setNewTier(p => ({ ...p, modelUrl: v })), { placeholder: "https://example.com/model.glb" })}
            <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, marginBottom: 8, marginTop: -4 }}>💡 Загрузи .glb файл на любой хостинг и вставь ссылку</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {iField("Эмодзи (запасной)", newTier.emoji, v => setNewTier(p => ({ ...p, emoji: v })), { placeholder: "🔮" })}
              {iField("Частицы (через запятую)", newTier.particles, v => setNewTier(p => ({ ...p, particles: v })), { placeholder: "✨,💫,🌟" })}
            </div>
            <button onClick={addCustomTier} style={{ width: "100%", padding: 14, background: "#a855f7", color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, cursor: "pointer", marginTop: 4 }}>✨ Добавить тир</button>
          </div>
          <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 12 }}>Кастомные тиры ({customTiers.length})</div>
            {customTiers.length === 0 ? (
              <div style={{ color: "#334155", fontWeight: 700, fontSize: 13, textAlign: "center", padding: 16 }}>Нет кастомных тиров</div>
            ) : customTiers.map(tier => (
              <div key={tier.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #0f172a" }}>
                <div style={{ padding: 6, flexShrink: 0 }}>
                  <Badge tier={tier.id} size={44} customTiers={customTiers} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9" }}>{tier.name}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{tier.modelUrl ? "🎲 3D-модель" : `${tier.emoji} Эмодзи`} • 💰 {tier.cost}</div>
                </div>
                <button onClick={() => setPreviewTier(tier)} style={{ padding: "4px 10px", background: "#0c1e3a", color: "#38bdf8", border: "1px solid #1e3a5f", borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: "pointer" }}>👁</button>
                <button onClick={() => deleteCustomTier(tier.id)} style={{ padding: "4px 10px", background: "#2d0a0a", color: "#f87171", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── БАЛАНС ─── */}
      {tab === "balance" && (
        <div>
          <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 20, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", marginBottom: 12 }}>💰 Монеты Sergei</div>
            <div style={{ color: "#475569", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Положительное — начислить, отрицательное — списать</div>
            <input type="number" value={manualCoins} onChange={e => setManualCoins(e.target.value)} placeholder="+50 или -30" style={{ width: "100%", padding: "12px 14px", background: "#07111f", border: "1px solid #1e3a5f", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none", marginBottom: 8 }} />
            <button onClick={addManual} style={{ width: "100%", padding: 14, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, cursor: "pointer" }}>Применить</button>
          </div>
          <div style={{ background: "linear-gradient(135deg,#1c0a00,#2d1500)", border: "1px solid #78350f", borderRadius: 20, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9" }}>🍫 Батончики</div>
              <button onClick={() => setSt(s => ({ ...s, currencyShop: { ...s.currencyShop, chocolate: { ...s.currencyShop.chocolate, enabled: !s.currencyShop.chocolate.enabled } } }))} style={{ padding: "6px 14px", background: currencyShop.chocolate.enabled ? "#059669" : "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                {currencyShop.chocolate.enabled ? "✅ Вкл" : "❌ Выкл"}
              </button>
            </div>
            {currencyShop.chocolate.enabled && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginBottom: 4 }}>Цена за 1 🍫 (в монетах)</div>
                <input type="number" defaultValue={currencyShop.chocolate.price} onBlur={e => { const v = parseInt(e.target.value); if (v > 0) setSt(s => ({ ...s, currencyShop: { ...s.currencyShop, chocolate: { ...s.currencyShop.chocolate, price: v } } })); }} style={{ width: "100%", padding: "10px 14px", background: "#07111f", border: "1px solid #78350f", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none" }} />
              </div>
            )}
            <div style={{ color: "#92400e", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Баланс: {st.sergei.chocolates || 0} 🍫</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" value={manualChocolates} onChange={e => setManualChocolates(e.target.value)} placeholder="+5 или -2" style={{ flex: 1, padding: "10px 14px", background: "#07111f", border: "1px solid #78350f", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none" }} />
              <button onClick={addManualChocolate} style={{ padding: "10px 16px", background: "#f59e0b", color: "#020617", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Изменить</button>
            </div>
          </div>
          <div style={{ background: "linear-gradient(135deg,#0a0a2e,#1a1060)", border: "1px solid #4c1d95", borderRadius: 20, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9" }}>⭐️ Звёзды</div>
              <button onClick={() => setSt(s => ({ ...s, currencyShop: { ...s.currencyShop, star: { ...s.currencyShop.star, enabled: !s.currencyShop.star.enabled } } }))} style={{ padding: "6px 14px", background: currencyShop.star.enabled ? "#059669" : "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                {currencyShop.star.enabled ? "✅ Вкл" : "❌ Выкл"}
              </button>
            </div>
            {currencyShop.star.enabled && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#c084fc", fontWeight: 700, marginBottom: 4 }}>Цена за 1 ⭐️ (в монетах)</div>
                <input type="number" defaultValue={currencyShop.star.price} onBlur={e => { const v = parseInt(e.target.value); if (v > 0) setSt(s => ({ ...s, currencyShop: { ...s.currencyShop, star: { ...s.currencyShop.star, price: v } } })); }} style={{ width: "100%", padding: "10px 14px", background: "#07111f", border: "1px solid #4c1d95", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none" }} />
              </div>
            )}
            <div style={{ color: "#7c3aed", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Баланс: {st.sergei.stars || 0} ⭐️</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" value={manualStars} onChange={e => setManualStars(e.target.value)} placeholder="+5 или -2" style={{ flex: 1, padding: "10px 14px", background: "#07111f", border: "1px solid #4c1d95", borderRadius: 12, color: "#f1f5f9", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none" }} />
              <button onClick={addManualStars} style={{ padding: "10px 16px", background: "#a855f7", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Изменить</button>
            </div>
          </div>
          <div style={{ background: "linear-gradient(135deg,#0f172a,#020617)", border: "1px solid #1e3a5f", borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", marginBottom: 12 }}>🎁 Купленные награды</div>
            {st.sergei.purchasedRewards.length === 0 ? (
              <div style={{ color: "#334155", fontWeight: 700, fontSize: 13 }}>Пока ничего не куплено</div>
            ) : st.sergei.purchasedRewards.slice().reverse().map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #0f172a" }}>
                <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{r.emoji} {r.title}</span>
                <span style={{ color: "#475569", fontSize: 11, fontWeight: 700 }}>{new Date(r.boughtAt).toLocaleDateString("ru-RU")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
