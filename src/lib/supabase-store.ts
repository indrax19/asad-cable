import { supabase } from "./supabase";

export const db = supabase;

type Filter = { field: string; value: unknown };
type CollectionRef = { table: string; filters: Filter[] };
type DocumentRef = { table: string; id: string };
type SnapshotDocument = { id: string; data: () => Record<string, unknown> };
type Snapshot = { docs: SnapshotDocument[]; exists: () => boolean; data: () => Record<string, unknown> | undefined; id: string };

type ArrayOperation = { type: "union" | "remove"; values: unknown[] };

const businessTables = new Set([
  "users",
  "areas",
  "packages",
  "payments",
  "payment_corrections",
  "dealer_recoveries",
  "payment_methods",
  "advertisements",
]);

function assertBusinessTable(table: string) {
  if (!businessTables.has(table)) throw new Error(`Unsupported Supabase table: ${table}`);
}

function matchesFilters(data: Record<string, unknown>, filters: Filter[]) {
  return filters.every(({ field, value }) => data[field] === value);
}

function snapshotDocument(id: string, data: Record<string, unknown>): SnapshotDocument {
  return { id, data: () => data };
}

function snapshotFromRows(rows: Array<{ id: string; data: Record<string, unknown> }>): Snapshot {
  const docs = rows.map((row) => snapshotDocument(row.id, row.data));
  const first = docs[0];
  return {
    docs,
    exists: () => Boolean(first),
    data: () => first?.data(),
    id: first?.id ?? "",
  };
}

async function loadCollection(ref: CollectionRef): Promise<Snapshot> {
  assertBusinessTable(ref.table);
  const pageSize = 1_000;
  const rows: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(ref.table)
      .select("id, data")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw error;

    const page = (data ?? []).map((row) => ({
      id: row.id as string,
      data: row.data as Record<string, unknown>,
    }));
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return snapshotFromRows(rows.filter((row) => matchesFilters(row.data, ref.filters)));
}

export function collection(_: typeof db, table: string): CollectionRef {
  assertBusinessTable(table);
  return { table, filters: [] };
}

export function doc(_: typeof db, table: string, id: string): DocumentRef {
  assertBusinessTable(table);
  return { table, id };
}

export function where(field: string, _: "==", value: unknown): Filter {
  return { field, value };
}

export function query(ref: CollectionRef, ...filters: Filter[]): CollectionRef {
  return { ...ref, filters: [...ref.filters, ...filters] };
}

export function arrayUnion(...values: unknown[]): ArrayOperation {
  return { type: "union", values };
}

export function arrayRemove(...values: unknown[]): ArrayOperation {
  return { type: "remove", values };
}

function resolveUpdate(
  current: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(updates).map(([field, value]) => {
      if (!value || typeof value !== "object" || !("type" in value)) return [field, value];
      const operation = value as ArrayOperation;
      const existing = Array.isArray(current[field]) ? current[field] : [];
      if (operation.type === "union") {
        return [field, [...new Set([...existing, ...operation.values])]];
      }
      return [field, existing.filter((item) => !operation.values.includes(item))];
    }),
  );
}

export async function getDoc(ref: DocumentRef): Promise<Snapshot> {
  const { data, error } = await supabase.from(ref.table).select("id, data").eq("id", ref.id).maybeSingle();
  if (error) throw error;
  return snapshotFromRows(data ? [{ id: data.id as string, data: data.data as Record<string, unknown> }] : []);
}

export async function getDocs(ref: CollectionRef): Promise<Snapshot> {
  return loadCollection(ref);
}

export async function setDoc(ref: DocumentRef, data: Record<string, unknown>) {
  const { error } = await supabase.from(ref.table).upsert({ id: ref.id, data });
  if (error) throw error;
}

export async function addDoc(ref: CollectionRef, data: Record<string, unknown>): Promise<DocumentRef> {
  const id = crypto.randomUUID();
  await setDoc(doc(db, ref.table, id), data);
  return doc(db, ref.table, id);
}

export async function updateDoc(ref: DocumentRef, updates: Record<string, unknown>) {
  const current = await getDoc(ref);
  if (!current.exists()) throw new Error("Document not found");
  const data = { ...current.data(), ...resolveUpdate(current.data() ?? {}, updates) };
  const { error } = await supabase.from(ref.table).update({ data }).eq("id", ref.id);
  if (error) throw error;
}

export async function deleteDoc(ref: DocumentRef) {
  const { error } = await supabase.from(ref.table).delete().eq("id", ref.id);
  if (error) throw error;
}

export function onSnapshot(ref: CollectionRef, callback: (snapshot: Snapshot) => void) {
  let active = true;
  const refresh = async () => {
    try {
      const snapshot = await loadCollection(ref);
      if (active) callback(snapshot);
    } catch (error) {
      console.error(`Failed to load ${ref.table}:`, error);
    }
  };

  void refresh();
  const channel = supabase
    .channel(`live:${ref.table}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: ref.table }, refresh)
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}
