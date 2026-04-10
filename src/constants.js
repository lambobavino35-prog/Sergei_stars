// ═══════════════════════════════════════════════
//  BADGE TIER SYSTEM
// ═══════════════════════════════════════════════
export const BADGE_TIERS = [
  { id: 0, name: "Новобранец", cost: 0,    emoji: "⚔️",  border: "2px solid #374151", bg: "linear-gradient(135deg,#1f2937,#111827)", glow: "none",               label: "Базовый",     particles: ["⚔️"],                          style: { fontSize: 40, filter: "none" } },
  { id: 1, name: "Воин",       cost: 50,   emoji: "🛡️",  border: "2px solid #2563eb", bg: "linear-gradient(135deg,#1e3a8a,#1e40af)", glow: "0 0 20px #3b82f655", label: "Синий",       particles: ["🛡️","⚡","🛡️"],                style: { fontSize: 44, filter: "drop-shadow(0 0 8px #3b82f6)" } },
  { id: 2, name: "Рыцарь",     cost: 150,  emoji: "🏆",  border: "2px solid #7c3aed", bg: "linear-gradient(135deg,#4c1d95,#5b21b6)", glow: "0 0 24px #8b5cf655", label: "Фиолетовый",  particles: ["🏆","✨","💫","🏆"],             style: { fontSize: 48, filter: "drop-shadow(0 0 12px #8b5cf6)" } },
  { id: 3, name: "Легенда",    cost: 350,  emoji: "💎",  border: "2px solid #0ea5e9", bg: "linear-gradient(135deg,#0c4a6e,#075985)", glow: "0 0 30px #38bdf855", label: "Алмазный",    particles: ["💎","🌟","💠","✨","💎"],        style: { fontSize: 52, filter: "drop-shadow(0 0 16px #38bdf8)" } },
  { id: 4, name: "Король",     cost: 700,  emoji: "👑",  border: "2px solid #f59e0b", bg: "linear-gradient(135deg,#78350f,#92400e)", glow: "0 0 40px #fbbf2477", label: "Золотой",     particles: ["👑","🔥","⚡","💥","👑","🌟"], style: { fontSize: 56, filter: "drop-shadow(0 0 20px #f59e0b)" } },
  { id: 5, name: "Бог",        cost: 1500, emoji: "🌌",  border: "2px solid #ec4899", bg: "radial-gradient(circle,#4c0519,#1c1917,#0c0a09)", glow: "0 0 60px #ec489988", label: "Космический", particles: ["🌌","⭐","🌠","💫","🌟","✨","🌌"], style: { fontSize: 60, filter: "drop-shadow(0 0 24px #ec4899) drop-shadow(0 0 48px #a855f7)" } },
];

// ═══════════════════════════════════════════════
//  DEFAULT DATA
// ═══════════════════════════════════════════════
export const DEFAULT_REWARDS = [
  { id: "r1", title: "Поход в ресторан", cost: 200, emoji: "🥂", category: "Свидание", oneTime: false, createdAt: Date.now() },
];

export const DEFAULT_TASKS = [
  { id: "t1", title: "Сделать кровать", description: "Заправь кровать аккуратно: подушки на месте, одеяло расправлено.", reward: 10, emoji: "🛏️", category: "Дом", repeatable: true, difficulty: "easy" },
];

export const INITIAL_STATE = {
  sergei: {
    name: "Sergei",
    pin: "1234",
    coins: 0,
    chocolates: 0,
    stars: 0,
    badgeTier: 0,
    completedTasks: [],
    purchasedRewards: [],
    purchasedTiers: [0],
    log: [],
    lastActive: null,
    totalEarned: 0,
  },
  admin: { pin: "0000" },
  tasks: DEFAULT_TASKS,
  rewards: DEFAULT_REWARDS,
  pendingTasks: [],
  customTiers: [],
  currencyShop: {
    chocolate: { enabled: false, price: 100 },
    star: { enabled: false, price: 150 },
  },
};

export const SAVE_KEY = "sergei_quest_v4";

export const NAV_ITEMS = [
  { id: "profile", emoji: "👤", label: "Профиль" },
  { id: "tasks",   emoji: "📋", label: "Задания" },
  { id: "log",     emoji: "📜", label: "История" },
  { id: "rewards", emoji: "🎁", label: "Награды" },
];

export const SYNC_ICONS = { online: "🟢", syncing: "🟡", error: "🔴" };

// ═══════════════════════════════════════════════
//  SUPABASE CONFIG — замени своими значениями!
// ═══════════════════════════════════════════════
export const SUPABASE_URL = "https://hfwjzcdiftywljshmtgo.supabase.co";
export const SUPABASE_KEY = "sb_publishable_bsb0R3iK_GjLr_3NbT8ypg_oJ26Fml4";
export const SUPABASE_ENABLED = SUPABASE_URL !== "https://YOUR_PROJECT.supabase.co";
