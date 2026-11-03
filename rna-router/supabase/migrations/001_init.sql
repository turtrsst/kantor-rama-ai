-- RNA Router initial schema
-- Run: supabase db reset --include-all  (or import via Supabase SQL editor)

enable extension if not exists "pgcrypto";

create table if not exists user_keys (
  id uuid primary key default gen_random_uuid(),
  user_api_key text not null,
  provider text not null,
  key_value text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_api_key, provider)
);

create index if not exists idx_user_keys_lookup on user_keys(user_api_key, provider);

create table if not exists gateway_logs (
  id uuid primary key default gen_random_uuid(),
  event text not null, -- chat | fallback | error
  model text,
  from_model text,
  to_model text,
  status int,
  user_key text,
  usage_tokens int default 0,
  created_at timestamp with time zone default now()
);

create index if not exists idx_gateway_logs_model on gateway_logs(model);
create index if not exists idx_gateway_logs_user on gateway_logs(user_key);
create index if not exists idx_gateway_logs_time on gateway_logs(created_at desc);
