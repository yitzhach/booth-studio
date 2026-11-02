// The types of src/vendor/studio-sdk.js, for the type check (TYPING_PHASE.md,
// task 6). Written by hand from Art-Talk-Back's packages/sdk/src (client.ts,
// store.ts, studio.ts), which the .js is built from; the .js itself is
// generated there and never edited here. The platform's own types (the
// shapes @studio/core's zod schemas give a signed-in person, a sync op and
// a sync answer) are loose here, because this repository does not have
// @studio/core. tests/studio-sdk-types.test.js imports the .js and fails
// when an export or a member named here is missing from it, so an SDK
// update that renames one is caught; a changed argument or answer is caught
// by tests/two-devices.mjs, which runs the real thing.

/** A signed-in person, as /auth/verify and /me answer (core's Me). */
export type Me = Record<string, any>;
/** One queued change, as /sync/push takes it (core's SyncOp). */
export type SyncOp = Record<string, any>;

export class ApiError extends Error {
  constructor(status: number, code: string, message: string, details?: unknown);
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
}

/** Thrown when the request never reached the server (offline, DNS, dropped connection). */
export class NetworkError extends Error {}

export interface ClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export class ApiClient {
  constructor(opts: ClientOptions);
  request<T = any>(method: string, path: string, opts?: { json?: unknown; headers?: Record<string, string> }): Promise<T>;
  requestCode: (email: string) => Promise<void>;
  verify: (email: string, code: string) => Promise<Me>;
  logout: () => Promise<void>;
  me: () => Promise<Me>;
  push: (ops: SyncOp[]) => Promise<any>;
  pull: (since: string, limit?: number) => Promise<any>;
}

export type RecordType = "artwork" | "client" | "show" | "show_artwork" | "sale" | "settings" | "file" | "placement";
export type LocalRecord = Record<string, unknown> & { id?: string; studioId?: string; version?: number; deletedAt?: string | null };

export interface Conflict {
  field: string;
  serverValue: unknown;
  deviceValue: unknown;
}

export interface StudioEvents {
  /** A "review change" card: the server kept its values for these fields. */
  conflict: { entityType: RecordType; entityId: string; conflicts: Conflict[]; record: LocalRecord | null };
  /** The server refused a queued change outright (e.g. the record was deleted elsewhere). */
  rejected: { entityType: RecordType; entityId: string; action: string; message: string };
  /** Local data changed (a write here, or a pull); re-render. */
  change: { types: RecordType[] };
  /** Online/offline as last seen by a sync attempt. */
  status: { online: boolean; pending: number };
}

export interface StudioOptions extends ClientOptions {
  /** IndexedDB database name; one per signed-in studio on a device. */
  dbName?: string;
  /** Background sync interval while started. */
  intervalMs?: number;
}

/** Ops per push: what one push answers. */
export const PUSH_BATCH: number;

export class Studio {
  private constructor(opts: StudioOptions);
  static open(opts: StudioOptions): Promise<Studio>;
  readonly api: ApiClient;
  online: boolean;
  get(type: RecordType, id: string): Promise<LocalRecord | null>;
  list(type: RecordType): Promise<LocalRecord[]>;
  pendingCount(): Promise<number>;
  create(type: RecordType, fields: LocalRecord): Promise<LocalRecord>;
  update(type: RecordType, id: string, patch: LocalRecord): Promise<LocalRecord>;
  remove(type: RecordType, id: string): Promise<void>;
  restore(type: RecordType, record: LocalRecord): Promise<LocalRecord>;
  markSold(artworkId: string, sale: { priceCents: number; showId?: string; clientId?: string; currency?: string }): Promise<any>;
  sync(): Promise<void>;
  start(intervalMs?: number): void;
  stop(): void;
  close(): void;
  on<K extends keyof StudioEvents>(event: K, fn: (e: StudioEvents[K]) => void): () => void;
}

export function applyPatch(base: LocalRecord, patch: LocalRecord): LocalRecord;
export function isId(value: unknown): value is string;
export function newId(): string;
