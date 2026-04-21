-- ══════════════════════════════════════════════════════════════
--  НОВАЯ СХЕМА — запусти это в Supabase SQL Editor
--  (старую таблицу sergei_quest_state можно оставить, она не мешает)
-- ══════════════════════════════════════════════════════════════

-- 1. Профиль игрока (монеты, звёзды, шоколад, бейдж, имя, пин)
create table if not exists sq_profile (
  id text primary key default 'sergei',
  name text not null default 'Sergei',
  pin text not null default '1234',
  admin_pin text not null default '0000',
  coins integer not null default 0,
  chocolates integer not null default 0,
  stars integer not null default 0,
  badge_tier integer not null default 0,
  purchased_tiers integer[] not null default array[0],
  total_earned integer not null default 0,
  currency_shop jsonb not null default '{"chocolate":{"enabled":false,"price":100},"star":{"enabled":false,"price":150}}',
  updated_at timestamptz not null default now()
);

-- 2. Задания (шаблоны, которые создаёт админ)
create table if not exists sq_tasks (
  id text primary key,
  title text not null,
  description text default '',
  reward integer not null default 10,
  emoji text default '⭐',
  category text default 'Дом',
  difficulty text default 'medium',
  created_at timestamptz not null default now()
);

-- 3. Награды (которые можно купить за монеты)
create table if not exists sq_rewards (
  id text primary key,
  title text not null,
  cost integer not null,
  emoji text default '🎁',
  category text default 'Отдых',
  one_time boolean default false,
  created_at timestamptz not null default now()
);

-- 4. Очередь на проверку (Сергей отправил — висит до решения админа)
create table if not exists sq_pending (
  id text primary key,
  task_id text not null references sq_tasks(id) on delete cascade,
  submitted_at timestamptz not null default now()
);

-- 5. Лог событий (заработал, потратил, отклонили и т.д.)
create table if not exists sq_log (
  id text primary key,
  type text not null,   -- 'earn' | 'spend' | 'reject' | 'submit' | 'cancel' | 'manual'
  text text not null,
  amount integer default 0,
  ts timestamptz not null default now()
);

-- 6. Кастомные тиры бейджей
create table if not exists sq_custom_tiers (
  id integer primary key,
  name text not null,
  cost integer not null,
  emoji text default '🔮',
  model_url text,
  particles text[] default array['✨','💫','🌟'],
  label text default 'Кастомный'
);

-- 7. Купленные награды (история покупок)
create table if not exists sq_purchased_rewards (
  id text primary key,
  reward_id text not null,
  title text not null,
  emoji text default '🎁',
  bought_at timestamptz not null default now()
);

-- 8. Выполненные задания (история)
create table if not exists sq_completed_tasks (
  id text primary key default gen_random_uuid()::text,
  task_id text not null,
  completed_at timestamptz not null default now()
);

-- Вставляем начальный профиль если его нет
insert into sq_profile (id) values ('sergei') on conflict do nothing;

-- Вставляем дефолтное задание если таблица пустая
insert into sq_tasks (id, title, description, reward, emoji, category, difficulty)
values ('t1', 'Сделать кровать', 'Заправь кровать аккуратно: подушки на месте, одеяло расправлено.', 10, '🛏️', 'Дом', 'easy')
on conflict do nothing;

-- Вставляем дефолтную награду если таблица пустая
insert into sq_rewards (id, title, cost, emoji, category, one_time)
values ('r1', 'Поход в ресторан', 200, '🥂', 'Свидание', false)
on conflict do nothing;

-- ══════════════════════════════════════════════════════════════
--  RLS (Row Level Security) — отключаем, т.к. используем anon key
--  с серверной логикой в самом приложении (пин-код)
-- ══════════════════════════════════════════════════════════════
alter table sq_profile          enable row level security;
alter table sq_tasks            enable row level security;
alter table sq_rewards          enable row level security;
alter table sq_pending          enable row level security;
alter table sq_log              enable row level security;
alter table sq_custom_tiers     enable row level security;
alter table sq_purchased_rewards enable row level security;
alter table sq_completed_tasks  enable row level security;

-- Разрешаем всё для anon (безопасность через пин-код в UI)
create policy "anon_all" on sq_profile          for all to anon using (true) with check (true);
create policy "anon_all" on sq_tasks            for all to anon using (true) with check (true);
create policy "anon_all" on sq_rewards          for all to anon using (true) with check (true);
create policy "anon_all" on sq_pending          for all to anon using (true) with check (true);
create policy "anon_all" on sq_log              for all to anon using (true) with check (true);
create policy "anon_all" on sq_custom_tiers     for all to anon using (true) with check (true);
create policy "anon_all" on sq_purchased_rewards for all to anon using (true) with check (true);
create policy "anon_all" on sq_completed_tasks  for all to anon using (true) with check (true);

-- ══════════════════════════════════════════════════════════════
--  MIGRATION v2 — запусти если уже применил v1
-- ══════════════════════════════════════════════════════════════
alter table sq_tasks add column if not exists deadline_at timestamptz default null;
alter table sq_log add column if not exists comment text default null;
alter table sq_profile add column if not exists failed_tasks jsonb not null default '[]';
alter table sq_profile add column if not exists claimed_tiers integer[] not null default array[0];

create table if not exists sq_notifications (
  id text primary key,
  title text not null,
  body text not null,
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
alter table sq_notifications enable row level security;
create policy "anon_all" on sq_notifications for all to anon using (true) with check (true);

-- ══════════════════════════════════════════════════════════════
--  MIGRATION v3 — РЕАКЦИИ ОТ СЕРГЕЯ + REALTIME
--  (запусти если уже применил v1 и v2)
-- ══════════════════════════════════════════════════════════════

-- Добавляем поле для реакции-эмодзи на записи в логе
alter table sq_log add column if not exists reaction text default null;

-- Включаем Realtime для всех таблиц (подписка на изменения)
-- Это заменяет polling каждые 8 секунд — мгновенные обновления через WebSocket
alter publication supabase_realtime add table sq_profile;
alter publication supabase_realtime add table sq_tasks;
alter publication supabase_realtime add table sq_rewards;
alter publication supabase_realtime add table sq_pending;
alter publication supabase_realtime add table sq_log;
alter publication supabase_realtime add table sq_custom_tiers;
alter publication supabase_realtime add table sq_purchased_rewards;
alter publication supabase_realtime add table sq_completed_tasks;
alter publication supabase_realtime add table sq_notifications;

-- ══════════════════════════════════════════════════════════════
--  MIGRATION v4 — TELEGRAM ПОДПИСЧИКИ
--  Таблица для хранения chat_id всех, кто написал боту /start.
-- ══════════════════════════════════════════════════════════════

create table if not exists sq_telegram_subscribers (
  chat_id bigint primary key,
  username text,
  first_name text,
  subscribed_at timestamptz not null default now()
);

alter table sq_telegram_subscribers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sq_telegram_subscribers'
      and policyname = 'anon_all'
  ) then
    create policy "anon_all" on sq_telegram_subscribers for all to anon using (true) with check (true);
  end if;
end $$;

-- Добавляем в realtime (на случай если захочется видеть подписчиков в реальном времени)
do $$
begin
  begin
    alter publication supabase_realtime add table sq_telegram_subscribers;
  exception
    when duplicate_object then null;
  end;
end $$;

-- ══════════════════════════════════════════════════════════════
--  MIGRATION v5 — TELEGRAM MUTE (глобальный тумблер из админки)
--  Храним флаг в профиле, чтобы мьют синкался между устройствами.
--  Без этой колонки PATCH из setTelegramMuted молча фейлится
--  (400 unknown column) — тумблер «не залипает».
-- ══════════════════════════════════════════════════════════════
alter table sq_profile add column if not exists telegram_muted boolean not null default false;

-- ══════════════════════════════════════════════════════════════
--  MIGRATION v6 — COST / CATEGORY для купленных наград
--  Эти поля писались локально в st.sergei.purchasedRewards,
--  но в БД колонок не было. После первого же initialPull'а
--  клиент терял cost/category, UI рисовал «💰 undefined» и
--  сваливал всю историю покупок в категорию «Другое».
-- ══════════════════════════════════════════════════════════════
alter table sq_purchased_rewards add column if not exists cost integer;
alter table sq_purchased_rewards add column if not exists category text;
