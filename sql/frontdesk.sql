-- frontdesk.sql — Skin Fix (non-PHI) baseline for dev/stage/prod
-- Safe to run multiple times (idempotent patterns where possible).

-- === Extensions ===
create extension if not exists pgcrypto;

-- === Core tables ===

-- Contacts (non-PHI, initials + phone only)
create table if not exists public.contacts (
  cust_id uuid primary key,
  phone text,
  first_initial text,
  last_initial text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_phone_idx on public.contacts (phone);

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.touch_updated_at();

-- Entitlements ledger (issue/redeem)
create table if not exists public.entitlements_ledger (
  entry_id uuid primary key default gen_random_uuid(),
  cust_id uuid not null,
  source varchar(40) not null,
  action varchar(20) not null,        -- 'issue' | 'redeem'
  perk_code varchar(50) not null,
  qty numeric(10,2) not null,
  ref_id text,                         -- idempotency key or external ref
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists entitlements_cust_idx
  on public.entitlements_ledger (cust_id, perk_code, created_at desc);

create index if not exists entitlements_source_idx
  on public.entitlements_ledger (source);

alter table public.entitlements_ledger
  drop constraint if exists entitlements_action_chk;

alter table public.entitlements_ledger
  add constraint entitlements_action_chk check (action in ('issue','redeem'));

-- Prevent duplicate redeems by idempotency key
create unique index if not exists entitlements_redeem_idem_uq
  on public.entitlements_ledger (ref_id)
  where action = 'redeem';

-- Per-perk daily caps
create table if not exists public.perk_caps (
  perk_code text primary key,
  daily_cap integer not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.perk_caps (perk_code, daily_cap)
values ('FACIAL_CREDIT', 1)
on conflict (perk_code) do update
  set daily_cap = excluded.daily_cap, updated_at = now();

-- === Views ===

-- Balance per customer/perk
create or replace view public.v_entitlements_balance as
select
  cust_id,
  perk_code,
  sum(case when action='issue' then qty else 0 end) as total_issued,
  sum(case when action='redeem' then qty else 0 end) as total_redeemed,
  sum(case when action='issue' then qty
           when action='redeem' then -qty
           else 0 end) as balance
from public.entitlements_ledger
group by cust_id, perk_code;

-- Contacts + balances (by phone)
create or replace view public.v_contact_balances as
select
  c.cust_id,
  c.phone,
  coalesce(b.perk_code, '—') as perk_code,
  coalesce(b.balance, 0)     as balance
from public.contacts c
left join public.v_entitlements_balance b
  on b.cust_id = c.cust_id
order by c.phone, b.perk_code;

-- Scan card (by cust_id)
create or replace view public.v_contact_scan_card as
select
  c.cust_id,
  coalesce(c.phone, '—')          as phone,
  coalesce(b.perk_code, '—')      as perk_code,
  coalesce(b.balance, 0)          as balance,
  c.first_initial,
  c.last_initial,
  c.updated_at
from public.contacts c
left join public.v_entitlements_balance b
  on b.cust_id = c.cust_id
order by c.updated_at desc, b.perk_code;

-- Redemptions audit
create or replace view public.v_redemptions_audit as
select
  entry_id,
  cust_id,
  perk_code,
  qty,
  source,
  created_at,
  metadata->>'actor' as actor,
  metadata->>'note'  as note,
  ref_id
from public.entitlements_ledger
where action = 'redeem'
order by created_at desc;

-- Duplicate phones helper
create or replace view public.v_duplicate_phones as
select phone, count(*) as num_contacts, array_agg(cust_id order by updated_at desc) as cust_ids
from public.contacts
where phone is not null and phone <> ''
group by phone
having count(*) > 1
order by num_contacts desc, phone;

-- === Functions / RPCs ===

-- Normalize phone (US-first, simple)
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
as $$
declare
  digits text;
begin
  if p_phone is null then
    return null;
  end if;
  digits := regexp_replace(p_phone, '\D', '', 'g');
  if length(digits) = 10 then
    return '+1' || digits;
  elsif length(digits) = 11 and left(digits,1) = '1' then
    return '+' || digits;
  elsif length(digits) >= 8 then
    return '+' || digits;
  end if;
  return null;
end;
$$;

-- Upsert minimal contact
create or replace function public.upsert_contact_minimal(
  p_cust_id uuid default null,
  p_phone text default null,
  p_first_initial text default null,
  p_last_initial text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_cust_id uuid := coalesce(p_cust_id, gen_random_uuid());
  v_phone   text := public.normalize_phone(p_phone);
begin
  insert into public.contacts (cust_id, phone, first_initial, last_initial)
  values (v_cust_id, v_phone, p_first_initial, p_last_initial)
  on conflict (cust_id) do update
    set phone = coalesce(excluded.phone, contacts.phone),
        first_initial = coalesce(excluded.first_initial, contacts.first_initial),
        last_initial  = coalesce(excluded.last_initial, contacts.last_initial),
        updated_at = now();

  return jsonb_build_object(
    'status','ok',
    'cust_id', v_cust_id,
    'phone', v_phone,
    'first_initial', p_first_initial,
    'last_initial', p_last_initial
  );
end;
$$;

-- Core redeem with per-perk daily cap + idempotency
create or replace function public.redeem_credit(
  p_cust_id uuid,
  p_perk_code text,
  p_qty numeric(10,2),
  p_idempotency_key text,
  p_actor text default null,
  p_note  text default null,
  p_daily_cap integer default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_balance numeric(10,2);
  v_row public.entitlements_ledger%rowtype;
  v_redeems_today integer;
  v_cap integer;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty must be > 0';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 6 then
    raise exception 'idempotency_key too short';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_cust_id::text || '|' || p_perk_code));

  select * into v_row
  from public.entitlements_ledger
  where action = 'redeem' and ref_id = p_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object(
      'status','ok','idempotent', true,
      'entry_id', v_row.entry_id,
      'cust_id', v_row.cust_id,
      'perk_code', v_row.perk_code,
      'qty', v_row.qty
    );
  end if;

  select pc.daily_cap into v_cap
  from public.perk_caps pc
  where pc.perk_code = p_perk_code;
  v_cap := coalesce(v_cap, p_daily_cap, 1);

  select count(*)::int into v_redeems_today
  from public.entitlements_ledger
  where action='redeem'
    and cust_id = p_cust_id
    and perk_code = p_perk_code
    and created_at >= date_trunc('day', now())
    and created_at <  date_trunc('day', now()) + interval '1 day';
  if v_redeems_today >= v_cap then
    raise exception 'daily_cap_reached: already % today (cap %)', v_redeems_today, v_cap
      using errcode = 'P0001';
  end if;

  select coalesce(sum(case when action='issue' then qty
                           when action='redeem' then -qty end), 0)
    into v_balance
  from public.entitlements_ledger
  where cust_id = p_cust_id
    and perk_code = p_perk_code;

  if v_balance < p_qty then
    raise exception 'insufficient_balance: % (have %) for %', p_qty, v_balance, p_perk_code
      using errcode = 'P0001';
  end if;

  insert into public.entitlements_ledger
    (cust_id, source, action, perk_code, qty, ref_id, metadata)
  values
    (p_cust_id, 'frontdesk', 'redeem', p_perk_code, p_qty, p_idempotency_key,
     jsonb_strip_nulls(jsonb_build_object('actor', p_actor, 'note', p_note)))
  returning * into v_row;

  return jsonb_build_object(
    'status','ok',
    'idempotent', false,
    'entry_id', v_row.entry_id,
    'balance_after', v_balance - p_qty
  );
end;
$$;

-- Phone flow: pick highest balance for that perk (fallback most recent)
create or replace function public.get_balance_or_redeem_by_phone(
  p_phone text,
  p_perk_code text,
  p_qty numeric(10,2) default 1,
  p_idempotency_key text default null,
  p_do_redeem boolean default false,
  p_actor text default null,
  p_note  text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_cust_id uuid;
  v_balance_before numeric(10,2);
  v_balance_after  numeric(10,2);
  v_result jsonb;
begin
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone required';
  end if;
  if p_perk_code is null or length(trim(p_perk_code)) = 0 then
    raise exception 'perk_code required';
  end if;

  select cand.cust_id into v_cust_id
  from (
    select c.cust_id, coalesce(b.balance,0) as bal, c.updated_at
    from public.contacts c
    left join public.v_entitlements_balance b
      on b.cust_id = c.cust_id and b.perk_code = p_perk_code
    where c.phone = p_phone
    order by bal desc, c.updated_at desc
    limit 1
  ) as cand;

  if v_cust_id is null then
    return jsonb_build_object('status','not_found','reason','no contact for phone','phone',p_phone);
  end if;

  select coalesce(sum(case when action='issue' then qty
                           when action='redeem' then -qty end),0)
    into v_balance_before
  from public.entitlements_ledger
  where cust_id = v_cust_id and perk_code = p_perk_code;

  if not p_do_redeem then
    return jsonb_build_object(
      'status','ok',
      'cust_id', v_cust_id,
      'perk_code', p_perk_code,
      'balance', v_balance_before
    );
  end if;

  if p_idempotency_key is null or length(p_idempotency_key) < 6 then
    raise exception 'idempotency_key required (>=6 chars) when redeeming';
  end if;

  v_result := public.redeem_credit(
    v_cust_id, p_perk_code, p_qty, p_idempotency_key, p_actor, p_note
  );

  select coalesce(sum(case when action='issue' then qty
                           when action='redeem' then -qty end),0)
    into v_balance_after
  from public.entitlements_ledger
  where cust_id = v_cust_id and perk_code = p_perk_code;

  return jsonb_build_object(
    'status','ok',
    'cust_id', v_cust_id,
    'perk_code', p_perk_code,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'redeem_result', v_result
  );
end;
$$;

-- Cust_id flow (scan)
create or replace function public.redeem_by_cust_id(
  p_cust_id uuid,
  p_perk_code text,
  p_qty numeric(10,2) default 1,
  p_idempotency_key text default null,
  p_actor text default null,
  p_note  text default null
)
returns jsonb
language plpgsql
security definer
as $$
begin
  if p_cust_id is null then
    raise exception 'cust_id required';
  end if;
  if p_perk_code is null or length(trim(p_perk_code)) = 0 then
    raise exception 'perk_code required';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty must be > 0';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 6 then
    raise exception 'idempotency_key required (>=6 chars)';
  end if;

  return public.redeem_credit(
    p_cust_id, p_perk_code, p_qty, p_idempotency_key, p_actor, p_note
  );
end;
$$;

-- Merge contacts utility
create or replace function public.merge_contacts(
  p_primary uuid,
  p_duplicate uuid,
  p_keep_phone boolean default true
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_phone text;
  v_moved int := 0;
begin
  if p_primary = p_duplicate then
    raise exception 'primary and duplicate cannot be the same';
  end if;

  perform 1 from public.contacts where cust_id = p_primary;
  if not found then raise exception 'primary contact not found'; end if;

  perform 1 from public.contacts where cust_id = p_duplicate;
  if not found then raise exception 'duplicate contact not found'; end if;

  update public.entitlements_ledger
     set cust_id = p_primary
   where cust_id = p_duplicate;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  if p_keep_phone then
    select phone into v_phone from public.contacts where cust_id = p_primary;
    if v_phone is null then
      update public.contacts p
      set phone = d.phone, updated_at = now()
      from public.contacts d
      where p.cust_id = p_primary
        and d.cust_id = p_duplicate
        and d.phone is not null;
    end if;
  end if;

  delete from public.contacts where cust_id = p_duplicate;

  return jsonb_build_object('status','ok','moved_rows',v_moved);
end;
$$;

-- === Grants ===
grant select on table public.v_entitlements_balance, public.v_contact_balances, public.v_contact_scan_card, public.v_redemptions_audit, public.v_duplicate_phones to authenticated;
grant execute on function public.upsert_contact_minimal(uuid, text, text, text) to authenticated;
grant execute on function public.get_balance_or_redeem_by_phone(text, text, numeric, text, boolean, text, text) to authenticated;
grant execute on function public.redeem_by_cust_id(uuid, text, numeric, text, text, text) to authenticated;
grant execute on function public.merge_contacts(uuid, uuid, boolean) to authenticated;

-- Make PostgREST pick up changes immediately
select pg_notify('pgrst', 'reload schema');
