// An in-memory stand-in for the R2 bucket binding, just the calls
// worker/index.js makes: put, get, head, list, delete. Shared by the Node
// tests and the browser suite, which routes /api/* through the real Worker
// code. `list` pages two at a time so the Worker's paging is exercised.
export function fakeR2() {
  const store = new Map();
  const obj = (key, v) => ({
    key,
    size: v.text.length,
    customMetadata: v.meta,
    body: v.text,
    text: async () => v.text,
    json: async () => JSON.parse(v.text),
  });
  return {
    store,
    async put(key, text, opts = {}) {
      store.set(key, { text: String(text), meta: opts.customMetadata || {} });
    },
    async get(key) {
      const v = store.get(key);
      return v ? obj(key, v) : null;
    },
    async head(key) {
      const v = store.get(key);
      return v ? obj(key, v) : null;
    },
    async delete(keys) {
      for (const k of [].concat(keys)) store.delete(k);
    },
    async list({ prefix = "", delimiter, cursor } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const entries = [];
      const prefixes = new Set();
      for (const k of keys) {
        const rest = k.slice(prefix.length);
        const cut = delimiter ? rest.indexOf(delimiter) : -1;
        if (cut >= 0) {
          const p = prefix + rest.slice(0, cut + delimiter.length);
          if (!prefixes.has(p)) (prefixes.add(p), entries.push({ prefix: p }));
        } else entries.push({ key: k });
      }
      const start = Number(cursor || 0);
      const page = entries.slice(start, start + 2);
      const truncated = start + 2 < entries.length;
      return {
        objects: page.filter((e) => e.key).map((e) => obj(e.key, store.get(e.key))),
        delimitedPrefixes: page.filter((e) => e.prefix).map((e) => e.prefix),
        truncated,
        ...(truncated ? { cursor: String(start + 2) } : {}),
      };
    },
  };
}
