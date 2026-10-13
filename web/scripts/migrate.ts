/** Applies db/schema.sql to DATABASE_URL.  Usage: npm run db:migrate */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (put it in .env)");
  const sql = postgres(url, { max: 1, prepare: false });
  const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  await sql.unsafe(schema);
  console.log("✓ Schema applied");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
