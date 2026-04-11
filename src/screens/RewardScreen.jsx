import { useState } from "react";
import { BADGE_TIERS } from "../constants";
import Badge from "../components/Badge";

export default function RewardScreen({ st, setSt, fireBurst, showToast }) {
  const [tab, setTab] = useState("shop");
  const [previewTier, setPreviewTier] = useState(null);
  const coins = st.sergei.coins;
  const purchasedTiers = st.sergei.purchasedTiers || [0];
  const purchasedRewards = st.sergei.purchasedRewards || [];
  const customTiers = st.customTiers || [];
  const currencyShop = st.currencyShop || { chocolate: { enabled: false, price: 100 }, star: { enabled: false, price: 150 } };

  const buyReward = (reward, e) => {
    if (coins < reward.cost) return showToast("Недостаточно монет 😔", "err");
    if (reward.oneTime && purchasedRewards.some(p => p.id === reward.id)) {
      return showToast("Эта награда уже куплена 🔒", "info");
    }
    setSt(s => ({
      ...s,
      sergei: {
        ...s.sergei,
        coins: s.sergei.coins - reward.cost,
        purchasedRewards: [...s.sergei.purchasedRewards, { ...reward, boughtAt: Date.now() }],
        log: [{ id: crypto.randomUUID(), type: "buy", text: `🎁 Куплена награда «${reward.title}»`, amount: -reward.cost, ts: Date.now() }, ...s.sergei.log].slice(0, 100),
      }
    }));
    const rect = e.currentTarget.getBoundingClientRect();
    fireBurst(["🎉","✨","🎁","💫","⭐"], rect.left + rect.width / 2, rect.top);
    showToast(`🎁 «${reward.title}» получена!`, "ok");
  };

  const buyChocolate = (e) => {
    const price = currencyShop.chocolate.price;
    if (coins < price) return showToast(`Нужно ещё ${price - coins} монет 💰`, "err");
    setSt(s => ({
      ...s,
      sergei: {
        ...s.sergei,
        coins: s.sergei.coins - price,
        chocolates: (s.sergei.chocolates || 0) + 1,
        log: [{ id: crypto.randomUUID(), type: "buy", text: `🍫 Куплен батончик`, amount: -price, ts: Date.now() }, ...s.sergei.log].slice(0, 100),
      }
    }));
    const rect = e.currentTarget.getBoundingClientRect();
    fireBurst(["🍫","✨","🎉"], rect.left + rect.width / 2, rect.top);
    showToast("🍫 Батончик получен!", "ok");
  };

  const buyStar = (e) => {
    const price = currencyShop.star.price;
    if (coins < price) return showToast(`Нужно ещё ${price - coins} монет 💰`, "err");
    setSt(s => ({
      ...s,
      sergei: {
        ...s.sergei,
        coins: s.sergei.coins - price,
        stars: (s.sergei.stars || 0) + 1,
        log: [{ id: crypto.randomUUID(), type: "buy", text: `⭐️ Куплена звезда`, amount: -price, ts: Date.now() }, ...s.sergei.log].slice(0, 100),
      }
    }));
    const rect = e.currentTarget.getBoundingClientRect();
    fireBurst(["⭐","🌟","✨","💫"], rect.left + rect.width / 2, rect.top);
    showToast("⭐️ Звезда получена!", "ok");
  };

  const buyTier = (tier, isCustom, e) => {
    if (purchasedTiers.includes(tier.id)) return showToast("Уже куплено!", "info");
    if (!isCustom) {
      const prevId = tier.id - 1;
      if (!purchasedTiers.includes(prevId)) return showToast("Сначала купи предыдущий тир", "err");
    }
    if (coins < tier.cost) return showToast(`Нужно ещё ${tier.cost - coins} монет 💰`, "err");
    setSt(s => ({
      ...s,
      sergei: {
        ...s.sergei,
        coins: s.sergei.coins - tier.cost,
        badgeTier: tier.id,
        purchasedTiers: [...(s.sergei.purchasedTiers || [0]), tier.id],
        log: [{ id: crypto.randomUUID(), type: "tier", text: `🏆 Куплен тир «${tier.name}»`, amount: -tier.cost, ts: Date.now() }, ...s.sergei.log].slice(0, 100),
      }
    }));
    const rect = e.currentTarget.getBoundingClientRect();
    fireBurst(tier.particles || ["✨","💫","🌟"], rect.left + rect.width / 2, rect.top);
    showToast(`🔥 Новый тир «${tier.name}»!`, "ok");
  };

  const groupedRewards = purchasedRewards.reduce((acc, r) => {
    const cat = r.category || "Другое";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  return (
    <div style={{ padding: "20px 16px", paddingBottom: 100 }}>

      {/* ─── 3D PREVIEW MODAL ─── */}
      {previewTier && (
        <div
          onClick={() => setPreviewTier(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.88)",
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
                width: 160, height: 160, borderRadius: "50%",
                background: previewTier.bg || "linear-gradient(135deg,#1a0a2e,#2d1060)",
                border: previewTier.border || "2px solid #a855f7",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 72,
                boxShadow: previewTier.glow || "0 0 40px #a855f755",
              }}>
                {previewTier.emoji}
              </div>
            )}

            <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, textAlign: "center" }}>
              {previewTier.modelUrl
                ? "Потяни для вращения 🔄"
                : "Эмодзи-тир без 3D-модели"}
            </div>

            {previewTier.particles && (
              <div style={{ fontSize: 18 }}>{previewTier.particles.join(" ")}</div>
            )}

            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button
                onClick={() => setPreviewTier(null)}
                style={{ flex: 1, padding: "12px 0", background: "#1e3a5f", color: "#94a3b8", border: "none", borderRadius: 14, fontWeight: 800, cursor: "pointer" }}
              >
                Закрыть
              </button>
              {!purchasedTiers.includes(previewTier.id) && (
                <button
                  onClick={e => { setPreviewTier(null); buyTier(previewTier, true, e); }}
                  style={{ flex: 1, padding: "12px 0", background: "#a855f7", color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, cursor: "pointer" }}
                >
                  💰 {previewTier.cost}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Baloo 2',sans-serif", fontSize: 22, fontWeight: 900, color: "#f1f5f9" }}>🎁 Награды</div>
        <div style={{ background: "#1c1407", border: "1px solid #78350f", borderRadius: 12, padding: "6px 12px", fontWeight: 900, color: "#fbbf24", fontSize: 14 }}>💰 {coins}</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {[["shop","🛒 Магазин"],["mine","🏅 Мои награды"],["tiers","🔮 Тиры значка"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flexShrink: 0, flex: 1, padding: "10px 0", border: tab === id ? "none" : "1px solid #1e3a5f", borderRadius: 12, background: tab === id ? "#fbbf24" : "#0f172a", color: tab === id ? "#020617" : "#475569", fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      {/* ─── МАГАЗИН ─── */}
      {tab === "shop" && (
        <>
          {(currencyShop.chocolate.enabled || currencyShop.star.enabled) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 10, letterSpacing: ".05em" }}>💱 Валюты</div>
              {currencyShop.chocolate.enabled && (
                <div style={{ background: "linear-gradient(135deg,#1c0a00,#2d1500)", border: "1px solid #78350f", borderRadius: 20, padding: 16, marginBottom: 10, animation: "fadeUp .3s ease both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 36 }}>🍫</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>Батончик</div>
                      <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700 }}>У тебя: {st.sergei.chocolates || 0} 🍫</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 16 }}>💰 {currencyShop.chocolate.price}</span>
                      <button onClick={buyChocolate} style={{ padding: "7px 14px", background: coins >= currencyShop.chocolate.price ? "#f59e0b" : "#1e2a4a", color: coins >= currencyShop.chocolate.price ? "#020617" : "#334155", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Купить</button>
                    </div>
                  </div>
                </div>
              )}
              {currencyShop.star.enabled && (
                <div style={{ background: "linear-gradient(135deg,#0a0a2e,#1a1060)", border: "1px solid #4c1d95", borderRadius: 20, padding: 16, marginBottom: 10, animation: "fadeUp .3s ease both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 36 }}>⭐️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>Звезда</div>
                      <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>У тебя: {st.sergei.stars || 0} ⭐️</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 16 }}>💰 {currencyShop.star.price}</span>
                      <button onClick={buyStar} style={{ padding: "7px 14px", background: coins >= currencyShop.star.price ? "#a855f7" : "#1e2a4a", color: coins >= currencyShop.star.price ? "#fff" : "#334155", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Купить</button>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: "#1e3a5f33" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>Обычные награды</span>
                <div style={{ flex: 1, height: 1, background: "#1e3a5f33" }} />
              </div>
            </div>
          )}
          {st.rewards.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#334155" }}><div style={{ fontSize: 40, marginBottom: 8 }}>📭</div><div style={{ fontWeight: 700 }}>Нет наград</div></div>
          )}
          {st.rewards.map(r => {
            const alreadyBought = r.oneTime && purchasedRewards.some(p => p.id === r.id);
            return (
              <div key={r.id} style={{ background: alreadyBought ? "linear-gradient(135deg,#0a0a0a,#111)" : "linear-gradient(135deg,#0f172a,#020617)", border: alreadyBought ? "1px solid #1e3a5f33" : "1px solid #1e3a5f", borderRadius: 20, padding: 16, marginBottom: 10, animation: "fadeUp .3s ease both", opacity: alreadyBought ? 0.6 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 32 }}>{r.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>
                      {r.category}
                      {r.oneTime && <span style={{ marginLeft: 6, color: "#f59e0b" }}>• 1×</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 16 }}>💰 {r.cost}</span>
                    {alreadyBought ? (
                      <span style={{ color: "#4ade80", fontWeight: 800, fontSize: 12 }}>✅ Куплено</span>
                    ) : (
                      <button onClick={e => buyReward(r, e)} style={{ padding: "7px 14px", background: coins >= r.cost ? "#fbbf24" : "#1e2a4a", color: coins >= r.cost ? "#020617" : "#334155", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Купить</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ─── МОИ НАГРАДЫ ─── */}
      {tab === "mine" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ background: "linear-gradient(135deg,#1c0a00,#2d1500)", border: "1px solid #78350f", borderRadius: 16, padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 4 }}>🍫</div>
              <div style={{ fontFamily: "'Baloo 2',sans-serif", fontWeight: 900, fontSize: 24, color: "#f59e0b" }}>{st.sergei.chocolates || 0}</div>
              <div style={{ fontSize: 11, color: "#92400e", fontWeight: 800, textTransform: "uppercase" }}>Батончики</div>
            </div>
            <div style={{ background: "linear-gradient(135deg,#0a0a2e,#1a1060)", border: "1px solid #4c1d95", borderRadius: 16, padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 4 }}>⭐️</div>
              <div style={{ fontFamily: "'Baloo 2',sans-serif", fontWeight: 900, fontSize: 24, color: "#c084fc" }}>{st.sergei.stars || 0}</div>
              <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 800, textTransform: "uppercase" }}>Звёзды</div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 12 }}>
            🎁 Купленные награды ({purchasedRewards.length})
          </div>
          {purchasedRewards.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#334155" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎀</div>
              <div style={{ fontWeight: 700 }}>Пока ничего не куплено</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Покупай в Магазине!</div>
            </div>
          ) : (
            Object.entries(groupedRewards).map(([cat, rewards]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{cat}</div>
                {rewards.slice().reverse().map((r, i) => (
                  <div key={i} style={{ background: "linear-gradient(135deg,#031a10,#042a18)", border: "1px solid #134e2a", borderRadius: 16, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, animation: "fadeUp .3s ease both" }}>
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{r.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 14 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: "#166534", fontWeight: 700, marginTop: 2 }}>
                        {new Date(r.boughtAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long" })}
                      </div>
                    </div>
                    <div style={{ background: "#052e16", border: "1px solid #134e2a", borderRadius: 10, padding: "4px 10px", color: "#fbbf24", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
                      💰 {r.cost}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </>
      )}

      {/* ─── ТИРЫ ЗНАЧКА ─── */}
      {tab === "tiers" && (
        <>
          <div style={{ color: "#475569", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            Покупай тиры последовательно. Кастомные тиры доступны в любое время!
          </div>

          {BADGE_TIERS.slice(1).map(tier => {
            const owned    = purchasedTiers.includes(tier.id);
            const locked   = !owned && !purchasedTiers.includes(tier.id - 1);
            const needMore = !owned && purchasedTiers.includes(tier.id - 1) && coins < tier.cost;
            const canBuy   = !owned && purchasedTiers.includes(tier.id - 1) && coins >= tier.cost;
            return (
              <div key={tier.id} style={{ background: owned ? "linear-gradient(135deg,#031a10,#042a18)" : "linear-gradient(135deg,#0f172a,#020617)", border: owned ? "1px solid #134e2a" : "1px solid #1e3a5f", borderRadius: 20, padding: 16, marginBottom: 10, opacity: locked ? 0.5 : 1, animation: "fadeUp .3s ease both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Badge tier={tier.id} size={60} customTiers={customTiers} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: "#f1f5f9" }}>{tier.name}</div>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, marginBottom: 4 }}>{tier.label}</div>
                    <div style={{ fontSize: 11, color: "#334155", fontWeight: 700 }}>Взрыв: {tier.particles.join(" ")}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    {owned ? (
                      <span style={{ color: "#4ade80", fontWeight: 800, fontSize: 13 }}>✅ Куплено</span>
                    ) : locked ? (
                      <><span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 15 }}>💰 {tier.cost}</span><span style={{ color: "#475569", fontWeight: 800, fontSize: 12 }}>🔒 Заперто</span></>
                    ) : needMore ? (
                      <><span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 15 }}>💰 {tier.cost}</span><span style={{ color: "#f87171", fontWeight: 800, fontSize: 11 }}>Нужно ещё {tier.cost - coins} 💰</span></>
                    ) : (
                      <><span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 15 }}>💰 {tier.cost}</span><button onClick={e => buyTier(tier, false, e)} style={{ padding: "7px 14px", background: "#fbbf24", color: "#020617", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Купить</button></>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {customTiers.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: "#7c3aed33" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: ".05em" }}>✨ Кастомные тиры</span>
                <div style={{ flex: 1, height: 1, background: "#7c3aed33" }} />
              </div>
              {customTiers.map(tier => {
                const owned = purchasedTiers.includes(tier.id);
                const needMore = !owned && coins < tier.cost;
                return (
                  <div key={tier.id} style={{ background: owned ? "linear-gradient(135deg,#1c0a2e,#0a0520)" : "linear-gradient(135deg,#0f172a,#020617)", border: owned ? "1px solid #7c3aed" : "1px solid #4c1d9555", borderRadius: 20, padding: 16, marginBottom: 10, animation: "fadeUp .3s ease both" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <Badge tier={tier.id} size={60} customTiers={customTiers} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: 16, color: "#f1f5f9" }}>{tier.name}</div>
                        <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700, marginBottom: 2 }}>3D-тир</div>
                        {tier.modelUrl && <div style={{ fontSize: 10, color: "#334155", fontWeight: 700 }}>🎲 3D-модель загружена</div>}
                        <button
                          onClick={() => setPreviewTier(tier)}
                          style={{ marginTop: 6, padding: "4px 12px", background: "#1e3a5f", color: "#38bdf8", border: "1px solid #1e3a5f", borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: "pointer" }}
                        >
                          👁 Превью
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        {owned ? (
                          <>
                            <span style={{ color: "#4ade80", fontWeight: 800, fontSize: 13 }}>✅ Куплено</span>
                            {st.sergei.badgeTier !== tier.id && (
                              <button onClick={() => setSt(s => ({ ...s, sergei: { ...s.sergei, badgeTier: tier.id } }))} style={{ padding: "5px 12px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 11, cursor: "pointer" }}>Надеть</button>
                            )}
                          </>
                        ) : needMore ? (
                          <><span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 15 }}>💰 {tier.cost}</span><span style={{ color: "#f87171", fontWeight: 800, fontSize: 11 }}>Нужно ещё {tier.cost - coins} 💰</span></>
                        ) : (
                          <><span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 15 }}>💰 {tier.cost}</span><button onClick={e => buyTier(tier, true, e)} style={{ padding: "7px 14px", background: "#a855f7", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Купить</button></>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
