import { db } from "./index";
import type { Row, TableName } from "./schema";

/** Internal callers must establish tenant ownership before using a resource. */
export async function tenantById<T extends TableName>(organizationId: string, table: T, id: string): Promise<Row<T> | null> {
  const row = await db.byId(table, id);
  if (!row || !("organizationId" in row) || row.organizationId !== organizationId) return null;
  return row;
}
