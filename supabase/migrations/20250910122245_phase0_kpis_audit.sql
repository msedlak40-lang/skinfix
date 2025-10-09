-- =========================================
-- Phase 0 KPIs & Audit pack (no seed data)
-- =========================================

-- Lightweight app events table (for auth errors, etc.)
create table if not exists app.app_events (
  id bigserial primary key,
  event_ts timestamptz not null default now(),
  actor_uid uuid,
  level text not null check (level in ('info','warn','error')) default 'info',
  source text not null,  -- e.g., 'pwa','edge','api','auth'
  event text not null,   -- e.g., 'login_failed','sms_blocked'
  detail jsonb
);
alter table app.app_events enable row level security;

-- RLS: admins & staff can read; only admins can write
drop policy if exists p_app_events_ro_admin on app.app_events;
create policy p_app_events_ro_admin
on app.app_events
for select
to authenticated
using ( app.has_role(array['admin','staff']) );

drop policy if exists p_app_events_rw_admin on app.app_events;
create policy p_app_events_rw_admin
on app.app_events
for all
to authenticated
using ( app.has_role(array['admin']) )
with check ( app.has_role(array['admin']) );

create index if not exists idx_app_events_ts on app.app_events(event_ts desc);
create index if not exists idx_app_events_level on app.app_events(level);
create index if not exists idx_app_events_source on app.app_events(source);

-- Helper: log an event from SQL / RPC later
create or replace function app.log_event(p_level text, p_source text, p_event text, p_detail jsonb default '{}'::jsonb)
returns void
language sql
as $$
  insert into app.app_events(actor_uid, level, source, event, detail)
  values (auth.uid(), p_level, p_source, p_event, p_detail);
$$;

comment on table app.app_events is 'Lightweight, non-PHI application events. Use to track auth errors and operational signals.';
comment on function app.log_event is 'Insert a non-PHI app event. Example: select app.log_event(''error'',''auth'',''login_failed'', jsonb_build_object(''email'',''x@y.com''));';

-- =====================
-- KPI / Dashboard views
-- =====================

-- Overall consent summary
create or replace view app.v_kpi_consent_summary as
with t as (select count(*)::int as total from app.contacts),
c as (select count(*)::int as consented from app.contacts where consent_email or consent_sms),
last_evt as (select max(occurred_at) as last_consent_ts from app.consent_events)
select
  t.total,
  c.consented,
  round(100.0 * c.consented / nullif(t.total,0), 1) as consent_rate_pct,
  (select last_consent_ts from last_evt)
from t cross join c;

comment on view app.v_kpi_consent_summary is 'Counts + consent rate + timestamp of last consent event.';

-- Consent by channel (based on latest status per contact/channel)
create or replace view app.v_kpi_consent_by_channel as
with latest as (
  select * from app.v_consent_latest
),
agg as (
  select
    channel,
    sum( case when status = 'opt_in'  then 1 else 0 end )::int as opt_ins,
    sum( case when status = 'opt_out' then 1 else 0 end )::int as opt_outs,
    count(*)::int as total_latest
  from latest
  group by channel
)
select
  channel,
  opt_ins,
  opt_outs,
  total_latest,
  round(100.0 * opt_ins / nullif(total_latest,0), 1) as opt_in_rate_pct
from agg
order by channel;

comment on view app.v_kpi_consent_by_channel is 'Latest consent disposition by channel (email/sms).';

-- Audit summary last 7 days
create or replace view app.v_audit_summary_7d as
select
  table_name,
  action,
  count(*)::int as events,
  max(occurred_at) as last_at
from app.audit_log
where occurred_at >= now() - interval '7 days'
group by table_name, action
order by last_at desc;

comment on view app.v_audit_summary_7d is 'Event counts by table/action over the last 7 days.';

-- App events (errors) last 7 days
create or replace view app.v_app_errors_7d as
select
  source,
  event,
  count(*)::int as errors,
  max(event_ts) as last_at
from app.app_events
where level = 'error'
  and event_ts >= now() - interval '7 days'
group by source, event
order by last_at desc;

comment on view app.v_app_errors_7d is 'Non-PHI error rollup by source/event for the past 7 days.';

-- Who am I (effective roles) - handy for debugging RLS
create or replace view app.v_whoami_roles as
select
  auth.uid() as uid,
  array_agg(role order by role) as roles
from app.user_roles
where user_uid = auth.uid();
