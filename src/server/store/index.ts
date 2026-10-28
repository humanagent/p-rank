import fs from "node:fs";
import path from "node:path";
import type { Entry } from "@/shared/types";

export type Store = {
  put(e: Entry): Promise<void>;
  get(id: string): Promise<Entry | null>;
  list(): Promise<Entry[]>; // newest first
  listByEmail(email: string): Promise<Entry[]>; // newest first
  update(id: string, fn: (e: Entry) => Entry): Promise<Entry>; // throws if missing
  appendLog(id: string, step: string, msg: string): Promise<Entry>;
};

// The DynamoDB item's version is a storage detail; callers never see it.
function withoutVersion(item: Record<string, unknown>): Entry {
  const { _v, ...e } = item;
  void _v;
  return e as Entry;
}

const newestFirst =(a: Entry, b: Entry) => b.createdAt.localeCompare(a.createdAt);
const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function logLine(id: string, step: string, msg: string) {
  const at = new Date().toISOString();
  process.stdout.write(JSON.stringify({ at, entry: id, step, msg }) + "\n");
  return { at, step, msg };
}

// Local mode: a Map persisted to <dir>/entries.json, rewritten after every change.
export function createLocalStore(dir: string): Store {
  const file = path.join(dir, "entries.json");
  let map: Map<string, Entry> | null = null;

  const load = () => {
    if (map) return map;
    map = new Map();
    if (fs.existsSync(file)) {
      for (const e of JSON.parse(fs.readFileSync(file, "utf8")) as Entry[]) map.set(e.id, e);
    }
    return map;
  };
  const save = () => {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify([...load().values()], null, 2));
    fs.renameSync(tmp, file);
  };
  const clone = (e: Entry): Entry => structuredClone(e);

  const store: Store = {
    async put(e) {
      load().set(e.id, clone(e));
      save();
    },
    async get(id) {
      const e = load().get(id);
      return e ? clone(e) : null;
    },
    async list() {
      return [...load().values()].map(clone).sort(newestFirst);
    },
    async listByEmail(email) {
      return [...load().values()].filter((e) => sameEmail(e.email, email)).map(clone).sort(newestFirst);
    },
    async update(id, fn) {
      const cur = load().get(id);
      if (!cur) throw new Error(`entry ${id} not found`);
      const next = fn(clone(cur));
      load().set(id, clone(next));
      save();
      return clone(next);
    },
    async appendLog(id, step, msg) {
      const line = logLine(id, step, msg);
      return store.update(id, (e) => ({ ...e, log: [...(e.log ?? []), line] }));
    },
  };
  return store;
}

// Cloud mode: DynamoDB, pk `id`, the whole entry as attributes.
function createDynamoStore(table: string): Store {
  // Lazy imports so local mode never loads the AWS SDK.
  let docP: Promise<import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient> | null = null;
  const doc = () =>
    (docP ??= (async () => {
      const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
      const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
      const client = new DynamoDBClient({ region: process.env.AWS_REGION || "sa-east-1" });
      return DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
    })());
  const lib = () => import("@aws-sdk/lib-dynamodb");

  // Scan reads the whole table. Fine at this scale (one tournament, hundreds of entries);
  // a GSI on email / createdAt is the next step if it grows.
  const scanAll = async (): Promise<Entry[]> => {
    const { ScanCommand } = await lib();
    const out: Entry[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await (await doc()).send(new ScanCommand({ TableName: table, ExclusiveStartKey }));
      out.push(...(r.Items ?? []).map(withoutVersion));
      ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return out;
  };

  const store: Store = {
    async put(e) {
      const { PutCommand } = await lib();
      await (await doc()).send(new PutCommand({ TableName: table, Item: e }));
    },
    async get(id) {
      const { GetCommand } = await lib();
      const r = await (await doc()).send(new GetCommand({ TableName: table, Key: { id }, ConsistentRead: true }));
      return r.Item ? withoutVersion(r.Item) : null;
    },
    async list() {
      return (await scanAll()).sort(newestFirst);
    },
    async listByEmail(email) {
      return (await scanAll()).filter((e) => sameEmail(e.email, email)).sort(newestFirst);
    },
    // Compare-and-set: every item carries a version (_v); a write lands only if nobody wrote since we read it,
    // else re-read and re-apply fn. The 3 rate samples append log lines at the same time, so this matters.
    async update(id, fn) {
      const { GetCommand, PutCommand } = await lib();
      const client = await doc();
      for (let attempt = 0; attempt < 8; attempt++) {
        const r = await client.send(new GetCommand({ TableName: table, Key: { id }, ConsistentRead: true }));
        if (!r.Item) throw new Error(`entry ${id} not found`);
        const { _v, ...cur } = r.Item as Entry & { _v?: number };
        const next = fn(cur as Entry);
        try {
          await client.send(
            new PutCommand({
              TableName: table,
              Item: { ...next, _v: (_v ?? 0) + 1 },
              ConditionExpression: _v === undefined ? "attribute_not_exists(#v)" : "#v = :v",
              ExpressionAttributeNames: { "#v": "_v" },
              ...(_v === undefined ? {} : { ExpressionAttributeValues: { ":v": _v } }),
            }),
          );
          return next;
        } catch (err) {
          if ((err as { name?: string }).name !== "ConditionalCheckFailedException") throw err;
          await new Promise((res) => setTimeout(res, 20 + Math.random() * 80 * (attempt + 1)));
        }
      }
      throw new Error(`entry ${id}: too many concurrent writes`);
    },
    async appendLog(id, step, msg) {
      const line = logLine(id, step, msg);
      return store.update(id, (e) => ({ ...e, log: [...(e.log ?? []), line] }));
    },
  };
  return store;
}

const g = globalThis as unknown as { __prankStore?: Store };

function resolve(): Store {
  if (!g.__prankStore) {
    const table = process.env.CLIPS_BUCKET ? process.env.ENTRIES_TABLE : undefined;
    if (process.env.CLIPS_BUCKET && !table) throw new Error("ENTRIES_TABLE is required in cloud mode");
    g.__prankStore = table
      ? createDynamoStore(table)
      : createLocalStore(process.env.PRANK_DATA_DIR || path.join(process.cwd(), ".data"));
  }
  return g.__prankStore;
}

// Resolved on first call, so env is read at runtime, not at import.
export const store: Store = {
  put: (e) => resolve().put(e),
  get: (id) => resolve().get(id),
  list: () => resolve().list(),
  listByEmail: (email) => resolve().listByEmail(email),
  update: (id, fn) => resolve().update(id, fn),
  appendLog: (id, step, msg) => resolve().appendLog(id, step, msg),
};
