import "server-only";
import postgres from "postgres";

declare global {
  var __lunettaSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    max: 1, // serverless: one connection per lambda; use a pooled URL (Neon/Supabase pooler)
    idle_timeout: 20,
    prepare: false, // required for PgBouncer-style poolers
  });
}

/** Lazily created so builds don't need a database. */
export function sql() {
  if (!globalThis.__lunettaSql) globalThis.__lunettaSql = createClient();
  return globalThis.__lunettaSql;
}

export type WhitelistRow = {
  address: string;
  x_handle: string | null;
  created_at: Date;
};

export async function findEntry(address: string) {
  const rows = await sql()<WhitelistRow[]>`
    select address, x_handle, created_at from whitelist_entries where address = ${address.toLowerCase()} limit 1`;
  return rows[0] ?? null;
}

export async function countEntries() {
  const rows = await sql()<{ count: string }[]>`select count(*)::text as count from whitelist_entries`;
  return Number(rows[0]?.count ?? 0);
}

/** Returns true when inserted, false when the wallet was already registered. */
export async function insertEntry(entry: {
  address: string;
  xHandle: string | null;
  message: string;
  signature: string;
  ipHash: string;
}) {
  const rows = await sql()`
    insert into whitelist_entries (address, x_handle, message, signature, ip_hash)
    values (${entry.address.toLowerCase()}, ${entry.xHandle}, ${entry.message}, ${entry.signature}, ${entry.ipHash})
    on conflict (address) do nothing
    returning address`;
  return rows.length > 0;
}
