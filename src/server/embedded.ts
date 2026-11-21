import {
  PGlite,
  type PGliteOptions,
  type Transaction,
} from "@electric-sql/pglite";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const bootstrap = `
 create schema if not exists auth;
 do $$begin if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select from pg_roles where rolname='anon') then create role anon; end if; end$$;
 create table if not exists auth.users(
  id uuid primary key, instance_id uuid, aud text, role text, phone text unique, phone_confirmed_at timestamptz,
  created_at timestamptz, updated_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  confirmation_token text default '',recovery_token text default '',email_change_token_new text default '',email_change text default ''
 );
 create table if not exists auth.identities (
  id uuid primary key,user_id uuid not null references auth.users(id),provider_id text,identity_data jsonb,
  provider text,last_sign_in_at timestamptz,created_at timestamptz,updated_at timestamptz,unique(provider_id,provider)
 );
 create or replace function auth.uid() returns uuid language sql stable as
 $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table if not exists tilebook_schema_history(name text primary key);
 alter table tilebook_schema_history enable row level security;
 revoke all on tilebook_schema_history from public,authenticated,anon;
`;
export async function openEmbedded(
  directory?: string,
  options: PGliteOptions = {},
) {
  if (directory) await mkdir(directory, { recursive: true });
  const db = new PGlite({ ...options, dataDir: directory });
  try {
    await db.waitReady;
    await db.exec(bootstrap);
    const root = path.resolve(process.cwd(), "supabase");
    const migrations = (await readdir(path.join(root, "migrations")))
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map((name) => "migrations/" + name);
    for (const name of [...migrations, "seed.sql"]) {
      const applied = await db.query(
        "select 1 from tilebook_schema_history where name=$1",
        [name],
      );
      if (applied.rows.length) continue;
      const sql = await readFile(path.join(root, name), "utf8");
      await db.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query("insert into tilebook_schema_history values ($1)", [
          name,
        ]);
      });
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
const shared = globalThis as typeof globalThis & {
  tilebookEmbedded?: Promise<PGlite>;
};
export function embeddedDatabase() {
  if (process.env.TILEBOOK_LOCAL_DEMO !== "1")
    throw new Error("Embedded demo is disabled");
  return (shared.tilebookEmbedded ??= openEmbedded(
    path.resolve(process.env.TILEBOOK_DATA_DIR || ".tilebook/data"),
  ).catch((error: unknown) => {
    delete shared.tilebookEmbedded;
    throw error;
  }));
}
export async function asUser<T>(
  db: PGlite,
  userId: string,
  task: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      userId,
    ]);
    await tx.exec("set local role authenticated");
    return task(tx);
  });
}
