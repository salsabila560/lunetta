-- Lunetta whitelist schema (PostgreSQL 14+)
create table if not exists whitelist_entries (
  address     text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  x_handle    text check (x_handle is null or x_handle ~ '^[A-Za-z0-9_]{1,15}$'),
  message     text not null,
  signature   text not null,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists whitelist_entries_created_at_idx on whitelist_entries (created_at);
create index if not exists whitelist_entries_ip_hash_idx on whitelist_entries (ip_hash);
