-- ==========================================================
-- Baseline Phase-0 schema for Skin Fix (no seed data)
-- ==========================================================

-- Schema + extensions
create schema if not exists app;
create extension if not exists pgcrypto;

-- ---------- Roles map ----------
create table if not exists app.user_roles (
  user_uid uuid not null,
  role text not null check (role in ('admin','staff','marketing')),
  granted_at timestamptz not null default now(),
  primary key (user_uid, role)
);

create or replace function app.has_role(roles text[])
returns boolean language sql stable as $$
  select exists (
    select 1
    from app.user_roles ur
    where ur.user_uid = auth.uid()
      and ur.role = any(roles)
  );
$$;

-- ---------- Core data ----------
create table if not exists app.contacts (
  cust_id uuid primary key default gen_random_uuid(),
  initials text not null check (initials ~* '^[A-Z]{1,4}$'),
  phone text,
  email text,
  consent_email boolean not null default false,
  consent_sms   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_contacts_created_at on app.contacts(created_at desc);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'consent_channel') then
    create type app.consent_channel as enum ('email','sms');
  end if;
  if not exists (select 1 from pg_type where typname = 'consent_status') then
    create type app.consent_status as enum ('opt_in','opt_out');
  end if;
end $$;

create table if not exists app.consent_events (
  id bigserial primary key,
  cust_id uuid not null references app.contacts(cust_id) on delete cascade,
  channel app.consent_channel not null,
  status  app.consent_status  not null,
  source text not null,
  actor_uid uuid,
  occurred_at timestamptz not null default now(),
  note text
);
create index if not exists idx_consent_events_cust on app.consent_events(cust_id, occurred_at desc);

create table if not exists app.audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_uid uuid,
  table_name text not null,
  action text not null,
  record_pk jsonb,
  row_before jsonb,
  row_after jsonb
);
create index if not exists idx_audit_log_tbl_time on app.audit_log(table_name, occurred_at desc);

-- ---------- Audit trigger ----------
create or replace function app.tg_audit_row()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
begin
  insert into app.audit_log(
    occurred_at, actor_uid, table_name, action, record_pk, row_before, row_after
  )
  values (
    now(),
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    case 
      when TG_OP in ('INSERT','UPDATE') then
        (select jsonb_object_agg(k, to_jsonb(v))
         from jsonb_each(to_jsonb(NEW)) as t(k,v)
         where k in (select a.attname
                     from pg_index i
                     join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                     where i.indrelid = TG_RELID and i.indisprimary))
      else
        (select jsonb_object_agg(k, to_jsonb(v))
         from jsonb_each(to_jsonb(OLD)) as t(k,v)
         where k in (select a.attname
                     from pg_index i
                     join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                     where i.indrelid = TG_RELID and i.indisprimary))
    end,
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end
  );
  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;

drop trigger if exists tr_audit_contacts on app.contacts;
create trigger tr_audit_contacts
after insert or update or delete on app.contacts
for each row execute function app.tg_audit_row();

drop trigger if exists tr_audit_consent on app.consent_events;
create trigger tr_audit_consent
after insert or update or delete on app.consent_events
for each row execute function app.tg_audit_row();

-- ---------- Consent flag sync ----------
create or replace function app.tg_update_contact_consent()
returns trigger
language plpgsql
as $$
begin
  if NEW.channel = 'email' then
    update app.contacts
       set consent_email = (NEW.status = 'opt_in'),
           updated_at = now()
     where cust_id = NEW.cust_id;
  elsif NEW.channel = 'sms' then
    update app.contacts
       set consent_sms = (NEW.status = 'opt_in'),
           updated_at = now()
     where cust_id = NEW.cust_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists tr_consent_events_upsert on app.consent_events;
create trigger tr_consent_events_upsert
after insert on app.consent_events
for each row execute function app.tg_update_contact_consent();

-- ---------- RLS & Policies ----------
alter table app.user_roles     enable row level security;
alter table app.contacts       enable row level security;
alter table app.consent_events enable row level security;
alter table app.audit_log      enable row level security;

drop policy if exists p_roles_admin_rw on app.user_roles;
create policy p_roles_admin_rw
on app.user_roles
as permissive
for all
to authenticated
using ( app.has_role(array['admin']) )
with check ( app.has_role(array['admin']) );

drop policy if exists p_contacts_rw_staff on app.contacts;
create policy p_contacts_rw_staff
on app.contacts
as permissive
for all
to authenticated
using ( app.has_role(array['admin','staff']) )
with check ( app.has_role(array['admin','staff']) );

drop policy if exists p_consent_rw_staff on app.consent_events;
create policy p_consent_rw_staff
on app.consent_events
as permissive
for all
to authenticated
using ( app.has_role(array['admin','staff']) )
with check ( app.has_role(array['admin','staff']) );

drop policy if exists p_audit_ro_staff on app.audit_log;
create policy p_audit_ro_staff
on app.audit_log
as permissive
for select
to authenticated
using ( app.has_role(array['admin','staff']) );

-- Marketing read-only with consent gate
drop policy if exists p_contacts_marketing_ro on app.contacts;
create policy p_contacts_marketing_ro
on app.contacts
as permissive
for select
to authenticated
using (
  app.has_role(array['marketing'])
  and (consent_email = true or consent_sms = true)
);

-- ---------- Safe views ----------
create or replace view app.v_contacts_marketing as
select
  c.cust_id,
  c.initials,
  c.email,
  c.phone,
  c.consent_email,
  c.consent_sms,
  c.created_at
from app.contacts c
where (c.consent_email = true or c.consent_sms = true);

comment on view app.v_contacts_marketing is
  'Safe subset for outreach; contains only anonymized ID, initials, and contact fields for records with consent.';

create or replace view app.v_consent_latest as
with ranked as (
  select
    e.*,
    row_number() over (partition by e.cust_id, e.channel order by e.occurred_at desc, e.id desc) as rn
  from app.consent_events e
)
select
  cust_id,
  channel,
  status,
  source,
  actor_uid,
  occurred_at
from ranked
where rn = 1;

create or replace view app.v_contacts_overview as
select
  c.cust_id,
  c.initials,
  c.email,
  c.phone,
  c.consent_email,
  c.consent_sms,
  greatest(
    coalesce(le.occurred_at, timestamp 'epoch'),
    coalesce(ls.occurred_at, timestamp 'epoch')
  ) as last_consent_event_at
from app.contacts c
left join app.v_consent_latest le on le.cust_id = c.cust_id and le.channel = 'email'
left join app.v_consent_latest ls on ls.cust_id = c.cust_id and ls.channel = 'sms';

comment on view app.v_consent_latest is 'Latest consent event per customer/channel.';
comment on view app.v_contacts_overview is 'Contacts with current consent flags and last consent event time.';

create or replace view app.v_audit_last_30d as
select
  id,
  occurred_at,
  table_name,
  action,
  actor_uid,
  record_pk
from app.audit_log
where occurred_at >= now() - interval '30 days'
order by occurred_at desc;

create or replace view app.v_audit_contacts_changes as
select
  id,
  occurred_at,
  action,
  record_pk ->> 'cust_id' as cust_id,
  actor_uid
from app.audit_log
where table_name = 'contacts'
order by occurred_at desc;

create or replace view app.v_marketing_rollup as
select
  c.cust_id,
  c.initials,
  case
    when c.email is null then null
    else regexp_replace(c.email, '(^.).*(@.*$)', '\1***\2')
  end as email_masked,
  case
    when c.phone is null then null
    else regexp_replace(c.phone, '.*([0-9]{2})$', '***\1')
  end as phone_masked,
  c.consent_email,
  c.consent_sms,
  c.created_at
from app.contacts c
where (c.consent_email = true or c.consent_sms = true);

comment on view app.v_marketing_rollup is
  'Masked version of consented contacts for demos/checks (non-PHI exposure).';

-- ---------- Helper functions to manage roles by email ----------
create or replace function app.grant_role_by_email(p_email text, p_role text)
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid;
begin
  if p_role not in ('admin','staff','marketing') then
    raise exception 'Invalid role: %', p_role;
  end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then
    raise exception 'No auth user found for %', p_email;
  end if;
  insert into app.user_roles(user_uid, role)
  values (v_uid, p_role)
  on conflict do nothing;
end;
$$;

create or replace function app.revoke_role_by_email(p_email text, p_role text)
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then
    raise exception 'No auth user found for %', p_email;
  end if;
  delete from app.user_roles where user_uid = v_uid and role = p_role;
end;
$$;
