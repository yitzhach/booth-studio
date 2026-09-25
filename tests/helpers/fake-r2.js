// An in-memory stand-in for the R2 bucket binding, just the calls
// worker/index.js makes: put, get, head. Shared by the Node tests and the
// browser suite, which routes /api/* through the real Worker code.
export function fakeR2() {
  const store = new Map();
  const obj = (v) => ({
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
      return v ? obj(v) : null;
    },
    async head(key) {
      const v = store.get(key);
      return v ? obj(v) : null;
    },
  };
}
