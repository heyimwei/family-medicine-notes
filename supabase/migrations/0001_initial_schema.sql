-- Application-owned authorization and medication-record schema.
-- Apply only through the Supabase migration workflow; never use the service key in a browser.

create type public.app_role as enum ('ADMIN', 'USER');
create type public.prescription_status as enum ('DRAFT', 'CONFIRMED', 'DELETED');
create type public.verification_status as enum ('NEEDS_REVIEW', 'MATCHED', 'CONFIRMED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'USER',
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  is_active boolean not null default true,
  password_change_hint_dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  visit_date date,
  reason text,
  department text,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.drug_references (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('TFDA')),
  source_identifier text not null,
  name_zh text,
  name_en text,
  ingredients text,
  indications text,
  dosage_form text,
  source_url text not null,
  source_updated_at timestamptz,
  imported_at timestamptz not null default now(),
  unique (source, source_identifier)
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id),
  status public.prescription_status not null default 'DRAFT',
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id),
  drug_reference_id uuid references public.drug_references(id),
  entered_name text not null,
  dose_text text,
  frequency_text text,
  duration_days integer check (duration_days is null or duration_days > 0),
  notes text,
  verification_status public.verification_status not null default 'NEEDS_REVIEW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.uploaded_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  encounter_id uuid references public.encounters(id),
  storage_path text not null unique,
  sha256 text not null check (sha256 ~ '^[A-Fa-f0-9]{64}$'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_summary jsonb,
  after_summary jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.encounters enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.uploaded_images enable row level security;
alter table public.audit_logs enable row level security;

create function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN' and is_active) $$;

create policy "users read their own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "users update own profile preference" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "owners or admins manage encounters" on public.encounters for all using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "owners or admins manage prescriptions" on public.prescriptions for all using (public.is_admin() or exists (select 1 from public.encounters e where e.id = encounter_id and e.owner_id = auth.uid())) with check (public.is_admin() or exists (select 1 from public.encounters e where e.id = encounter_id and e.owner_id = auth.uid()));
create policy "owners or admins manage prescription items" on public.prescription_items for all using (public.is_admin() or exists (select 1 from public.prescriptions p join public.encounters e on e.id = p.encounter_id where p.id = prescription_id and e.owner_id = auth.uid())) with check (public.is_admin() or exists (select 1 from public.prescriptions p join public.encounters e on e.id = p.encounter_id where p.id = prescription_id and e.owner_id = auth.uid()));
create policy "owners or admins read image metadata" on public.uploaded_images for select using (owner_id = auth.uid() or public.is_admin());
create policy "owners or admins create image metadata" on public.uploaded_images for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "admins read audit logs" on public.audit_logs for select using (public.is_admin());

-- No client policy is created for the private medication-images bucket. Server routes create signed URLs only after authorization.