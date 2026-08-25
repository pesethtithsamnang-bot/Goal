-- ============================================================
-- SKETING — full schema (base tables + new features)
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- Run this in Supabase SQL editor.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- GOALS ----------
create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  type text not null check (type in ('short','long')),
  start_date date,
  deadline date,
  progress int not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  -- NEW --
  notes text,
  parent_goal_id uuid references goals(id) on delete set null,   -- short-term goal linked to a long-term goal
  target_amount numeric(12,2)                                    -- optional $ target for a long-term SAVINGS goal
);
alter table goals add column if not exists notes text;
alter table goals add column if not exists parent_goal_id uuid references goals(id) on delete set null;
alter table goals add column if not exists target_amount numeric(12,2);

-- ---------- GOAL DOCUMENTS (attachments/proof) ----------
create table if not exists goal_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  goal_id uuid references goals(id) on delete cascade not null,
  file_path text not null,
  file_name text not null,
  file_type text,
  created_at timestamptz not null default now()
);

-- ---------- TODOS ----------
create table if not exists todos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  -- NEW --
  notes text,
  due_time time                                                 -- optional time-of-day for a todo
);
alter table todos add column if not exists notes text;
alter table todos add column if not exists due_time time;

-- ---------- SCHEDULES ----------
-- Was recurrence-based (weekly/monthly/yearly). Now a free start->end date range
-- with optional start/end time, so any item — a single day or a multi-year plan —
-- can be represented and fully edited later.
create table if not exists schedules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  recurrence text not null default 'custom' check (recurrence in ('weekly','monthly','yearly','custom')),
  day_of_week int,
  day_of_week_end int,
  day_of_month int,
  month int,
  time_of_day time,
  notes text,
  created_at timestamptz not null default now(),
  -- NEW --
  start_date date,                                              -- when it begins (day/week/month/year — any span)
  end_date date,                                                -- deadline / when it ends (optional -> single day)
  start_time time,                                              -- what time it starts (optional)
  end_time time,                                                -- what time it ends (optional)
  app_name text                                                 -- which app/platform/place this happens on (optional)
);
alter table schedules alter column recurrence set default 'custom';
alter table schedules drop constraint if exists schedules_recurrence_check;
alter table schedules add constraint schedules_recurrence_check check (recurrence in ('weekly','monthly','yearly','custom'));
alter table schedules add column if not exists start_date date;
alter table schedules add column if not exists end_date date;
alter table schedules add column if not exists start_time time;
alter table schedules add column if not exists end_time time;
alter table schedules add column if not exists app_name text;

-- ---------- WORK SESSIONS ----------
create table if not exists work_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  job_name text not null,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  -- NEW --
  notes text
);
alter table work_sessions add column if not exists notes text;

-- ---------- FINANCE ENTRIES ----------
create table if not exists finance_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null,
  category text not null,
  entry_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  -- NEW --
  goal_id uuid references goals(id) on delete set null,   -- link this entry to a savings goal
  active_from date,                                        -- entry doesn't count until this date arrives
  recurring boolean not null default false,                -- if true, repeats every month from active_from onward
  -- NEW (accounts) --
  account text not null default 'Bank',                    -- which account this entry affects
  to_account text,                                          -- destination account, only used when type = 'transfer'
  entry_time time                                           -- optional time-of-day, combined with entry_date
);
alter table finance_entries add column if not exists goal_id uuid references goals(id) on delete set null;
alter table finance_entries add column if not exists active_from date;
alter table finance_entries add column if not exists recurring boolean not null default false;
alter table finance_entries add column if not exists account text not null default 'Bank';
alter table finance_entries add column if not exists to_account text;
alter table finance_entries add column if not exists entry_time time;
-- 'transfer' = moving money between your own accounts (e.g. Bank -> Savings).
-- It does NOT count as income or expense, it just moves the balance.
alter table finance_entries drop constraint if exists finance_entries_type_check;
alter table finance_entries add constraint finance_entries_type_check check (type in ('income','expense','transfer'));

-- ---------- FINANCE ACCOUNTS (Bank / Savings / Education / custom) ----------
create table if not exists finance_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  is_default boolean not null default false,   -- true for the seeded Bank/Savings/Education accounts
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

-- ---------- FINANCE CATEGORIES (managed from Settings) ----------
create table if not exists finance_categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('income','expense')),
  created_at timestamptz not null default now(),
  unique(user_id, name, type)
);

-- ---------- Row Level Security ----------
alter table goals enable row level security;
alter table goal_documents enable row level security;
alter table todos enable row level security;
alter table schedules enable row level security;
alter table work_sessions enable row level security;
alter table finance_entries enable row level security;
alter table finance_accounts enable row level security;
alter table finance_categories enable row level security;

do $$
declare t text;
begin
  foreach t in array array['goals','goal_documents','todos','schedules','work_sessions','finance_entries','finance_accounts','finance_categories'] loop
    execute format('drop policy if exists "owner_all" on %I;', t);
    execute format('create policy "owner_all" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;

-- Storage bucket for goal proof attachments (create once in Supabase dashboard if this fails)
insert into storage.buckets (id, name, public) values ('goal-proofs','goal-proofs', false)
  on conflict (id) do nothing;
