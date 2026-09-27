import { LocalStore, getLocalStore, resetLocalStoreSingleton } from "./local-store";
import {
  SupabaseAdapter,
  createSupabaseAdmin,
  isSupabaseConfigured,
} from "./supabase-adapter";
import type { DbAdapter } from "./supabase-adapter";
import type { ID, Row, TableName } from "./schema";
import type { Where } from "./local-store";

/* ==========================================================================
   NEXORA — Unified data layer
   --------------------------------------------------------------------------
   All application code talks to `db`. The implementation is chosen at
   runtime:
     • Supabase Postgres  → when NEXT_PUBLIC_SUPABASE_URL + service role key
     • Local file store   → everything else (Demo Mode / zero-config)
   ========================================================================== */

let adapter: DbAdapter | null = null;
let localStore: LocalStore | null = null;

export type DbMode = "local" | "supabase";

export function dbMode(): DbMode {
  return isSupabaseConfigured() ? "supabase" : "local";
}

export function isDemoMode(): boolean {
  const forced = process.env.NEXORA_MODE?.toLowerCase();
  if (forced === "demo") return true;
  if (forced === "live") return false;
  return dbMode() === "local";
}

function getAdapter(): DbAdapter {
  if (adapter) return adapter;
  if (isSupabaseConfigured()) {
    const client = createSupabaseAdmin();
    if (client) {
      adapter = new SupabaseAdapter(client);
      return adapter;
    }
  }
  localStore = getLocalStore();
  adapter = new LocalAdapter(localStore);
  return adapter;
}

/** Reset cached adapter (tests / scripts only). */
export function resetDb() {
  adapter = null;
  localStore = null;
  resetLocalStoreSingleton();
}

class LocalAdapter implements DbAdapter {
  readonly kind = "local" as const;
  constructor(private store: LocalStore) {}
  async all<T extends TableName>(name: T) {
    return this.store.all(name);
  }
  async find<T extends TableName>(name: T, where: Where = {}) {
    return this.store.find(name, where);
  }
  async byId<T extends TableName>(name: T, id: ID) {
    return this.store.byId(name, id);
  }
  async insert<T extends TableName>(name: T, row: Row<T>) {
    return this.store.insert(name, row);
  }
  async insertMany<T extends TableName>(name: T, rows: Array<Row<T>>) {
    return this.store.insertMany(name, rows);
  }
  async update<T extends TableName>(name: T, id: ID, patch: Partial<Row<T>>) {
    return this.store.update(name, id, patch);
  }
  async upsert<T extends TableName>(name: T, row: Row<T>) {
    return this.store.upsert(name, row);
  }
  async delete(name: TableName, id: ID) {
    this.store.delete(name, id);
  }
  async count<T extends TableName>(name: T, where: Where = {}) {
    return this.store.count(name, where);
  }
}

/* -------------------------------------------------------------- the API --- */

export const db = {
  mode: dbMode,
  demo: isDemoMode,

  all<T extends TableName>(name: T): Promise<Array<Row<T>>> {
    return getAdapter().all(name);
  },
  find<T extends TableName>(name: T, where: Where = {}): Promise<Array<Row<T>>> {
    return getAdapter().find(name, where);
  },
  async findOne<T extends TableName>(name: T, where: Where = {}): Promise<Row<T> | null> {
    return (await getAdapter().find(name, where))[0] ?? null;
  },
  byId<T extends TableName>(name: T, id: ID): Promise<Row<T> | null> {
    return getAdapter().byId(name, id);
  },
  insert<T extends TableName>(name: T, row: Row<T>): Promise<Row<T>> {
    return getAdapter().insert(name, row);
  },
  insertMany<T extends TableName>(name: T, rows: Array<Row<T>>): Promise<Array<Row<T>>> {
    return getAdapter().insertMany(name, rows);
  },
  update<T extends TableName>(name: T, id: ID, patch: Partial<Row<T>>): Promise<Row<T>> {
    return getAdapter().update(name, id, patch);
  },
  upsert<T extends TableName>(name: T, row: Row<T>): Promise<Row<T>> {
    return getAdapter().upsert(name, row);
  },
  delete(name: TableName, id: ID): Promise<void> {
    return getAdapter().delete(name, id);
  },
  count<T extends TableName>(name: T, where: Where = {}): Promise<number> {
    return getAdapter().count(name, where);
  },

  /** Subscribe to local-store changes (no-op on Supabase; use Realtime there). */
  onChange(listener: Parameters<LocalStore["subscribe"]>[0]): () => void {
    const a = getAdapter();
    if (a instanceof LocalAdapter) return a["store"].subscribe(listener);
    return () => {};
  },

  /** Raw local store access (demo seeding / scripts). Null in Supabase mode. */
  local(): LocalStore | null {
    getAdapter();
    return localStore;
  },

  async flush() {
    localStore?.flushNow();
  },
};

/** Generate a sortable, collision-safe id. */
export function newId(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return prefix ? `${prefix}_${rand}` : rand;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export { LocalStore, getLocalStore, resetLocalStoreSingleton };
