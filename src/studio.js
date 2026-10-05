// Booth Studio in the studio: sign-in, sync of the open project, its images,
// and "Import my existing projects" (Art-Talk-Back docs/phase-5-booth.md).
//
// Loaded only when this browser is signed in, or when the artist opens Studio
// account (main.js, src/studio-session.js). Signed out, none of this runs and
// the app is exactly the local app it always was.
//
// How the open project and the studio stay together
// --------------------------------------------------
// The editor knows one project, `p`, saved in IndexedDB as it always was. The
// studio keeps each booth as a *placement* (src/placement.js): the project's
// layout as `scene`, its images as studio files named in `images`. The SDK
// keeps the device's copy of every placement and an outbox of changes, and
// syncs them (push, then pull) on a timer, on focus, on reconnect and after
// each save.
//
// `reconcile()` is the one place the two meet. It compares the project on
// screen with the device's copy of its placement, against the last scene the
// two agreed on (`applied`, kept per browser):
//
//   same scene             → they agree; remember it.
//   only the project moved → an edit here: queue it as a placement update.
//   only the copy moved    → another device's edit arrived: open it here,
//                            once every image it names can be fetched.
//   both moved             → the studio keeps its copy and a card offers this
//                            device's (Art-Talk-Back D-064). The server sends
//                            the same card when it finds the clash itself.
//
// Which projects go to the studio: once signed in, the project open now
// syncs if it is already in the studio, or if it was started or opened on
// this browser since signing in. The project that was here *before* signing
// in waits for "Import my existing projects", so nothing goes up without the
// artist asking (the Show Tracker's rule).
//
// Images go up one at a time after their placement exists on the server
// (attach checks it, D-063), and come down when a version that names them is
// opened. Their thumbnails are made again here.
import { ApiClient, ApiError, PUSH_BATCH, Studio } from "./vendor/studio-sdk.js";
import { validateProject } from "./model.js";
import {
  blobOf, fileIdsOf, imagesReady, manifestOf, missingImages, patchFor, placementOf, platformId, projectFrom, sceneOf,
  sceneText, tooBig,
} from "./placement.js";
import { load, thumbnailOf } from "./storage.js";
import { readSession, writeSession } from "./studio-session.js";

const DB_NAME = "booth-studio.studio";
const APPLIED_KEY = "booth.studio.applied";
const IMPORT_KEY = "booth.studio.imported";
const INTERVAL_MS = 60_000;

const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** A short, stable fingerprint of a scene's text (FNV-1a), so `applied` never stores the scene itself. */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `${text.length}:${h.toString(36)}`;
}
const readJSON = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null");
  } catch {
    return null;
  }
};
const writeJSON = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const dataUrlOf = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * The bridge. `host` is main.js's side: the project on screen and how to
 * replace it, plus a few of its helpers.
 *   project() → p · open(next) · saveNow() · backup() · toast(msg, error?) ·
 *   confirm(title, text, run) · dialog() → <dialog> · setNetwork(text)
 */
export function connect(host) {
  let studio = null; // Promise<Studio> while signed in
  let status = "signed_out";
  let detail = "";
  let timer = null;
  let syncing = null;
  let chain = Promise.resolve();
  let card = null; // { deviceCopy } while a review card is showing
  const listeners = new Set();

  const session = () => readSession();
  const expired = () => !!session()?.expired;
  function setStatus(next, words = "") {
    status = next;
    detail = words;
    host.setNetwork(networkText());
    for (const fn of listeners) fn();
  }
  function networkText() {
    switch (status) {
      case "signed_out": return "Local workspace";
      case "syncing": return "Studio · syncing…";
      case "synced": return "Studio · synced";
      case "offline": return `Studio · offline${detail ? ` · ${detail}` : ""}`;
      case "uploading": return `Studio · ${detail}`;
      case "waiting": return "Studio · waiting for images";
      case "local": return "Studio · this project is on this device only";
      case "too_big": return "Studio · too big to sync";
      case "expired": return "Studio · sign in again";
      default: return "Studio · can't sync just now";
    }
  }
  /** Run one at a time: reconcile, uploads and imports all read then write. */
  function serial(fn) {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  }

  // ------------------------------------------------------------ the store

  function open() {
    studio = Studio.open({ baseUrl: location.origin, dbName: DB_NAME }).then((st) => {
      st.on("change", (ev) => {
        if (ev.types.includes("placement")) void serial(reconcile);
      });
      st.on("conflict", (ev) => {
        if (ev.entityType === "placement") void currentId().then((id) => id === ev.entityId && showCard());
      });
      st.on("rejected", (ev) => {
        if (ev.entityType === "placement") host.toast(`The studio didn't take a change to this booth: ${ev.message}`, true);
      });
      return st;
    });
    if (!timer) {
      timer = setInterval(() => void sync(), INTERVAL_MS);
      addEventListener("online", kick);
      addEventListener("focus", kick);
      document.addEventListener("visibilitychange", onVisible);
    }
    return studio;
  }
  function onVisible() {
    if (document.visibilityState !== "hidden") kick();
  }
  let kickTimer = null;
  /** Sync soon, once, however many saves came in together. */
  function kick() {
    clearTimeout(kickTimer);
    kickTimer = setTimeout(() => void sync(), 400);
  }

  /** The placement id of the project on screen. */
  async function currentId() {
    const p = host.project();
    if (studio) {
      const st = await studio;
      const mine = (await st.list("placement")).find((r) => r.meta?.projectId === p.id);
      if (mine) return mine.id;
    }
    return platformId(p.id);
  }

  // ------------------------------------------------------------ reconcile

  async function reconcile() {
    if (!studio) return;
    const st = await studio;
    const p = host.project();
    const id = await currentId();
    const record = await st.get("placement", id);
    const fields = placementOf(p, fileIdsOf(record?.images));
    const localText = sceneText(fields.scene);
    const applied = readJSON(APPLIED_KEY);
    const agreed = applied && applied.id === id ? applied : null;

    if (!record) {
      // Not in the studio. The project from before signing in waits for the import.
      const s = session();
      if (s?.local === p.id) return setStatus("local");
      const big = tooBig(fields.scene, fields.images);
      if (big) return setStatus("too_big", big);
      await st.create("placement", { id, ...fields, meta: { projectId: p.id } });
      writeJSON(APPLIED_KEY, { id, version: 0, hash: hash(localText) });
      return kick();
    }
    const recordText = sceneText(record.scene);
    if (recordText === localText) {
      writeJSON(APPLIED_KEY, { id, version: record.version ?? 0, hash: hash(localText) });
      const patch = patchFor(record, fields);
      if (patch) {
        await st.update("placement", id, patch);
        kick();
      }
      return;
    }
    const localMoved = !agreed || agreed.hash !== hash(localText);
    const remoteMoved = !agreed || ((record.version ?? 0) > agreed.version && agreed.hash !== hash(recordText));
    if (localMoved && !remoteMoved) {
      const big = tooBig(fields.scene, fields.images);
      if (big) return setStatus("too_big", big);
      const patch = patchFor(record, fields);
      if (patch) await st.update("placement", id, patch);
      writeJSON(APPLIED_KEY, { id, version: agreed?.version ?? record.version ?? 0, hash: hash(localText) });
      return kick();
    }
    if (localMoved && remoteMoved) showCard();
    await applyRecord(st, record);
  }

  /** Open the studio's copy here, once every image it names can be fetched. */
  async function applyRecord(st, record) {
    if (!imagesReady(record)) return setStatus("waiting");
    const have = { ...host.project().assets };
    const missing = missingImages(record, have);
    for (const [i, im] of missing.entries()) {
      setStatus("uploading", `fetching images ${i + 1} of ${missing.length}`);
      have[im.key] = await download(st, im);
    }
    let next = projectFrom(record, have);
    if (next.id !== record.meta?.projectId && (await platformId(next.id)) !== record.id) next.id = record.id;
    try {
      next = validateProject(next) || next;
    } catch (err) {
      return setStatus("error", `The studio's copy of this booth couldn't be opened: ${err.message}`);
    }
    writeJSON(APPLIED_KEY, { id: record.id, version: record.version ?? 0, hash: hash(sceneText(record.scene)) });
    host.open(next);
    setStatus("synced");
  }

  async function download(st, im) {
    const link = await st.api.request("GET", `/files/${im.fileId}/download-url`);
    const res = await fetch(link.url);
    if (!res.ok) throw new Error(`An image couldn't be fetched (${res.status})`);
    const blob = await res.blob();
    const asset = { data: await dataUrlOf(blob), width: im.width ?? 1, height: im.height ?? 1, name: im.name || im.key };
    if (im.role) asset.role = im.role;
    if (im.role !== "model") {
      try {
        const bitmap = await createImageBitmap(blob);
        asset.thumb = thumbnailOf(bitmap, bitmap.width, bitmap.height);
        bitmap.close?.();
      } catch {}
    }
    return asset;
  }

  // -------------------------------------------------------------- uploads

  /** Upload every image of the open project the studio doesn't hold yet, then name them. */
  async function uploadImages() {
    const st = await studio;
    const id = await currentId();
    const record = await st.get("placement", id);
    if (!record || !record.version) return; // not on the server yet: attach would 404
    const known = fileIdsOf(record.images);
    const assets = host.project().assets || {};
    const todo = Object.keys(assets).filter((key) => !known[key]);
    if (!todo.length) return;
    for (const [i, key] of todo.entries()) {
      setStatus("uploading", `uploading images ${i + 1} of ${todo.length}`);
      known[key] = await upload(st, id, key, assets[key]);
    }
    const images = manifestOf(host.project(), known);
    const now = await st.get("placement", id);
    if (now && JSON.stringify(now.images) !== JSON.stringify(images)) await st.update("placement", id, { images });
  }

  async function upload(st, placementId, key, asset) {
    const blob = blobOf(asset.data);
    const name = String(asset.name || key).trim().slice(0, 200) || key;
    const { file, uploadUrl } = await st.api.request("POST", "/files/upload-url", {
      json: { name, contentType: blob.type, size: blob.size, kind: asset.role === "model" ? "other" : "photo" },
    });
    const put = await fetch(uploadUrl, { method: "PUT", body: blob });
    if (!put.ok) throw new Error(`An image couldn't be uploaded (${put.status})`);
    await st.api.request("POST", `/files/${file.id}/attach`, { json: { entityType: "placement", entityId: placementId } });
    return file.id;
  }

  // ----------------------------------------------------------------- sync

  /** Push, pull, upload, reconcile. Never throws: problems become a status. */
  function sync() {
    if (!studio) return Promise.resolve();
    if (expired()) {
      setStatus("expired");
      return Promise.resolve();
    }
    if (syncing) return syncing;
    setStatus("syncing");
    syncing = (async () => {
      try {
        const st = await studio;
        await st.sync();
        const first = !session()?.synced;
        if (first) await settleFirstSync(st);
        await serial(reconcile);
        if (st.online) {
          await serial(uploadImages);
          await st.sync();
          await serial(reconcile);
        }
        const pending = await st.pendingCount();
        if (!st.online) setStatus("offline", pending ? `${plural(pending, "change")} waiting` : "");
        // "local", "too_big", "waiting" and "error" were set by reconcile and stand.
        else if (status === "syncing" || status === "uploading") setStatus("synced");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return expire();
        if (err instanceof ApiError && err.status === 503) return setStatus("error", err.message);
        console.error(err);
        setStatus("error", err?.message || String(err));
      } finally {
        syncing = null;
      }
    })();
    return syncing;
  }

  /**
   * After the first pull following a sign-in: the project that was open
   * before signing in is "this device's" (it waits for the import) unless the
   * studio already has it.
   */
  async function settleFirstSync(st) {
    const s = session();
    if (!s) return;
    const id = await currentId();
    const inStudio = !!(await st.get("placement", id));
    writeSession({ ...s, synced: true, local: inStudio ? null : s.local });
  }

  async function expire() {
    const s = session();
    if (s) writeSession({ ...s, expired: true });
    const n = studio ? await (await studio).pendingCount() : 0;
    setStatus("expired", n ? `${plural(n, "change")} kept on this device until you do` : "");
  }

  // ---------------------------------------------------------- review card

  function showCard() {
    const p = host.project();
    card = { deviceCopy: { ...sceneOf(p), assets: { ...p.assets } } };
    let el = document.querySelector("#studio-card");
    if (!el) {
      el = document.createElement("div");
      el.id = "studio-card";
      el.setAttribute("role", "alert");
      el.dataset.card = "conflict";
      document.body.append(el);
    }
    el.innerHTML = `<strong>This booth changed on another device too</strong><p>The studio kept the other device's version, and that is what's open now. This device's version is kept here until you choose.</p><div class="button-row"><button data-studio="use-mine">Use this device's</button><button data-studio="keep" class="primary">Keep the studio's</button></div>`;
    el.hidden = false;
    el.onclick = (ev) => {
      const b = ev.target.closest("[data-studio]");
      if (!b) return;
      el.hidden = true;
      const copy = card?.deviceCopy;
      card = null;
      if (b.dataset.studio === "use-mine" && copy) {
        host.open(copy);
        host.toast("This device's version is back, and goes to the studio.");
      }
    };
  }

  // -------------------------------------------------------------- sign-in

  const api = () => new ApiClient({ baseUrl: location.origin });

  async function requestCode(email) {
    await api().requestCode(String(email || "").trim().toLowerCase());
  }

  async function verify(email, code) {
    email = String(email || "").trim().toLowerCase();
    const prev = session();
    const me = await api().verify(email, String(code || "").trim());
    const studioId = me.activeStudioId || null;
    // Back after an ended sign-in as the same person and studio: keep this
    // device's copy and its waiting changes. Anyone else starts clean.
    const same = prev && prev.email === email && (prev.studioId || null) === studioId;
    if (prev && !same) await forget();
    const p = host.project();
    writeSession(same ? { ...prev, expired: false } : { signedIn: true, email, studioId, local: p.id, synced: false });
    if (!studio) open();
    setStatus("syncing");
    await sync();
    return me;
  }

  async function signOut() {
    let n = 0;
    if (studio) n = await (await studio).pendingCount();
    try {
      await api().logout();
    } catch {}
    await forget();
    return n;
  }

  /** Back to the local-only app. The project on screen stays, as it always was. */
  async function forget() {
    const was = studio;
    studio = null;
    if (timer) clearInterval(timer);
    timer = null;
    removeEventListener("online", kick);
    removeEventListener("focus", kick);
    document.removeEventListener("visibilitychange", onVisible);
    writeSession(null);
    writeJSON(APPLIED_KEY, null);
    if (was) (await was).close();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
    setStatus("signed_out");
  }

  // --------------------------------------------------------------- import

  /**
   * "Import my existing projects": every project saved in this browser's
   * IndexedDB (`artist-os-booth-studio`) goes to the studio once, through
   * /v1/sync/push like any offline change, then its images. Ids and op ids
   * come from the project's own id, so running it again — here or on another
   * device holding the same project — adds nothing: the studio answers
   * "duplicate". A push answers only its first few ops (D-050), so it loops
   * until every op has an answer. The device's own copy is left as it was.
   */
  async function importExisting(onProgress) {
    if (!studio) throw new Error("Sign in to the studio first.");
    if (expired()) throw new Error("Your studio sign-in has ended. Sign in again first.");
    await host.saveNow();
    const st = await studio;
    await st.sync();
    const saved = await load();
    const projects = saved ? [saved] : [];
    const tally = { added: 0, already: 0, refused: [], images: 0 };
    const ops = [];
    for (const project of projects) {
      const id = await platformId(project.id);
      if (await st.get("placement", id)) {
        tally.already++;
        continue;
      }
      const fields = placementOf(project);
      const big = tooBig(fields.scene, fields.images);
      if (big) {
        tally.refused.push(`${project.name}: ${big}`);
        continue;
      }
      ops.push({
        opId: await platformId(`import:${project.id}`),
        action: "placement.create",
        entityId: id,
        baseVersion: null,
        input: { ...fields, meta: { projectId: project.id, importedFrom: "artist-os-booth-studio" } },
        project,
      });
    }
    let done = 0;
    while (done < ops.length) {
      const batch = ops.slice(done, done + PUSH_BATCH);
      const res = await st.api.push(batch.map(({ project: _p, ...op }) => op));
      if (!res.results.length) throw new Error("The studio answered none of the changes");
      res.results.forEach((r, j) => {
        if (r.status === "duplicate") tally.already++;
        else if (r.status === "rejected") {
          if (/already in use/.test(r.error?.message || "")) tally.already++;
          else tally.refused.push(`${batch[j].project.name}: ${r.error?.message}`);
        } else tally.added++;
      });
      done += res.results.length;
      onProgress?.(done, ops.length);
    }
    await st.sync();
    // The open project is one of them (it is what IndexedDB holds): from now on it syncs.
    const s = session();
    if (s) writeSession({ ...s, local: null });
    // Images, now that each placement exists on the server.
    for (const { project, entityId } of ops) {
      const record = await st.get("placement", entityId);
      if (!record?.version) continue;
      const known = fileIdsOf(record.images);
      const keys = Object.keys(project.assets || {}).filter((k) => !known[k]);
      for (const [i, key] of keys.entries()) {
        onProgress?.(done, ops.length, `Uploading images ${i + 1} of ${keys.length}`);
        known[key] = await upload(st, entityId, key, project.assets[key]);
        tally.images++;
      }
      const images = manifestOf(project, known);
      if (JSON.stringify(record.images) !== JSON.stringify(images)) await st.update("placement", entityId, { images });
    }
    await sync();
    const stamp = new Date().toISOString();
    if (!tally.refused.length) writeJSON(IMPORT_KEY, { at: stamp, projects: projects.length, added: tally.added, already: tally.already });
    return { projects: projects.length, ...tally };
  }

  // ---------------------------------------------------------------- panel

  async function studioBooths() {
    if (!studio) return [];
    const st = await studio;
    return (await st.list("placement")).filter((r) => r.kind === "booth").sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async function openBooth(id) {
    const st = await studio;
    const record = await st.get("placement", id);
    if (!record) return;
    const go = async () => {
      if (!imagesReady(record)) {
        host.toast("Its images are still on their way from the other device. Try again in a moment.", true);
        return;
      }
      host.dialog().close();
      await serial(() => applyRecord(st, record));
      host.toast(`${record.name} is open.`);
      kick();
    };
    const here = await st.get("placement", await currentId());
    if (here) return go();
    host.confirm("Open this booth?", "The project open now isn't in the studio. A backup of it downloads before it's replaced.", () => {
      host.backup();
      void go();
    });
  }

  function renderPanel() {
    const d = host.dialog();
    const s = session();
    const box = d.querySelector("#dialog-content");
    if (!s || s.expired) {
      box.innerHTML = `<h2>Studio account</h2>${s?.expired ? `<p class="warning" id="st-expired">Your studio sign-in has ended. Sign in again as ${e(s.email)}${detail ? ` — ${e(detail)}` : ""}.</p>` : `<p class="muted">Sign in to keep your booths in your studio and open them on your other devices. Signed out, Booth Studio works on this device exactly as it always has.</p>`}<label class="setting-label">Email<input id="st-email" type="email" autocomplete="email" value="${e(s?.email || "")}"/></label><div class="button-row"><button class="primary" id="st-send">Send me a code</button></div><div id="st-code-row" hidden><label class="setting-label">The 6-digit code from the email<input id="st-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"/></label><div class="button-row"><button class="primary" id="st-verify">Sign in</button></div></div><p class="muted" id="st-msg" role="status"></p><div class="button-row"><button id="st-close">Close</button></div>`;
      const msg = (t, bad) => {
        const m = box.querySelector("#st-msg");
        m.textContent = t;
        m.classList.toggle("error", !!bad);
      };
      box.querySelector("#st-close").onclick = () => d.close();
      box.querySelector("#st-send").onclick = async () => {
        const email = box.querySelector("#st-email").value;
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) return msg("Type the email you use for the studio.", true);
        msg("Sending…");
        try {
          await requestCode(email);
          box.querySelector("#st-code-row").hidden = false;
          box.querySelector("#st-code").focus();
          msg("Check your email for a 6-digit code.");
        } catch (err) {
          msg(err.status === 503 ? "The studio can't be reached from here just now. Booth Studio keeps working on this device." : err.message, true);
        }
      };
      box.querySelector("#st-verify").onclick = async () => {
        msg("Signing in…");
        try {
          await verify(box.querySelector("#st-email").value, box.querySelector("#st-code").value);
          renderPanel();
        } catch (err) {
          msg(err.message, true);
        }
      };
      return;
    }
    box.innerHTML = `<h2>Studio account</h2><p id="st-signed-in">Signed in as <strong>${e(s.email)}</strong>.</p><p class="muted" id="st-status">${e(networkText())}${detail && status !== "offline" && status !== "uploading" ? ` — ${e(detail)}` : ""}</p><div class="button-row"><button id="st-sync">Sync now</button><button id="st-signout">Sign out</button></div><section><h3>Your studio's booths</h3><div id="st-booths" class="muted">Loading…</div></section><section><h3>This device's projects</h3><p class="muted" id="st-import-text">${s.local ? "The project that was on this device before you signed in stays here until you import it." : "Projects you start or open here go to the studio by themselves."}</p><div class="button-row"><button class="primary" id="st-import">Import my existing projects</button></div><p class="muted" id="st-import-result" role="status"></p></section><div class="button-row"><button id="st-close">Close</button></div>`;
    box.querySelector("#st-close").onclick = () => d.close();
    box.querySelector("#st-sync").onclick = async () => {
      await sync();
      renderPanel();
    };
    box.querySelector("#st-signout").onclick = async () => {
      const n = await signOut();
      host.toast(n ? `Signed out. ${plural(n, "change")} that hadn't reached the studio stay in this project on this device.` : "Signed out of the studio. This project stays on this device.");
      renderPanel();
    };
    box.querySelector("#st-import").onclick = async () => {
      const out = box.querySelector("#st-import-result");
      const btn = box.querySelector("#st-import");
      btn.disabled = true;
      out.textContent = "Importing…";
      try {
        const r = await importExisting((n, total, words) => (out.textContent = words || `Importing ${n} of ${total}…`));
        out.textContent = `Import finished: ${r.added} added, ${r.already} already in the studio${r.images ? `, ${plural(r.images, "image")} uploaded` : ""}.${r.refused.length ? ` Not imported: ${r.refused.join("; ")}` : ""}`;
        void listBooths();
      } catch (err) {
        out.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    };
    const listBooths = async () => {
      const el = box.querySelector("#st-booths");
      if (!el) return;
      const here = await currentId();
      const booths = await studioBooths();
      el.innerHTML = booths.length
        ? `<ul class="studio-booths">${booths.map((b) => `<li data-booth="${e(b.id)}"><span><strong>${e(b.name)}</strong><small>${b.width && b.depth ? `${Math.round(b.width / 12)} × ${Math.round(b.depth / 12)} ft · ` : ""}${plural((b.images || []).length, "image")}</small></span>${b.id === here ? `<em>Open now</em>` : `<button data-open-booth="${e(b.id)}">Open</button>`}</li>`).join("")}</ul>`
        : "None yet.";
      el.querySelectorAll("[data-open-booth]").forEach((b) => (b.onclick = () => openBooth(b.dataset.openBooth)));
    };
    void listBooths();
  }

  const bridge = {
    /** At start, signed in: open the device's copy and sync. */
    boot() {
      if (!session()) return;
      open();
      setStatus(expired() ? "expired" : "syncing");
      setTimeout(() => void sync(), 0);
    },
    /** After each save of the project on screen. */
    saved() {
      if (!studio || expired()) return;
      void serial(reconcile).then(kick, (err) => console.error(err));
    },
    openPanel() {
      renderPanel();
      const d = host.dialog();
      if (!d.open) d.showModal();
    },
    sync,
    status: () => status,
    detail: () => detail,
    pendingCount: async () => (studio ? (await studio).pendingCount() : 0),
    placementId: currentId,
    importExisting,
    onStatus(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  // For the two-device test and anyone debugging on a phone: the same handful
  // of calls the Show Tracker exposes as ASTStudio.
  globalThis.BoothStudio = bridge;
  return bridge;
}
