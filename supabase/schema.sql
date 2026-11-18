-- BizAssist AI — Supabase PostgreSQL Schema
-- Run this SQL in your Supabase project's SQL Editor to initialize tables & policies.

create extension if not exists "pgcrypto";

-- 1. Staff Members
create table if not exists public.staff_members (
  id text primary key,
  name text not null,
  initials text not null,
  role_title text not null,
  email text not null unique,
  avatar_url text,
  online boolean default true,
  active_capacity integer default 8,
  resolution_rate integer default 92,
  csat_score numeric(3,2) default 4.90,
  fcr_rate integer default 88,
  rank_position integer default 1,
  created_at timestamptz default now()
);

-- 2. Tickets
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  subject text not null,
  description text not null,
  reference_id text,
  customer_name text not null,
  customer_email text not null,
  company text not null,
  customer_tier text not null default 'Enterprise Tier ($4,000/mo)',
  category text not null default 'General Inquiry',
  priority text not null default 'Medium',
  status text not null default 'Open',
  assignee_id text references public.staff_members(id) on delete set null,
  ai_summary jsonb not null default '[]'::jsonb,
  ai_confidence numeric(5,2) default 98.0,
  sentiment_label text default 'Neutral',
  sentiment_score numeric(4,2) default 0.0,
  detected_intent text default 'Support Request',
  sla_minutes_remaining integer default 120,
  tracker_step integer default 2,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Ticket Messages & Thread Events
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_name text not null,
  sender_role text not null, -- 'customer' | 'support' | 'system'
  sender_avatar text,
  is_internal boolean default false,
  is_system_event boolean default false,
  body text not null,
  payload_snippet text,
  created_at timestamptz default now()
);

-- 4. Knowledge Base Articles
create table if not exists public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  doc_code text not null unique,
  title text not null,
  category text not null,
  priority_tag text not null,
  summary text not null,
  content text not null,
  updated_label text not null default 'Updated recently',
  created_at timestamptz default now()
);

-- 5. Frequently Asked Questions
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  confidence numeric(5,2) default 98.5,
  verified_by text default 'FinOps Integration Ops',
  runbook_ref text,
  created_at timestamptz default now()
);

-- 6. Audit Logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_number text,
  actor text not null,
  action text not null,
  details text not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_priority on public.tickets(priority);
create index if not exists idx_tickets_assignee on public.tickets(assignee_id);
create index if not exists idx_ticket_messages_ticket_id on public.ticket_messages(ticket_id);

-- Row Level Security (Server uses service_role key; anon policies allow read/write for demo when needed)
alter table public.staff_members enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.kb_articles enable row level security;
alter table public.faqs enable row level security;
alter table public.audit_logs enable row level security;

create policy "Allow server access staff" on public.staff_members for all using (true) with check (true);
create policy "Allow server access tickets" on public.tickets for all using (true) with check (true);
create policy "Allow server access messages" on public.ticket_messages for all using (true) with check (true);
create policy "Allow server access kb" on public.kb_articles for all using (true) with check (true);
create policy "Allow server access faqs" on public.faqs for all using (true) with check (true);
create policy "Allow server access audit" on public.audit_logs for all using (true) with check (true);
