// The booth link's dialogs (Show Hub phase 1): what Export → Send to the show
// shares, the links this browser has sent — to copy, send the booth to again
// or delete — and a link someone opens. The Worker half is worker/index.js,
// the network's src/share.js. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 1): `ctx` is boot's state, read and set through
// it, and the helpers this calls.
import { blankProject, escapeHTML as e } from "../model.js";
import { THUMB_MAX, thumbnailOf } from "../storage.js";
import { decodeAt } from "../image-source.js";
import { designFile, importDesign, readDesignFile } from "../booth-file.js";
import { SHARE_DAYS_SHOWN, deleteShare, downloadShare, forgetLink, rememberLink, sentLinks, updateShare } from "../share.js";
import { hasDesign, liveNumber, putDesign } from "../linked.js";
import { showItems } from "../show.js";

export function createShareDialogs(ctx) {
  const { allowed, backup, btn, confirmAction, mutate, renderInspector, toast } = ctx;
  /**
   * The live design as a file to share: every image the booth shows gets its
   * small preview first, so a Lite browser opening the link sees the booth
   * through them.
   */
  async function shareFile() {
    const file = designFile(ctx.p);
    for (const [id, asset] of Object.entries(file.assets)) {
      if (asset.thumb || asset.role === "model") continue;
      try {
        const source = await decodeAt(asset.data, asset.width, asset.height, THUMB_MAX);
        file.assets[id] = { ...asset, thumb: thumbnailOf(source, source.width, source.height) };
        source.close?.();
      } catch {}
    }
    return file;
  }
  /** The links this browser has sent, each to copy, send the booth to again, or delete. */
  function sentLinksHTML() {
    const links = sentLinks();
    if (!links.length) return "";
    const day = (iso) => {
      const t = Date.parse(iso || "");
      return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
    };
    return `<h4>Links you have sent</h4><ul class="sent-links">${links
      .map(
        (l) =>
          `<li data-sent-link="${e(l.id)}"><div><strong>${e(l.name || "A booth")}</strong><small>${l.sent ? `Sent ${e(day(l.sent))}` : ""}</small></div><div class="button-row">${btn("link-copy-" + l.id, "Copy link", "copy")}${btn("link-update-" + l.id, "Send this booth to it", "send")}${btn("link-delete-" + l.id, "Delete link", "trash-2")}</div></li>`,
      )
      .join("")}</ul><p class="muted">Send this booth to it replaces what the link opens with the booth open now, under the same address, and starts its ${SHARE_DAYS_SHOWN} days again. Delete takes it off the server: the link stops opening. Only this browser can do either.</p>`;
  }
  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      document.execCommand?.("copy");
    }
    toast("Link copied.");
  }
  async function sendToLink(l) {
    if (ctx.sharing) return;
    ctx.sharing = true;
    try {
      const file = await shareFile();
      toast("Updating the link…");
      await updateShare(l.id, l.key, file, (done, total) => total && toast(`Updating the link… ${done} of ${total} new images`));
      rememberLink({ id: l.id, key: l.key, name: ctx.p.name });
      renderInspector();
      toast(`The link now opens ${ctx.p.name ? `“${ctx.p.name}”` : "this booth"}. Whoever has it sees the change the next time they open it.`);
    } catch (err) {
      toast(`The link could not be updated: ${err.message}`, true);
    } finally {
      ctx.sharing = false;
    }
  }
  function removeLink(l) {
    confirmAction("Delete this link?", `The link to ${l.name ? `“${l.name}”` : "this booth"} stops opening, for anyone who has it. A booth already put on a show floor stays there.`, async () => {
      try {
        await deleteShare(l.id, l.key);
      } catch (err) {
        // Already lapsed or deleted: nothing left to delete, so forget it.
        if (!/expired|never existed/.test(err.message)) return toast(`The link could not be deleted: ${err.message}`, true);
      }
      forgetLink(l.id);
      renderInspector();
      toast("Link deleted.");
    });
  }
  /** The link a share made, to copy and send. */
  function showShareLink(link) {
    const d = document.querySelector("#dialog");
    document.querySelector("#dialog-content").innerHTML =
      `<h2>Your booth's link</h2><p>Send this to the show's promoter. It opens your booth in Booth Studio; the link lasts ${SHARE_DAYS_SHOWN} days. Export → Send to the show keeps it, to send a changed booth to the same link or to delete it.</p><input id="share-link" readonly value="${e(link)}" aria-label="Booth link"/><div class="button-row"><button id="share-close">Close</button><button class="primary" id="share-copy">Copy link</button></div>`;
    document.querySelector("#share-close").onclick = () => d.close();
    document.querySelector("#share-copy").onclick = () => {
      document.querySelector("#share-link").select();
      copyLink(link);
    };
    d.showModal();
  }
  /**
   * A booth link opened (`?booth=<id>`): fetch it — originals in Pro, the
   * previews in Lite — and offer what the tier allows. Pro with a show floor
   * puts it on a booth; anyone can look at it, which opens it as its own
   * project after the current one is downloaded as a backup.
   */
  async function openShareLink(id) {
    const pro = allowed("hall");
    let file;
    try {
      toast("Opening the booth link…");
      file = readDesignFile(await downloadShare(id, pro, (done, total) => total && toast(`Opening the booth link… ${done} of ${total} images`)));
    } catch (err) {
      return toast(`That booth link could not be opened: ${err.message}`, true);
    }
    const who = file.name ? `${file.name}` : "A booth";
    const floor = pro && ctx.p.hall;
    const numbers = floor ? showItems(ctx.p.hall).filter((i) => i.kind === "booth").map((i) => i.number) : [];
    const guess = numbers.includes(file.number) ? file.number : numbers[0];
    const d = document.querySelector("#dialog");
    document.querySelector("#dialog-content").innerHTML =
      `<h2>${e(who)}</h2><p>${pro ? "The booth someone sent you, with its original images." : "A preview of the booth someone sent you. Booth Studio Pro opens it with its original images and puts it on your show floor."}</p>${floor ? `<label class="setting-label">On booth<select id="share-number" aria-label="Booth number">${numbers.map((n) => `<option value="${n}" ${n === guess ? "selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}<div class="button-row"><button id="share-cancel">Not now</button><button id="share-look">Look at it</button>${floor ? '<button class="primary" id="share-place">Put it on my show floor</button>' : ""}</div>`;
    document.querySelector("#share-cancel").onclick = () => d.close();
    document.querySelector("#share-look").onclick = () => {
      d.close();
      backup();
      mutate(() => {
        const next = blankProject();
        next.name = `${file.name || "Shared booth"} · shared`;
        next.assets = file.assets;
        putDesign(next, file.design);
        ctx.p = next;
        ctx.showFloor = false;
        ctx.selected = null;
        ctx.tab = "layout";
      });
      ctx.scene?.setView("perspective");
      toast(`${who}'s booth is open. Your project was downloaded as a backup first.`);
    };
    if (floor)
      document.querySelector("#share-place").onclick = () => {
        const n = Number(document.querySelector("#share-number").value);
        d.close();
        const go = () => {
          let err = null;
          const live = liveNumber(ctx.p.hall) === n;
          mutate(() => {
            err = importDesign(ctx.p, n, file);
            if (!err && live) ctx.selected = null;
            if (!err) ctx.hallSelected = n;
          });
          if (err) return toast(err, true);
          if (!ctx.showFloor) ctx.actions["mode-show"]();
          toast(`${who}'s booth is on booth ${n}. Open this booth to walk round it.`);
        };
        if (hasDesign(ctx.p.hall, n)) confirmAction(`Replace booth ${n}'s design?`, `${who}'s booth replaces the design booth ${n} has now. Undo brings it back.`, go);
        else go();
      };
    d.showModal();
  }
  return { shareFile, sentLinksHTML, copyLink, sendToLink, removeLink, showShareLink, openShareLink };
}
