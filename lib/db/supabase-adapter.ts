import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TABLE_NAMES, type ID, type Row, type TableName } from "./schema";
import type { Where } from "./local-store";

/* ==========================================================================
   NEXORA — Supabase PostgreSQL Adapter
   --------------------------------------------------------------------------
   Activated when NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
   present. The service-role key is used ONLY on the server (never imported
   into client components). Browser access goes through the anon key + RLS.

   Schema: see `supabase/schema.sql`.
   ========================================================================== */

export interface DbAdapter {
  readonly kind: "local" | "supabase";
  all<T extends TableName>(name: T): Promise<Array<Row<T>>>;
  find<T extends TableName>(name: T, where?: Where): Promise<Array<Row<T>>>;
  byId<T extends TableName>(name: T, id: ID): Promise<Row<T> | null>;
  insert<T extends TableName>(name: T, row: Row<T>): Promise<Row<T>>;
  insertMany<T extends TableName>(name: T, rows: Array<Row<T>>): Promise<Array<Row<T>>>;
  update<T extends TableName>(name: T, id: ID, patch: Partial<Row<T>>): Promise<Row<T>>;
  upsert<T extends TableName>(name: T, row: Row<T>): Promise<Row<T>>;
  delete(name: TableName, id: ID): Promise<void>;
  count<T extends TableName>(name: T, where?: Where): Promise<number>;
}

function assertTable(name: string): TableName {
  if (!(TABLE_NAMES as string[]).includes(name)) {
    throw new Error(`Unknown table "${name}"`);
  }
  return name as TableName;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
}

/** Client for browser-side use (anon key, RLS enforced). */
export function createSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

function eqFilters(where: Where) {
  const out: Array<[string, unknown]> = [];
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    out.push([k, v]);
  }
  return out;
}

export class SupabaseAdapter implements DbAdapter {
  readonly kind = "supabase" as const;
  constructor(private client: SupabaseClient) {}

  private q(name: TableName) {
    return this.client.from(assertTable(name));
  }

  async all<T extends TableName>(name: T) {
    const { data, error } = await this.q(name).select("*").limit(20000);
    if (error) throw new Error(`supabase select ${name}: ${error.message}`);
    return (data ?? []) as Array<Row<T>>;
  }

  async find<T extends TableName>(name: T, where: Where = {}) {
    let query = this.q(name).select("*");
    for (const [k, v] of eqFilters(where)) query = query.eq(k, v as never);
    const { data, error } = await query.limit(5000);
    if (error) throw new Error(`supabase find ${name}: ${error.message}`);
    return (data ?? []) as Array<Row<T>>;
  }

  async byId<T extends TableName>(name: T, id: ID) {
    const { data, error } = await this.q(name).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`supabase byId ${name}: ${error.message}`);
    return (data ?? null) as Row<T> | null;
  }

  async insert<T extends TableName>(name: T, row: Row<T>) {
    const { data, error } = await this.q(name).insert(row as never).select().single();
    if (error) throw new Error(`supabase insert ${name}: ${error.message}`);
    return data as Row<T>;
  }

  async insertMany<T extends TableName>(name: T, rows: Array<Row<T>>) {
    if (rows.length === 0) return [];
    const { data, error } = await this.q(name).insert(rows as never).select();
    if (error) throw new Error(`supabase insertMany ${name}: ${error.message}`);
    return (data ?? []) as Array<Row<T>>;
  }

  async update<T extends TableName>(name: T, id: ID, patch: Partial<Row<T>>) {
    const { data, error } = await this.q(name)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`supabase update ${name}: ${error.message}`);
    return data as Row<T>;
  }

  async upsert<T extends TableName>(name: T, row: Row<T>) {
    const { data, error } = await this.q(name).upsert(row as never).select().single();
    if (error) throw new Error(`supabase upsert ${name}: ${error.message}`);
    return data as Row<T>;
  }

  async delete(name: TableName, id: ID) {
    const { error } = await this.q(name).delete().eq("id", id);
    if (error) throw new Error(`supabase delete ${name}: ${error.message}`);
  }

  async count<T extends TableName>(name: T, where: Where = {}) {
    let query = this.q(name).select("*", { count: "exact", head: true });
    for (const [k, v] of eqFilters(where)) query = query.eq(k, v as never);
    const { count, error } = await query;
    if (error) throw new Error(`supabase count ${name}: ${error.message}`);
    return count ?? 0;
  }
}
