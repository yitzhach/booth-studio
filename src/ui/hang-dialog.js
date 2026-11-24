// The guided hang step's Add my pictures (DEMO_PHASE.md, task A4): several
// pictures chosen at once, each one's width asked once in a single dialog,
// the height shown as it follows the picture's shape, and all of them hung
// in one undo step by src/hang.js. Cancel, or Esc, adds nothing at all: the
// images are read first and only reach the project when Hang them is
// pressed, so a cancelled dialog leaves the library as it was.
//
// Its own file input, not the Artwork tab's (#art-input), because that one
// files pictures in the library without hanging them, which is what the
// tabs still do.
import { escapeHTML as e, uid } from "../model.js";
import { readImage } from "../storage.js";
import { MAX_PLACEMENTS, MAX_WIDTH, hangNew, heightFor } from "../hang.js";

/** validateProject's limit on images, as src/ui/upload.js keeps it. */
const MAX_ASSETS = 250;
const inches = (n) => `${Number(n.toFixed(2))}″`;

export function createHangDialog(ctx) {
  const { mutate, toast } = ctx;
  const input = document.createElement("input");
  input.type = "file";
  input.id = "guided-input";
  input.accept = "image/jpeg,image/png";
  input.multiple = true;
  input.hidden = true;
  document.body.append(input);
  input.addEventListener("change", async () => {
    const files = [...input.files];
    input.value = "";
    if (!files.length) return;
    if (Object.keys(ctx.p.assets).length + files.length > MAX_ASSETS) return toast(`A booth holds ${MAX_ASSETS} images at most.`, true);
    try {
      toast("Reading your pictures…");
      const assets = [];
      for (const f of files) assets.push(await readImage(f));
      ask(assets);
    } catch (err) {
      toast(err.message, true);
    }
  });

  /** The dialog: one row a picture, its width typed, its height shown. */
  function ask(assets) {
    const d = /** @type {HTMLDialogElement} */ (document.querySelector("#dialog"));
    const rows = assets
      .map(
        (a, i) =>
          `<div class="hang-row"><img src="${e(a.thumb || a.data)}" alt=""/><div><strong>${e(a.name)}</strong><label class="hang-width">Width<input type="number" data-hang="${i}" min="1" max="${MAX_WIDTH}" step="any" inputmode="decimal" required aria-label="Width of ${e(a.name)} in inches"/><small>in</small></label><output data-hang-height="${i}" class="muted">Height follows the picture</output></div></div>`,
      )
      .join("");
    document.querySelector("#dialog-content").innerHTML =
      `<h2>How wide is each one?</h2><p class="muted">In inches, as the work hangs, frame included. The height follows the picture's shape.</p><form id="hang-form" class="hang-form" novalidate>${rows}<p class="hang-error" role="alert" hidden>Give each picture its width, from 1 to ${MAX_WIDTH} inches.</p><div class="button-row"><button type="button" id="hang-cancel">Cancel</button><button type="submit" class="primary" id="hang-go">Hang ${assets.length === 1 ? "it" : "them"}</button></div></form>`;
    const field = (i) => /** @type {HTMLInputElement} */ (document.querySelector(`[data-hang="${i}"]`));
    const width = (i) => {
      const v = Number(field(i).value);
      return v >= 1 && v <= MAX_WIDTH ? v : NaN;
    };
    document.querySelector("#hang-form").addEventListener("input", (ev) => {
      const i = /** @type {HTMLInputElement} */ (ev.target).dataset.hang;
      if (i === undefined) return;
      const w = width(+i);
      document.querySelector(`[data-hang-height="${i}"]`).textContent = Number.isFinite(w) ? `${inches(w)} × ${inches(heightFor(assets[+i], w))} high` : "Height follows the picture";
    });
    /** @type {HTMLButtonElement} */ (document.querySelector("#hang-cancel")).onclick = () => d.close();
    // The form's own submit (Hang them, or Enter in a width), checked here
    // rather than by the browser, whose bubble would say something else.
    /** @type {HTMLFormElement} */ (document.querySelector("#hang-form")).onsubmit = (ev) => {
      ev.preventDefault();
      const missing = assets.findIndex((_, i) => !Number.isFinite(width(i)));
      if (missing >= 0) {
        /** @type {HTMLElement} */ (document.querySelector(".hang-error")).hidden = false;
        field(missing).focus();
        return;
      }
      d.close();
      /** @type {any[]} */
      let placed = [];
      mutate(() => {
        const pictures = assets.map((a, i) => {
          const id = uid();
          ctx.p.assets[id] = { ...a, role: "artwork" };
          return { asset: id, width: width(i) };
        });
        placed = hangNew(ctx.p, pictures);
      });
      const n = placed.length;
      const left = assets.length - n;
      toast(
        n
          ? `${n} work${n === 1 ? "" : "s"} hung at the width you gave.${left ? ` ${left} more wait in your library: a booth holds ${MAX_PLACEMENTS} placements.` : ""} Space them evenly evens out each wall.`
          : `No wall had room: a booth holds ${MAX_PLACEMENTS} placements. Your pictures are in the library.`,
        !n,
      );
    };
    d.showModal();
    field(0)?.focus();
  }

  return { pick: () => input.click() };
}
