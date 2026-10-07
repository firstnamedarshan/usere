-- Run once on a new Supabase project. Only trusted Edge Functions may mutate.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  wallet_address text not null unique check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  created_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id),
  creator_wallet text not null,
  title text not null check (length(trim(title)) between 1 and 100),
  description text not null check (length(trim(description)) between 1 and 600),
  category text not null check (category in ('Solana data','Transaction debugging','Developer tools','Data workflows')),
  expected_input text not null check (length(trim(expected_input)) between 1 and 2000),
  expected_output text not null check (length(trim(expected_output)) between 1 and 2000),
  requirements text not null check (length(trim(requirements)) between 1 and 2000),
  limitations text not null check (length(trim(limitations)) between 1 and 2000),
  reuse_terms text not null check (length(trim(reuse_terms)) between 1 and 1000),
  price_lamports bigint not null check (price_lamports between 1 and 10000000000),
  version integer not null default 1 check (version = 1),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_reason text check (length(review_reason) <= 1000),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (id, version)
);

create table public.skill_files (
  skill_id uuid primary key references public.skills(id),
  version integer not null check (version = 1),
  storage_path text not null unique,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size between 1 and 102400),
  unique (skill_id, version),
  foreign key (skill_id, version) references public.skills(id, version)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  skill_id uuid not null,
  version integer not null,
  buyer_wallet text not null,
  recipient_wallet text not null,
  amount_lamports bigint not null check (amount_lamports between 1 and 10000000000),
  reference text not null unique default ('reuse:' || gen_random_uuid()::text),
  network text not null default 'devnet' check (network = 'devnet'),
  asset text not null default 'SOL' check (asset = 'SOL'),
  minimum_slot bigint not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  transaction_signature text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  verified_at timestamptz,
  verified_slot bigint,
  foreign key (skill_id, version) references public.skills(id, version),
  check (expires_at > created_at),
  check (status <> 'paid' or (transaction_signature is not null and verified_at is not null))
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  skill_id uuid not null,
  version integer not null,
  order_id uuid not null unique references public.orders(id),
  purchased_at timestamptz not null default now(),
  unique (buyer_id, skill_id, version),
  foreign key (skill_id, version) references public.skill_files(skill_id, version)
);
create index skills_status_created on public.skills(status, created_at desc);
create index skills_creator on public.skills(creator_id, created_at desc);
create index skills_reviewer on public.skills(reviewed_by);
create index orders_buyer_skill on public.orders(buyer_id, skill_id, created_at desc);
create index orders_skill_version on public.orders(skill_id, version);
create index purchases_skill_version on public.purchases(skill_id, version);

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.skill_files enable row level security;
alter table public.orders enable row level security;
alter table public.purchases enable row level security;

revoke all on public.profiles, public.skills, public.skill_files, public.orders, public.purchases from public, anon, authenticated, service_role;
grant select on public.skills to anon, authenticated;
grant select on public.profiles, public.orders, public.purchases to authenticated;
grant select, insert on public.profiles, public.skill_files, public.purchases to service_role;
grant select, insert, update on public.skills, public.orders to service_role;
create policy public_approved_or_own on public.skills for select to anon, authenticated
  using (status = 'approved' or creator_id = (select auth.uid()));
create policy own_profile on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy own_orders on public.orders for select to authenticated using (buyer_id = (select auth.uid()));
create policy own_purchases on public.purchases for select to authenticated using (buyer_id = (select auth.uid()));
-- No client SELECT policy on skill_files. No client writes or admin-role table.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('skill-files', 'skill-files', false, 102400, array['text/markdown']);
-- Deliberately no storage.objects policies for this bucket. Functions use service_role.

create function public.freeze_reviewed_skill() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'pending' then raise exception 'Reviewed listings are immutable'; end if;
  if (to_jsonb(new) - array['status','review_reason','reviewed_at','reviewed_by']) is distinct from
     (to_jsonb(old) - array['status','review_reason','reviewed_at','reviewed_by']) then
    raise exception 'Listing content is immutable';
  end if;
  return new;
end $$;
create trigger freeze_skill before update on public.skills for each row execute function public.freeze_reviewed_skill();
create function public.freeze_file() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Skill versions cannot be changed or deleted'; end $$;
create trigger freeze_file before update or delete on public.skill_files for each row execute function public.freeze_file();
create trigger freeze_profile before update or delete on public.profiles for each row execute function public.freeze_file();

create function public.submit_skill(p_id uuid, p_creator uuid, p_listing jsonb, p_path text, p_hash text, p_size integer)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare wallet text;
begin
  select wallet_address into strict wallet from public.profiles where id = p_creator;
  insert into public.skills(id, creator_id, creator_wallet, title, description, category, expected_input, expected_output,
    requirements, limitations, reuse_terms, price_lamports)
  values (p_id, p_creator, wallet, p_listing->>'title', p_listing->>'description', p_listing->>'category',
    p_listing->>'expected_input', p_listing->>'expected_output', p_listing->>'requirements', p_listing->>'limitations',
    p_listing->>'reuse_terms', (p_listing->>'price_lamports')::bigint);
  insert into public.skill_files(skill_id, version, storage_path, content_hash, byte_size) values (p_id, 1, p_path, p_hash, p_size);
  return p_id;
end $$;

create function public.create_skill_order(p_buyer uuid, p_skill uuid, p_slot bigint)
returns public.orders language plpgsql security invoker set search_path = '' as $$
declare skill public.skills; wallet text; existing public.orders; result public.orders;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_buyer::text || ':' || p_skill::text, 0));
  select * into strict skill from public.skills where id = p_skill and status = 'approved';
  select wallet_address into strict wallet from public.profiles where id = p_buyer;
  if skill.creator_id = p_buyer then raise exception 'Creators already have access to their own file'; end if;
  if exists (select 1 from public.purchases where buyer_id = p_buyer and skill_id = p_skill and version = skill.version) then
    raise exception 'Already owned';
  end if;
  select * into existing from public.orders where buyer_id = p_buyer and skill_id = p_skill and status = 'pending'
    and (expires_at > now() or transaction_signature is not null) order by created_at desc limit 1;
  if found then return existing; end if;
  insert into public.orders(buyer_id, skill_id, version, buyer_wallet, recipient_wallet, amount_lamports, minimum_slot)
  values (p_buyer, p_skill, skill.version, wallet, skill.creator_wallet, skill.price_lamports, p_slot) returning * into result;
  return result;
end $$;

create function public.attach_order_signature(p_order uuid, p_buyer uuid, p_signature text)
returns public.orders language plpgsql security invoker set search_path = '' as $$
declare result public.orders;
begin
  select * into strict result from public.orders where id = p_order and buyer_id = p_buyer for update;
  if result.transaction_signature is not null then
    if result.transaction_signature <> p_signature then raise exception 'This order already has a signature. Recheck it before paying again'; end if;
    return result;
  end if;
  if result.expires_at <= now() then raise exception 'Order expired before signature was saved'; end if;
  update public.orders set transaction_signature = p_signature where id = p_order returning * into result;
  return result;
end $$;

create function public.finalize_skill_order(p_order uuid, p_buyer uuid, p_signature text, p_slot bigint)
returns public.purchases language plpgsql security invoker set search_path = '' as $$
declare intent public.orders; result public.purchases;
begin
  select * into strict intent from public.orders where id = p_order and buyer_id = p_buyer for update;
  if intent.transaction_signature is distinct from p_signature then raise exception 'Saved signature mismatch'; end if;
  if intent.status = 'paid' then
    select * into strict result from public.purchases where order_id = p_order;
    return result;
  end if;
  -- Called only by the verifier after finalized chain checks, never from a browser.
  update public.orders set status = 'paid', verified_at = now(), verified_slot = p_slot where id = p_order;
  insert into public.purchases(buyer_id, skill_id, version, order_id)
    values (intent.buyer_id, intent.skill_id, intent.version, intent.id) returning * into result;
  return result;
end $$;

revoke all on function public.submit_skill(uuid,uuid,jsonb,text,text,integer) from public, anon, authenticated;
revoke all on function public.create_skill_order(uuid,uuid,bigint) from public, anon, authenticated;
revoke all on function public.attach_order_signature(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.finalize_skill_order(uuid,uuid,text,bigint) from public, anon, authenticated;
grant execute on function public.submit_skill(uuid,uuid,jsonb,text,text,integer) to service_role;
grant execute on function public.create_skill_order(uuid,uuid,bigint) to service_role;
grant execute on function public.attach_order_signature(uuid,uuid,text) to service_role;
grant execute on function public.finalize_skill_order(uuid,uuid,text,bigint) to service_role;
