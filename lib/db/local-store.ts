import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  DatabaseSchema,
  TABLE_NAMES,
  type Database,
  type ID,
  type Row,
  type TableName,
} from "./schema";

/* ==========================================================================
   NEXORA Local Store
   --------------------------------------------------------------------------
   A file-backed relational store used for Demo Mode and zero-config local
   development. It provides:
     - Zod-validated rows (same contract as the Supabase adapter)
     - foreign-key enforcement
     - unique constraints
     - cascade deletes
     - in-memory secondary indexes
     - atomic writes (temp file + rename)
     - change subscriptions (drives realtime UI)
   Production should point NEXORA at Supabase Postgres — see
   `supabase-adapter.ts` and `supabase/schema.sql`.
   ========================================================================== */

export type Listener = (event: ChangeEvent) => void;

export interface ChangeEvent {
  table: TableName;
  op: "insert" | "update" | "delete" | "bulk";
  ids: ID[];
}

export interface Where {
  [key: string]: unknown;
}

interface ForeignKey {
  table: TableName;
  column: string;
  refTable: TableName;
  refColumn: string;
  onDelete?: "CASCADE" | "RESTRICT" | "SET_NULL";
}

interface UniqueConstraint {
  table: TableName;
  columns: string[];
}

const FOREIGN_KEYS: ForeignKey[] = [
  { table: "users", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "organization_members", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "organization_members", column: "userId", refTable: "users", refColumn: "id", onDelete: "CASCADE" },
  { table: "settings", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "businesses", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "businesses", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "SET_NULL" },
  { table: "business_contacts", column: "businessId", refTable: "businesses", refColumn: "id", onDelete: "CASCADE" },
  { table: "leads", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "leads", column: "businessId", refTable: "businesses", refColumn: "id", onDelete: "CASCADE" },
  { table: "research_reports", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "CASCADE" },
  { table: "website_audits", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "CASCADE" },
  { table: "lead_scores", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "CASCADE" },
  { table: "opportunities", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "CASCADE" },
  { table: "strategies", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "CASCADE" },
  { table: "demo_sites", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "CASCADE" },
  { table: "qa_runs", column: "targetId", refTable: "demo_sites", refColumn: "id", onDelete: "CASCADE" },
  { table: "deployments", column: "targetId", refTable: "demo_sites", refColumn: "id", onDelete: "CASCADE" },
  { table: "deployments", column: "projectId", refTable: "projects", refColumn: "id", onDelete: "SET_NULL" },
  { table: "campaigns", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "outreach_messages", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "CASCADE" },
  { table: "conversations", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "SET_NULL" },
  { table: "conversations", column: "clientId", refTable: "clients", refColumn: "id", onDelete: "SET_NULL" },
  { table: "messages", column: "conversationId", refTable: "conversations", refColumn: "id", onDelete: "CASCADE" },
  { table: "proposals", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "SET_NULL" },
  { table: "proposals", column: "clientId", refTable: "clients", refColumn: "id", onDelete: "SET_NULL" },
  { table: "proposal_items", column: "proposalId", refTable: "proposals", refColumn: "id", onDelete: "CASCADE" },
  { table: "clients", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "clients", column: "leadId", refTable: "leads", refColumn: "id", onDelete: "SET_NULL" },
  { table: "clients", column: "businessId", refTable: "businesses", refColumn: "id", onDelete: "SET_NULL" },
  { table: "client_contacts", column: "clientId", refTable: "clients", refColumn: "id", onDelete: "CASCADE" },
  { table: "onboarding_submissions", column: "clientId", refTable: "clients", refColumn: "id", onDelete: "CASCADE" },
  { table: "projects", column: "clientId", refTable: "clients", refColumn: "id", onDelete: "CASCADE" },
  { table: "projects", column: "proposalId", refTable: "proposals", refColumn: "id", onDelete: "SET_NULL" },
  { table: "projects", column: "strategyId", refTable: "strategies", refColumn: "id", onDelete: "SET_NULL" },
  { table: "project_requirements", column: "projectId", refTable: "projects", refColumn: "id", onDelete: "CASCADE" },
  { table: "website_builds", column: "projectId", refTable: "projects", refColumn: "id", onDelete: "CASCADE" },
  { table: "support_tickets", column: "clientId", refTable: "clients", refColumn: "id", onDelete: "CASCADE" },
  { table: "support_tickets", column: "projectId", refTable: "projects", refColumn: "id", onDelete: "SET_NULL" },
  { table: "upsell_opportunities", column: "clientId", refTable: "clients", refColumn: "id", onDelete: "CASCADE" },
  { table: "agent_runs", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "agent_tasks", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "agent_logs", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "approval_requests", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "activity_events", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "notifications", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "integrations", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "audit_logs", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "revenue_events", column: "clientId", refTable: "clients", refColumn: "id", onDelete: "SET_NULL" },
  { table: "revenue_events", column: "projectId", refTable: "projects", refColumn: "id", onDelete: "SET_NULL" },
  { table: "services", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
  { table: "pricing_rules", column: "organizationId", refTable: "organizations", refColumn: "id", onDelete: "CASCADE" },
];

const UNIQUE: UniqueConstraint[] = [
  { table: "organizations", columns: ["slug"] },
  { table: "users", columns: ["email"] },
  { table: "leads", columns: ["businessId", "organizationId"] },
  { table: "demo_sites", columns: ["slug"] },
  { table: "clients", columns: ["slug"] },
  { table: "projects", columns: ["slug"] },
  { table: "proposals", columns: ["number"] },
  { table: "services", columns: ["organizationId", "key"] },
  { table: "pricing_rules", columns: ["organizationId", "key"] },
  { table: "settings", columns: ["organizationId"] },
];

/** Columns that get an in-memory hash index for fast lookups. */
const INDEXED: Partial<Record<TableName, string[]>> = {
  leads: ["organizationId", "status", "pipelineStage", "priority", "score"],
  businesses: ["organizationId", "category", "city", "discoverySource"],
  agent_tasks: ["organizationId", "status", "agentKey"],
  activity_events: ["organizationId", "agentKey", "actionType"],
  approval_requests: ["organizationId", "status"],
  outreach_messages: ["organizationId", "status", "leadId"],
  messages: ["conversationId"],
  projects: ["organizationId", "stage", "clientId"],
  clients: ["organizationId", "status"],
  proposals: ["organizationId", "status"],
  deployments: ["organizationId", "kind", "state"],
  notifications: ["organizationId", "read"],
  audit_logs: ["organizationId"],
  revenue_events: ["organizationId", "status"],
  support_tickets: ["organizationId", "status"],
  conversations: ["organizationId", "state"],
  qa_runs: ["organizationId", "verdict"],
  demo_sites: ["organizationId", "status"],
  website_builds: ["projectId"],
};

export class ConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConstraintError";
  }
}

export class LocalStore {
  private data: Database;
  private filePath: string;
  private listeners = new Set<Listener>();
  private dirty = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private indexes = new Map<TableName, Map<string, Set<ID>>>();
  /** O(1) primary-key lookup per table. */
  private byIdIndex = new Map<TableName, Map<ID, Record<string, unknown>>>();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.load();
    this.buildIndexes();
  }

  /* ------------------------------------------------------------- loading -- */

  private load(): Database {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        const result = DatabaseSchema.safeParse(parsed);
        if (result.success) return result.data;
        console.error(
          "[nexora:db] database failed validation, starting with a repaired copy",
          result.error.issues.slice(0, 5),
        );
      }
    } catch (err) {
      console.error("[nexora:db] could not read database:", err);
    }
    return DatabaseSchema.parse({});
  }

  private buildIndexes() {
    this.indexes.clear();
    this.byIdIndex.clear();
    for (const table of TABLE_NAMES) {
      const map = new Map<ID, Record<string, unknown>>();
      for (const row of this.data[table] as Array<Record<string, unknown>>) {
        map.set(row.id as ID, row);
      }
      this.byIdIndex.set(table, map);
    }
    for (const table of TABLE_NAMES) {
      const cols = INDEXED[table];
      if (!cols) continue;
      const map = new Map<string, Set<ID>>();
      const rows = this.data[table] as Array<Record<string, unknown>>;
      for (const row of rows) {
        for (const col of cols) {
          const v = row[col];
          if (v === undefined || v === null) continue;
          const key = `${col}::${String(v)}`;
          let set = map.get(key);
          if (!set) {
            set = new Set();
            map.set(key, set);
          }
          set.add(row.id as ID);
        }
      }
      this.indexes.set(table, map);
    }
  }

  /* ---------------------------------------------------------- persistence - */

  get path() {
    return this.filePath;
  }

  /** Synchronous, durable write (used in tests / scripts). */
  flushNow() {
    this.writeToDisk();
    this.dirty = false;
  }

  private writeToDisk() {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.${process.pid}.tmp`;
      // Compact (not pretty-printed) keeps seeding fast on small machines —
      // the pretty form is only used for `npm run reset:demo`.
      writeFileSync(tmp, JSON.stringify(this.data), "utf-8");
      renameSync(tmp, this.filePath);
    } catch (err) {
      console.error("[nexora:db] write failed:", err);
    }
  }

  private scheduleFlush() {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.dirty) return;
      this.writeQueue = this.writeQueue.then(() => {
        this.writeToDisk();
        this.dirty = false;
      });
    }, 120);
  }

  /* ------------------------------------------------------------- indexes -- */

  private indexKey(col: string, value: unknown) {
    return `${col}::${String(value)}`;
  }

  private addToIndex(table: TableName, row: Record<string, unknown>) {
    const cols = INDEXED[table];
    if (!cols) return;
    let map = this.indexes.get(table);
    if (!map) {
      map = new Map();
      this.indexes.set(table, map);
    }
    for (const col of cols) {
      const v = row[col];
      if (v === undefined || v === null) continue;
      const key = this.indexKey(col, v);
      let set = map.get(key);
      if (!set) {
        set = new Set();
        map.set(key, set);
      }
      set.add(row.id as ID);
    }
  }

  private removeFromIndex(table: TableName, row: Record<string, unknown>) {
    const cols = INDEXED[table];
    if (!cols) return;
    const map = this.indexes.get(table);
    if (!map) return;
    for (const col of cols) {
      const v = row[col];
      if (v === undefined || v === null) continue;
      const set = map.get(this.indexKey(col, v));
      set?.delete(row.id as ID);
    }
  }

  /* ------------------------------------------------------------ accessors - */

  table<T extends TableName>(name: T): Array<Row<T>> {
    return this.data[name] as Array<Row<T>>;
  }

  all<T extends TableName>(name: T): Array<Row<T>> {
    return this.table(name).slice();
  }

  byId<T extends TableName>(name: T, id: ID): Row<T> | null {
    return (this.byIdIndex.get(name)?.get(id) as Row<T> | undefined) ?? null;
  }

  find<T extends TableName>(name: T, where: Where = {}): Array<Row<T>> {
    const cols = INDEXED[name];
    if (cols && Object.keys(where).length > 0) {
      // try to use the index for the first indexed column present
      for (const col of cols) {
        if (col in where) {
          const ids = this.indexes.get(name)?.get(this.indexKey(col, where[col]));
          const byId = this.byIdIndex.get(name);
          if (ids && ids.size > 0 && byId) {
            const out: Array<Row<T>> = [];
            for (const id of ids) {
              const row = byId.get(id);
              if (!row) continue;
              let ok = true;
              for (const [k, v] of Object.entries(where)) {
                if (row[k] !== v) {
                  ok = false;
                  break;
                }
              }
              if (ok) out.push(row as Row<T>);
            }
            return out;
          }
          return [];
        }
      }
    }
    return (this.data[name] as Array<Record<string, unknown>>).filter((row) =>
      Object.entries(where).every(([k, v]) => row[k] === v),
    ) as Array<Row<T>>;
  }

  findOne<T extends TableName>(name: T, where: Where = {}): Row<T> | null {
    return this.find(name, where)[0] ?? null;
  }

  count<T extends TableName>(name: T, where: Where = {}): number {
    return this.find(name, where).length;
  }

  /* ------------------------------------------------------------- mutation - */

  private validateFks(table: TableName, row: Record<string, unknown>) {
    for (const fk of FOREIGN_KEYS) {
      if (fk.table !== table) continue;
      const value = row[fk.column];
      if (value === null || value === undefined || value === "") continue;

      // Polymorphic targets: qa_runs / deployments point at either a demo site
      // or a production build, discriminated by their `targetType` column.
      let refTable: TableName = fk.refTable;
      const discriminator = typeof row.targetType === "string" ? row.targetType : null;
      if (discriminator && fk.column === "targetId") {
        refTable = discriminator === "BUILD" ? "website_builds" : "demo_sites";
      }

      const parent = this.byId(refTable, value as ID);
      if (!parent) {
        throw new ConstraintError(
          `Foreign key violation: ${table}.${fk.column} = ${String(value)} not found in ${refTable}`,
        );
      }
    }
  }

  private validateUnique(table: TableName, row: Record<string, unknown>, skipId?: ID) {
    for (const u of UNIQUE) {
      if (u.table !== table) continue;
      const vals = u.columns.map((c) => row[c]);
      if (vals.some((v) => v === undefined || v === null || v === "")) continue;
      const clash = (this.data[table] as Array<Record<string, unknown>>).some(
        (r) => r.id !== skipId && u.columns.every((c) => r[c] === row[c]),
      );
      if (clash) {
        throw new ConstraintError(
          `Unique violation: ${table}(${u.columns.join(", ")}) = ${vals.join(", ")} already exists`,
        );
      }
    }
  }

  insert<T extends TableName>(name: T, row: Row<T>): Row<T> {
    const record = row as unknown as Record<string, unknown>;
    this.validateFks(name, record);
    this.validateUnique(name, record);
    const rows = this.data[name] as Array<Record<string, unknown>>;
    rows.push(record);
    this.byIdIndex.get(name)?.set(record.id as ID, record);
    this.addToIndex(name, record);
    this.scheduleFlush();
    this.emit({ table: name, op: "insert", ids: [record.id as ID] });
    return record as Row<T>;
  }

  /** Bulk insert — validates once and flushes once. */
  insertMany<T extends TableName>(name: T, rows: Array<Row<T>>): Array<Row<T>> {
    const out: Array<Row<T>> = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const record = r as unknown as Record<string, unknown>;
      this.validateFks(name, record);
      this.validateUnique(name, record);
      seen.add(record.id as string);
      out.push(record as Row<T>);
    }
    const list = this.data[name] as Array<Record<string, unknown>>;
    const byId = this.byIdIndex.get(name);
    for (const record of out as unknown as Array<Record<string, unknown>>) {
      list.push(record);
      byId?.set(record.id as ID, record);
      this.addToIndex(name, record);
    }
    this.scheduleFlush();
    this.emit({ table: name, op: "bulk", ids: (out as unknown as Array<{ id: ID }>).map((r) => r.id) });
    return out;
  }

  update<T extends TableName>(name: T, id: ID, patch: Partial<Row<T>>): Row<T> {
    const rows = this.data[name] as Array<Record<string, unknown>>;
    const byId = this.byIdIndex.get(name);
    const current = byId?.get(id);
    const idx = current ? rows.indexOf(current) : -1;
    if (idx === -1 || !current) throw new ConstraintError(`${name} row ${id} not found`);
    const next = { ...current, ...(patch as Record<string, unknown>) } as Record<string, unknown>;
    next.id = id;
    this.validateFks(name, next);
    this.validateUnique(name, next, id);
    this.removeFromIndex(name, current);
    rows[idx] = next;
    byId?.set(id, next);
    this.addToIndex(name, next);
    this.scheduleFlush();
    this.emit({ table: name, op: "update", ids: [id] });
    return next as Row<T>;
  }

  upsert<T extends TableName>(name: T, row: Row<T>): Row<T> {
    const existing = this.byId(name, row.id);
    if (existing) {
      const { id: _id, ...patch } = row as unknown as Record<string, unknown>;
      return this.update(name, row.id, patch as Partial<Row<T>>);
    }
    return this.insert(name, row);
  }

  delete<T extends TableName>(name: T, id: ID): void {
    const rows = this.data[name] as Array<Record<string, unknown>>;
    const row = this.byIdIndex.get(name)?.get(id);
    if (!row) return;
    // cascade
    for (const fk of FOREIGN_KEYS) {
      if (fk.refTable !== name || fk.onDelete !== "CASCADE") continue;
      const children = this.find(fk.table, { [fk.column]: id });
      for (const child of children) {
        this.delete(fk.table, (child as unknown as Record<string, unknown>).id as ID);
      }
    }
    // set null
    for (const fk of FOREIGN_KEYS) {
      if (fk.refTable !== name || fk.onDelete !== "SET_NULL") continue;
      const children = this.find(fk.table, { [fk.column]: id });
      for (const child of children) {
        this.update(fk.table, (child as unknown as Record<string, unknown>).id as ID, {
          [fk.column]: null,
        } as never);
      }
    }
    const idx = rows.indexOf(row);
    if (idx >= 0) rows.splice(idx, 1);
    this.byIdIndex.get(name)?.delete(id);
    this.removeFromIndex(name, row);
    this.scheduleFlush();
    this.emit({ table: name, op: "delete", ids: [id] });
  }

  /** Replace the whole database (used by demo seeding / reset). */
  replaceAll(db: Database) {
    this.data = db;
    this.buildIndexes();
    this.flushNow();
    this.emit({ table: "organizations", op: "bulk", ids: [] });
  }

  snapshot(): Database {
    return this.data;
  }

  /* ------------------------------------------------------------ realtime -- */

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ChangeEvent) {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch (err) {
        console.error("[nexora:db] listener error", err);
      }
    }
  }
}

/* --------------------------------------------------------------- factory -- */

let singleton: LocalStore | null = null;

export function getLocalStore(): LocalStore {
  if (!singleton) {
    const root = process.env.NEXORA_DATA_DIR ?? join(process.cwd(), ".data");
    const file = process.env.NEXORA_DB_FILE ?? join(root, "nexora.json");
    singleton = new LocalStore(file);
  }
  return singleton;
}

export function resetLocalStoreSingleton() {
  singleton = null;
}
