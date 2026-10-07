// The studio assistant in Booth Studio (Art-Talk-Back phase-5-booth.md 9c).
//
// A button that opens a chat panel. The artist asks in words — "make this a
// 10 × 15 art-show booth with a table and two chairs", "hang the back wall at
// 60″", "lay out the show: two rows of eight 10 × 10s" — and the reply streams
// in from studio-assistant (/assistant/chat on this origin). Anything that
// changes a booth comes back as a confirm card listing each change in plain
// words: nothing is written until the artist taps Confirm, every saved change
// has Undo, and a confirmed change reaches the screen through the studio's
// sync (src/studio.js), like an edit from another device.
//
// The Show Tracker's panel (art-show-tracker branch claude/assistant-panel),
// as an ES module wired to this app's studio bridge instead of ASTStudio. The
// open booth goes with each message as the chat's `record`, so "this booth"
// means the one on screen.
//
// Shown only while signed in to the studio and only where this copy of Booth
// Studio has an assistant (GET /assistant/status, answered by worker/index.js):
// staging has one; production has none until "Deploy production assistant"
// has run (Art-Talk-Back D-068). Loaded only when signed in, like studio.js.
// Text from the model or the studio is shown as text, never as markup.
import { readSession } from "./studio-session.js";

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") n.textContent = v;
    else if (k === "hidden") n.hidden = !!v;
    else n.setAttribute(k, v);
  }
  for (const c of kids) if (c) n.appendChild(c);
  return n;
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(data?.error?.message || `The studio answered ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}
const getJSON = (url) => fetch(url, { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null));
/** The text the person typed, without the context line the assistant adds. */
export function plainText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text")
    .map((b) => String(b.text).replace(/^\[Context from the app[^\]]*\]\s*/, "").replace(/\s*\[\[replies:[^\]]*\]\]\s*$/, "").replace(PICTURE_NOTE, "(picture)"))
    .filter(Boolean)
    .join("\n")
    .replace(/\(picture\)\n\((pictures?) attached\)$/, "($1)")
    .trim();
}

/* The note studio-assistant stores where a picture was (Art-Talk-Back D-071): pictures aren't kept. */
const PICTURE_NOTE = /^\[The artist attached a picture here[^\]]*\]$/;

/**
 * The studio's sync states (src/studio.js setStatus) that mean the booth on
 * screen isn't in the studio as it is now, in words the assistant passes on.
 */
const SYNC_NOTES = {
  local: "not in the studio yet: it was made before signing in and waits for Export → Keep your work → Studio account & sync → Import my existing projects",
  syncing: "still being saved to the studio; a moment",
  offline: "offline: changes are kept on this device and reach the studio when the connection is back",
  uploading: "its images are still uploading to the studio",
  waiting: "saved to the studio, its images still on the way",
  gone: "deleted from the studio; this copy stays on this device only",
  refused: "the studio refused this version; Studio account & sync says why",
  too_big: "too large to save to the studio; Studio account & sync says why",
  expired: "the studio sign-in ended; sign in again from Studio account & sync",
  error: "couldn't reach the studio last try; Studio account & sync has Sync now",
};

/** The long side the model reads a picture at full detail; larger is only slower to send. */
export const PICTURE_EDGE = 1568;
export const MAX_PICTURES = 3;

/** Width and height that fit inside PICTURE_EDGE, keeping the shape; never enlarged. */
export function fitPicture(w, h, edge = PICTURE_EDGE) {
  const k = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** A picture the artist picked, shrunk to a JPEG: { mediaType, data (base64), url (for the preview) }. */
async function shrinkPicture(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { w, h } = fitPicture(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  g.fillStyle = "#fff"; // transparent PNGs become white, not black
  g.fillRect(0, 0, w, h);
  g.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: url.slice(url.indexOf(",") + 1), url, w, h };
}

/*
 * Finish-my-sentence, from this device only: what the artist sent before (the
 * whole message) and names in the booth (works, furniture, the booth itself).
 * The last one to four words typed are matched against the start of a name.
 */
export function completion(text, said, names) {
  if (!text || /\s$/.test(text)) return null;
  const low = text.toLowerCase();
  if (text.length >= 4) {
    for (const s of said) if (s.length > text.length && s.toLowerCase().startsWith(low)) return text + s.slice(text.length);
  }
  let starts = [];
  for (let i = 0; i < text.length; i++) if (!/\s/.test(text[i]) && (i === 0 || /\s/.test(text[i - 1]))) starts.push(i);
  starts = starts.slice(-4);
  for (const i of starts) {
    const tail = text.slice(i), t = tail.toLowerCase();
    if (t.length < 2) continue;
    for (const n of names) if (n.length > tail.length && n.toLowerCase().startsWith(t)) return text.slice(0, i) + n;
  }
  return null;
}
const SAID_KEY = "booth.assistantSaid";
function readSaid() {
  try {
    const a = JSON.parse(localStorage.getItem(SAID_KEY) || "[]");
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function rememberSaid(text) {
  try {
    const a = readSaid().filter((x) => x !== text);
    a.unshift(text);
    localStorage.setItem(SAID_KEY, JSON.stringify(a.slice(0, 40)));
  } catch {}
}

const CSS = [
  "*,*::before,*::after{box-sizing:border-box}",
  // Above the footer, clear of the library on the left.
  ":host{position:fixed;right:16px;bottom:44px;z-index:1900;font:inherit;color:#171717}",
  ":host([hidden]){display:none}",
  ".launch{font:inherit;font-size:14px;font-weight:600;padding:9px 15px;border-radius:999px;border:1px solid #d9d9d9;background:#fff;color:inherit;box-shadow:0 6px 24px rgba(0,0,0,.18);cursor:pointer}",
  ".panel{position:fixed;right:16px;bottom:92px;width:min(420px,calc(100vw - 32px));max-height:min(70vh,640px);display:flex;flex-direction:column;background:#fff;border:1px solid #e5e5e5;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.2)}",
  ".panel[hidden]{display:none}",
  "header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #e5e5e5}",
  "h2{margin:0;font-size:15px}",
  ".tools{display:flex;align-items:center;gap:4px}",
  "button.small{font-size:13px;padding:4px 10px}",
  ".close{font:inherit;font-size:20px;line-height:1;border:none;background:none;color:inherit;cursor:pointer;padding:4px 8px}",
  ".log{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;font-size:15px;line-height:1.45}",
  ".msg{margin:0;max-width:90%;padding:8px 11px;border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere}",
  ".me{align-self:flex-end;background:#eef2ff;color:#1e1b4b}",
  ".bot{align-self:flex-start;background:#f5f5f5}",
  ".bot.thinking{color:#737373}",
  ".card{border:1px solid #e5e5e5;border-radius:10px;padding:10px 12px;background:#fff}",
  ".card h3{margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#737373}",
  ".card .sum{margin:0 0 6px;font-weight:600}",
  ".card dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:14px}",
  ".card dt{color:#737373}.card dd{margin:0;overflow-wrap:anywhere}",
  ".row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}",
  "button.btn{font:inherit;font-size:15px;padding:8px 14px;border-radius:8px;border:1px solid #d9d9d9;background:#fff;color:inherit;cursor:pointer}",
  "button.primary{background:#171717;color:#fff;border-color:transparent}",
  "button[disabled]{opacity:.55;cursor:default}",
  ".status{margin:6px 0 0;font-size:14px}",
  ".picks,.replies{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}",
  ".picks[hidden],.replies[hidden]{display:none}",
  ".replies .hint{width:100%;margin:0;font-size:12px;color:#737373}",
  "form{display:flex;gap:8px;padding:10px 14px;border-top:1px solid #e5e5e5}",
  // 16px or iOS zooms in on focus and never zooms back out.
  ".compose{position:relative;flex:1;display:flex;border-radius:8px;background:#fff}",
  ".ghost,textarea{font:inherit;font-size:16px;line-height:1.4;padding:8px 10px;border:1px solid transparent;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}",
  ".ghost{position:absolute;inset:0;overflow:hidden;pointer-events:none;color:transparent}",
  ".ghost .hint{color:#9a9a9a}",
  "textarea{position:relative;flex:1;resize:none;border-color:#d9d9d9;background:transparent;color:inherit}",
  ".long{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 14px 8px;padding:8px 10px;border-radius:8px;border:1px solid #e5e5e5;font-size:14px}",
  ".long[hidden]{display:none}",
  ".long p{margin:0;flex:1 1 200px}",
  "button.past{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;margin-top:6px;text-align:left}",
  "button.past small{color:#737373;font-size:12px}",
  ".note{margin:0;padding:0 14px 10px;font-size:14px;color:#b45309}",
  ".note[hidden]{display:none}",
  ".attach{flex:none;padding:0 10px;font-size:18px}",
  ".pics{display:flex;gap:8px;padding:8px 14px 0;flex-wrap:wrap}",
  ".pics[hidden]{display:none}",
  ".pic{position:relative}",
  ".pic img,.msg img{display:block;width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #e5e5e5}",
  ".msg img{margin-bottom:4px}",
  ".pic button{position:absolute;top:-6px;right:-6px;width:22px;height:22px;padding:0;border-radius:11px;line-height:1;font-size:14px}",
  "@media (max-width:600px){:host{bottom:12px;right:12px}.panel{left:0;right:0;bottom:0;width:100%;max-height:80vh;border-radius:12px 12px 0 0}}",
].join("");

/** A long chat costs more per message (all of it is sent each time): past this, offer a new one. */
const LONG_CHAT = 8;

class Panel extends HTMLElement {
  connectedCallback() {
    if (this._built) return;
    this._built = true;
    const root = this.attachShadow({ mode: "open" });
    root.appendChild(el("style", { text: CSS }));
    this.launch = el("button", { class: "launch", type: "button", "aria-expanded": "false", "aria-controls": "panel", text: "Ask the assistant" });
    this.log = el("div", { class: "log", role: "log", "aria-live": "polite" });
    this.picks = el("div", { class: "picks", hidden: true });
    this.input = el("textarea", { rows: "2", "aria-label": "Message to the assistant", placeholder: "e.g. make this a 10 × 15 art-show booth with a table and two chairs" });
    this.sendBtn = el("button", { class: "btn primary", type: "submit", text: "Send" });
    // A photo, sketch or show map goes with the next message (10a).
    this.file = el("input", { type: "file", accept: "image/*", multiple: "", hidden: true });
    this.attachBtn = el("button", { class: "btn attach", type: "button", "aria-label": "Attach a picture", title: "Attach a photo, sketch or show map", text: "📷" });
    this.pics = el("div", { class: "pics", hidden: true });
    this.pictures = [];
    this.note = el("p", { class: "note", role: "status", hidden: true });
    const close = el("button", { class: "close", type: "button", "aria-label": "Close the assistant", text: "×" });
    const fresh = el("button", { class: "btn small", type: "button", text: "New chat" });
    const past = el("button", { class: "btn small", type: "button", text: "Past chats" });
    const restart = el("button", { class: "btn small", type: "button", text: "Start a new chat" });
    this.long = el("div", { class: "long", hidden: true }, [
      el("p", { text: "This chat is getting long, and every message re-sends all of it. A new chat costs less; this one stays in Past chats." }),
      restart,
    ]);
    this.ghost = el("div", { class: "ghost", "aria-hidden": "true" });
    this.replies = el("div", { class: "replies", hidden: true });
    const form = el("form", {}, [this.attachBtn, this.file, el("div", { class: "compose" }, [this.ghost, this.input]), this.sendBtn]);
    this.said = readSaid();
    this.names = [];
    this.panel = el("section", { class: "panel", id: "panel", role: "dialog", "aria-label": "Studio assistant", hidden: true }, [
      el("header", {}, [el("h2", { text: "Studio assistant" }), el("div", { class: "tools" }, [past, fresh, close])]),
      this.log, this.long, this.picks, this.replies, this.note, this.pics, form,
    ]);
    root.appendChild(this.launch);
    root.appendChild(this.panel);

    this.launch.addEventListener("click", () => this.toggle());
    close.addEventListener("click", () => this.toggle(false));
    // Forget the conversation (the model starts clean); saved changes stay saved.
    const startNew = () => {
      if (this.busy) return;
      this.clear();
      this.fresh = true;
      this.say("bot", "New chat. What would you like to do with your booth?");
      this.input.focus();
    };
    fresh.addEventListener("click", startNew);
    restart.addEventListener("click", startNew);
    past.addEventListener("click", () => !this.busy && this.listPast());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.send(this.input.value);
    });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.send(this.input.value);
        return;
      }
      // Tab takes the grey suggestion, or else the next suggested reply.
      if (e.key === "Tab" && !e.shiftKey && this.tab()) e.preventDefault();
    });
    this.input.addEventListener("input", () => this.hint());
    this.attachBtn.addEventListener("click", () => this.file.click());
    this.file.addEventListener("change", () => {
      const files = [...this.file.files];
      this.file.value = "";
      this.addPictures(files);
    });
    this.input.addEventListener("scroll", () => (this.ghost.scrollTop = this.input.scrollTop));
    this.paint();
  }

  /** Wired by mount(): the studio bridge and main.js's side. */
  attach(bridge, host, available) {
    this.bridge = bridge;
    this.host = host;
    this.available = available;
    bridge.onStatus(() => this.paint());
    this.paint();
  }

  /** Shown only while signed in (and not signed out by the studio) where an assistant exists. */
  paint() {
    const s = readSession();
    this.hidden = !this.available || !s || !!s.expired;
    if (this.hidden) this.toggle(false);
  }

  clear() {
    this.log.textContent = "";
    this.picks.hidden = true;
    this.replies.hidden = true;
    this.replyItems = [];
    this.long.hidden = true;
    this.turns = 0;
    this.threadId = null;
    this.fresh = false;
    this.setNote("");
  }

  count(n) {
    this.turns = (this.turns || 0) + n;
    this.long.hidden = this.turns < LONG_CHAT;
  }

  show(t) {
    let n = 0;
    for (const m of (t?.messages || []).slice(-12)) {
      const text = plainText(m.content);
      if (text) this.say(m.role === "user" ? "me" : "bot", text);
      if (m.role === "user" && text) n++;
      if (m.role === "user" && text.length >= 8 && !this.said.includes(text)) this.said.push(text);
    }
    this.count(n);
  }

  async listPast() {
    this.clear();
    const box = el("div", { class: "card" }, [el("h3", { text: "Past chats" })]);
    this.log.appendChild(box);
    const status = el("p", { class: "status", text: "Loading…" });
    box.appendChild(status);
    try {
      const d = await getJSON("/v1/assistant/threads");
      const items = d?.items || [];
      status.textContent = items.length ? "" : "No chats yet.";
      for (const it of items) {
        const when = new Date(it.lastAt);
        const b = el("button", { class: "btn past", type: "button" }, [
          el("span", { text: it.title }),
          el("small", { text: `${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${it.messages} messages` }),
        ]);
        b.addEventListener("click", () => this.openPast(it.threadId));
        box.appendChild(b);
      }
    } catch {
      status.textContent = "Couldn’t load past chats. Try again with a connection.";
    }
  }

  async openPast(id) {
    const t = await getJSON(`/v1/assistant/thread?id=${encodeURIComponent(id)}`).catch(() => null);
    if (!t) return this.setNote("That chat could not be opened.");
    this.clear();
    this.threadId = id;
    this.show(t);
    this.say("bot", "This is an earlier chat. Send a message to carry on with it, or tap New chat.");
  }

  /** Names from the booth on screen, for finish-my-sentence. */
  loadNames() {
    const p = this.host?.project();
    if (!p) return;
    const seen = new Set();
    const out = [];
    for (const n of [p.name, ...(p.art || []).map((a) => a.title), ...(p.booth?.pedestals || []).map((x) => x.name), ...(p.booth?.panels || []).map((x) => x.name)]) {
      const s = String(n || "").trim();
      if (s.length > 2 && !seen.has(s.toLowerCase())) {
        seen.add(s.toLowerCase());
        out.push(s);
      }
    }
    this.names = out;
  }

  hint() {
    const v = this.input.value;
    const atEnd = this.input.selectionStart === v.length;
    this.suggestion = atEnd ? completion(v, this.said, this.names) : null;
    this.ghost.textContent = "";
    if (!this.suggestion) return;
    this.ghost.appendChild(document.createTextNode(v));
    this.ghost.appendChild(el("span", { class: "hint", text: this.suggestion.slice(v.length) }));
    this.ghost.scrollTop = this.input.scrollTop;
  }

  fill(text) {
    this.input.value = text;
    this.input.focus();
    this.input.setSelectionRange(text.length, text.length);
    this.hint();
  }

  tab() {
    if (this.suggestion) {
      this.fill(this.suggestion);
      return true;
    }
    const items = this.replyItems || [];
    if (this.replies.hidden || !items.length) return false;
    const v = this.input.value.trim();
    if (v && !items.includes(v)) return false;
    this.fill(items[(items.indexOf(v) + 1) % items.length]);
    return true;
  }

  offerReplies(items) {
    this.replyItems = items;
    this.replies.textContent = "";
    for (const t of items) {
      const b = el("button", { class: "btn", type: "button", text: t });
      b.addEventListener("click", () => this.fill(t));
      this.replies.appendChild(b);
    }
    this.replies.appendChild(el("p", { class: "hint", text: "Tab puts the first one in the box; Tab again for the next." }));
    this.replies.hidden = false;
  }

  toggle(open) {
    if (!this.panel) return;
    open = open === undefined ? this.panel.hidden : open;
    this.panel.hidden = !open;
    this.launch.setAttribute("aria-expanded", String(open));
    if (open) {
      this.input.focus();
      if (!this._loaded) {
        this._loaded = true;
        void this.load();
      }
      this.loadNames();
    }
  }

  say(who, text) {
    const p = el("p", { class: `msg ${who}`, text: text || "" });
    this.log.appendChild(p);
    this.log.scrollTop = this.log.scrollHeight;
    return p;
  }

  setNote(text) {
    this.note.textContent = text || "";
    this.note.hidden = !text;
  }

  /** The conversation so far (any device) and the cards still waiting. */
  async load() {
    if (!navigator.onLine) return;
    try {
      this.show(await getJSON("/v1/assistant/thread"));
      const list = await getJSON("/v1/assistant/proposals?status=all");
      const now = new Date().toISOString(), since = new Date(Date.now() - 12 * 3600e3).toISOString();
      for (const p of (list?.items || []).slice().reverse()) {
        if (p.status === "pending" && p.expiresAt > now) this.card(p);
        else if (p.status === "confirmed" && p.activityId && p.updatedAt > since) this.saved(p);
      }
    } catch {}
  }

  /** The booth on screen, as the chat's record: "this booth" is the one the artist is looking at. */
  async record() {
    try {
      const id = await this.bridge?.placementId();
      const p = this.host?.project();
      if (!id) return undefined;
      const record = { type: "placement", id, label: String(p?.name || "Booth").slice(0, 200) };
      // Whether the studio has this booth yet, so the assistant can say what to tap instead of "it doesn't exist".
      const note = SYNC_NOTES[this.bridge?.status?.()];
      if (note) record.note = note;
      return record;
    } catch {
      return undefined;
    }
  }

  /** Shrinks and previews picked pictures, up to MAX_PICTURES; each has a × to take it off. */
  async addPictures(files) {
    this.setNote("");
    for (const f of files) {
      if (this.pictures.length >= MAX_PICTURES) {
        this.setNote(`Up to ${MAX_PICTURES} pictures with one message.`);
        break;
      }
      if (!/^image\//.test(f.type)) continue;
      try {
        this.pictures.push(await shrinkPicture(f));
      } catch {
        this.setNote("That picture couldn’t be opened. Try a JPEG or PNG.");
      }
    }
    this.paintPictures();
    this.input.focus();
  }

  paintPictures() {
    this.pics.textContent = "";
    this.pictures.forEach((p, i) => {
      const x = el("button", { class: "btn", type: "button", "aria-label": `Remove picture ${i + 1}`, text: "×" });
      x.addEventListener("click", () => {
        this.pictures.splice(i, 1);
        this.paintPictures();
      });
      this.pics.appendChild(el("div", { class: "pic" }, [el("img", { src: p.url, alt: `Picture ${i + 1} to send` }), x]));
    });
    this.pics.hidden = !this.pictures.length;
  }

  async send(text) {
    text = String(text || "").trim();
    if ((!text && !this.pictures.length) || this.busy) return;
    this.setNote("");
    if (!navigator.onLine) {
      this.setNote("The assistant needs a connection. Everything else in Booth Studio works offline as usual.");
      return;
    }
    this.busy = true;
    this.sendBtn.disabled = true;
    this.input.value = "";
    this.hint();
    this.picks.hidden = true;
    this.picks.textContent = "";
    this.replies.hidden = true;
    this.replyItems = [];
    if (text.length >= 8) {
      rememberSaid(text);
      this.said = readSaid();
    }
    let gotReplies = false, started = false, acted = false, lastSearch = null;
    const pictures = this.pictures;
    this.pictures = [];
    this.paintPictures();
    const mine = this.say("me", text);
    for (const p of pictures.slice().reverse()) mine.prepend(el("img", { src: p.url, alt: "Picture sent" }));
    const bubble = this.say("bot thinking", "Thinking…");
    const write = (t) => {
      if (!started) {
        started = true;
        bubble.textContent = "";
        bubble.className = "msg bot";
      }
      bubble.textContent += t;
      this.log.scrollTop = this.log.scrollHeight;
    };
    const handle = (e) => {
      if (e.type === "text") write(e.text);
      else if (e.type === "search") lastSearch = e.items;
      else if (e.type === "card") {
        acted = true;
        this.card(e.proposal);
      } else if (e.type === "replies") {
        gotReplies = true;
        this.offerReplies(e.items || []);
      } else if (e.type === "done") {
        acted = true;
        this.done(e);
      } else if (e.type === "end") {
        if (e.reason === "refusal") write(started ? "" : "I can’t help with that one.");
        else if (e.reason === "error") write(`${started ? "\n" : ""}Something went wrong, and nothing more was saved. Try again in a moment.${e.message ? `\n(${String(e.message).slice(0, 300)})` : ""}`);
        else if (e.reason === "max_tokens" || e.reason === "step_limit") write(`${started ? "\n" : ""}(I stopped there.)`);
        if (!started) bubble.remove();
        // A name that matched several records: offer them as buttons.
        if (!acted && !gotReplies && lastSearch && lastSearch.length > 1 && lastSearch.length <= 6) this.offer(lastSearch);
        bubble.textContent = bubble.textContent.replace(/\s+$/, "");
      }
    };
    const body = { message: text, app: "booth-studio", today: today(), page: "Booth Studio" };
    if (pictures.length) body.images = pictures.map(({ mediaType, data }) => ({ mediaType, data }));
    // Every tab, bar and button the tool search knows, so the assistant can say where to tap.
    try {
      const map = this.host?.appMap?.();
      if (map) body.appMap = String(map).slice(0, 15000);
    } catch {}
    const record = await this.record();
    if (record) body.record = record;
    if (this.fresh) {
      body.fresh = true;
      this.fresh = false;
    } else if (this.threadId) body.threadId = this.threadId;
    this.count(1);
    try {
      const res = await fetch("/assistant/chat", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 401) throw new Error("Your studio sign-in has ended. Sign in again in Studio account.");
        if (res.status === 404 || res.status === 503) throw new Error("The assistant isn’t switched on here yet.");
        throw new Error(data?.error?.message || "The assistant could not answer.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const r = await reader.read();
        if (r.value) buf += dec.decode(r.value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const chunk of parts) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let ev = null;
          try {
            ev = JSON.parse(line.slice(6));
          } catch {}
          if (ev) handle(ev);
        }
        if (r.done) break;
      }
    } catch (err) {
      bubble.remove();
      this.setNote(navigator.onLine ? err.message : "The connection dropped. Nothing was saved by that message.");
    } finally {
      this.busy = false;
      this.sendBtn.disabled = false;
    }
  }

  offer(items) {
    this.picks.textContent = "";
    for (const it of items) {
      const b = el("button", { class: "btn", type: "button", text: it.label });
      b.title = it.detail || "";
      b.addEventListener("click", () => this.send(it.label));
      this.picks.appendChild(b);
    }
    this.picks.hidden = false;
  }

  /** A confirm card: the assistant's line, the studio's lines, Confirm and Cancel. */
  card(p) {
    if (this.log.querySelector(`[data-card="${CSS_ESC(p.id)}"]`)) return;
    const dl = el("dl");
    for (const d of p.details || []) {
      dl.appendChild(el("dt", { text: d.label }));
      dl.appendChild(el("dd", { text: d.value }));
    }
    const ok = el("button", { class: "btn primary", type: "button", text: "Confirm" });
    const no = el("button", { class: "btn", type: "button", text: "Cancel" });
    const status = el("p", { class: "status", role: "status" });
    const row = el("div", { class: "row" }, [ok, no]);
    const card = el("div", { class: "card", "data-card": p.id }, [el("h3", { text: "Confirm to save" }), el("p", { class: "sum", text: p.summary || "" }), dl, row, status]);
    this.log.appendChild(card);
    this.log.scrollTop = this.log.scrollHeight;
    const busy = (on) => (ok.disabled = no.disabled = on);
    ok.addEventListener("click", async () => {
      busy(true);
      status.textContent = "Saving…";
      try {
        const r = await post(`/v1/assistant/proposals/${encodeURIComponent(p.id)}/confirm`);
        row.remove();
        status.textContent = "Saved.";
        this.undo(card, status, r.activityIds?.[0]);
        await this.bridge?.sync();
        // A booth the assistant made: open it here in one tap.
        const made = (r.proposal?.action || p.action) === "placement.build" ? r.result?.id : null;
        if (made && this.bridge?.openBooth) {
          const open = el("button", { class: "btn", type: "button", text: "Open it" });
          open.addEventListener("click", () => this.bridge.openBooth(made));
          card.querySelector(".row")?.appendChild(open) ?? card.appendChild(el("div", { class: "row" }, [open]));
        }
      } catch (e) {
        busy(false);
        status.textContent = navigator.onLine ? e.message : "No connection. Tap Confirm again when you’re back online.";
        if (e.status === 409) row.remove();
      }
    });
    no.addEventListener("click", async () => {
      busy(true);
      try {
        await post(`/v1/assistant/proposals/${encodeURIComponent(p.id)}/cancel`);
        row.remove();
        status.textContent = "Cancelled. Nothing was saved.";
      } catch (e) {
        busy(false);
        status.textContent = e.message;
      }
    });
  }

  /** A card confirmed earlier (another page, another device): what it saved, with Undo. */
  saved(p) {
    if (this.log.querySelector(`[data-card="${CSS_ESC(p.id)}"]`)) return;
    const status = el("p", { class: "status", role: "status", text: "Saved." });
    const box = el("div", { class: "card", "data-card": p.id }, [el("h3", { text: "Saved" }), el("p", { class: "sum", text: p.summary || "" }), status]);
    this.log.appendChild(box);
    this.undo(box, status, p.activityId);
  }

  /** Something the studio lets the assistant do on its own: it is saved, with Undo. */
  done(e) {
    const status = el("p", { class: "status", role: "status", text: "Saved." });
    const box = el("div", { class: "card" }, [el("h3", { text: "Saved" }), status]);
    this.log.appendChild(box);
    this.undo(box, status, e.activityIds?.[0]);
    void this.bridge?.sync();
  }

  undo(box, status, activityId) {
    if (!activityId) return;
    const b = el("button", { class: "btn", type: "button", text: "Undo" });
    const row = el("div", { class: "row" }, [b]);
    box.appendChild(row);
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await post(`/v1/activity/${encodeURIComponent(activityId)}/undo`);
        row.remove();
        status.textContent = "Undone.";
        await this.bridge?.sync();
      } catch (e) {
        b.disabled = false;
        status.textContent = e.message;
      }
    });
  }
}
const CSS_ESC = (s) => (globalThis.CSS?.escape ? globalThis.CSS.escape(String(s)) : String(s).replace(/["\\]/g, "\\$&"));

/**
 * Put the panel on the page, once: after the studio bridge, while signed in.
 * Asks this Worker whether an assistant is connected; with none, nothing shows.
 */
export async function mount(bridge, host) {
  if (!customElements.get("studio-assistant")) customElements.define("studio-assistant", Panel);
  let available = false;
  try {
    const r = await fetch("/assistant/status", { credentials: "same-origin" });
    available = r.ok && (await r.json())?.available === true;
  } catch {}
  let panel = document.querySelector("studio-assistant");
  if (!panel) {
    panel = document.createElement("studio-assistant");
    document.body.appendChild(panel);
  }
  panel.attach(bridge, host, available);
  return panel;
}
