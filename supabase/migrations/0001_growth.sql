-- Errorless growth system: shares, referrals, credits, feedback.
-- Accessed ONLY from the Next.js server with the service-role key. RLS is enabled with no policies,
-- so the anon key (public in the browser) can read and write nothing.

create table if not exists public.shares (
  id          text primary key,            -- SHA-256 of the share token; the token itself is never stored
  owner_id    text not null,               -- Clerk user id
  title       text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  views       integer not null default 0
);
create index if not exists shares_owner_idx on public.shares (owner_id, created_at desc);

create table if not exists public.referral_codes (
  code      text primary key,
  owner_id  text not null unique
);

create table if not exists public.referral_conversions (
  referee_id  text primary key,            -- one conversion per invited account, ever
  referrer_id text not null,
  code        text not null,
  status      text not null check (status in ('rewarded', 'unrewarded', 'rejected')),
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists referral_conv_referrer_idx on public.referral_conversions (referrer_id);

create table if not exists public.credits (
  user_id  text primary key,
  balance  integer not null default 0 check (balance >= 0)
);

create table if not exists public.growth_feedback (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  surface     text not null,               -- e.g. guest_demo, shared_result
  helpful     boolean not null,
  comment     text
);

alter table public.shares               enable row level security;
alter table public.referral_codes       enable row level security;
alter table public.referral_conversions enable row level security;
alter table public.credits              enable row level security;
alter table public.growth_feedback      enable row level security;

create or replace function public.add_credits(uid text, n integer) returns integer
language sql security definer set search_path = public as $$
  insert into credits (user_id, balance) values (uid, greatest(n, 0))
  on conflict (user_id) do update set balance = credits.balance + greatest(n, 0)
  returning balance;
$$;

create or replace function public.consume_credit(uid text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update credits set balance = balance - 1 where user_id = uid and balance > 0;
  return found;
end $$;

create or replace function public.increment_share_views(sid text) returns void
language sql security definer set search_path = public as $$
  update shares set views = views + 1 where id = sid;
$$;

revoke all on function public.add_credits(text, integer), public.consume_credit(text), public.increment_share_views(text) from public, anon, authenticated;
