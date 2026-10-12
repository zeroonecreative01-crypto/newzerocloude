-- Minimal isolated development baseline for ZERO ONE AI Business Partner.
-- This is intentionally NOT the production CRM schema and contains no customer data.
-- It creates only the compatibility surface required by the AI MVP.

create type public.app_role as enum ('admin', 'editor', 'sales', 'viewer');
create type public.lead_source as enum ('website', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'referral', 'other');
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'viewer',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  whatsapp text,
  message text,
  service_interest text,
  budget text,
  market text,
  source public.lead_source not null default 'website',
  status public.lead_status not null default 'new',
  notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_email_lower_idx on public.leads (lower(email)) where email is not null;
create index leads_company_lower_idx on public.leads (lower(company)) where company is not null;

alter table public.profiles enable row level security;
alter table public.leads enable row level security;

-- This helper checks only the current user's own staff profile.
-- No signup trigger is created; new users are NOT automatically promoted.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin'::public.app_role, 'editor'::public.app_role, 'sales'::public.app_role)
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

create policy "users read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "active staff manage dev leads"
  on public.leads for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.leads to authenticated;

comment on table public.profiles is 'Synthetic development-only staff profiles. Provision role changes through a trusted admin route.';
comment on table public.leads is 'Synthetic development-only CRM leads; never copy production customer data into this project.';
