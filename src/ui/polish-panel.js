// Looks and Make it beautiful (src/polish.js) in the Lighting tab, and the
// hero set at the top of Export: their sections and what their buttons run.
// Moved out of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam 4):
// `ctx` is boot's state, read through it, and the helpers this calls.
import { escapeHTML as e } from "../model.js";
import { resolveJob } from "../batch.js";
import { videoSupported } from "../video.js";
import { HERO_CLIP, LOOKS, applyLook, currentLook, heroShots, polish } from "../polish.js";

// Make it beautiful's promise, said beside its button wherever it appears.
const POLISH_NOTE = "The look for this venue, every wall hung evenly on the 60″ line, and the spotlights aimed at the work. One undo puts it all back.";
export const HALL_OFF_NOTE = "Exhibition hall switched off: this booth now stands in the photographed environment. Art show → Exhibition hall brings it back.";

export function createPolishPanel(ctx) {
  const { allowed, btn, kit, mutate, runClips, toast } = ctx;
  // Looks and Make it beautiful (src/polish.js).
  function looksSection() {
    // The look the booth is in stays marked until a value of it is changed by hand.
    const now = currentLook(ctx.p);
    return `<section><h3>Looks</h3>${btn("polish", "Make it beautiful", "sparkles", "primary wide")}<p class="muted">${e(POLISH_NOTE)}</p><div class="look-grid">${Object.entries(LOOKS).map(([k, l]) => `<button type="button" data-action="look-${k}" title="${e(l.blurb)}" aria-label="Look: ${e(l.label)}${k === now ? " (this booth's look now)" : ""}"${k === now ? ' class="active" aria-current="true"' : ""}><strong>${e(l.label)}</strong><span>${e(l.blurb)}</span></button>`).join("")}</div><p class="muted">A look sets the environment, the room light and the spotlights' colour and power together. Every value stays editable below.</p></section>`;
  }
  /** Export's first section: polish, then the hero set in one press. */
  function heroSection() {
    const names = heroShots(ctx.p).map((s) => s.name);
    const clip = allowed("video") && videoSupported();
    return `<section><h3>Hero set</h3>${btn("polish", "Make it beautiful", "sparkles", "wide")}<p class="muted">${e(POLISH_NOTE)}</p>${ctx.busyVideo ? btn("cancel-video", "Cancel export", "x", "wide") : btn("hero-export", "Export the hero set", "images", "primary wide")}<div class="video-progress"></div><p class="muted">${names.length} PNGs at 4096 px, widescreen — ${e(names.join(", "))}${clip ? ` — and a ${HERO_CLIP.seconds} s orbit as MP4` : ""}. The pictures a jury, a promoter or a post asks for, each from its own camera; the view on screen is not moved.</p></section>`;
  }
  async function runHeroSet() {
    if (ctx.busy || ctx.busyVideo) return;
    if (!ctx.scene || ctx.p.mode !== "3d") return toast("3D is not available, so there is no view to export.", true);
    const k = kit();
    // The export cuts its frame out of the viewport, so the shots are fitted to its shape.
    const host = document.querySelector("#scene");
    const aspect = host?.clientWidth && host?.clientHeight ? host.clientWidth / host.clientHeight : 16 / 9;
    const stills = heroShots(ctx.p, { aspect }).map((s) => ({ ...resolveJob({ kind: "still", pose: s.pose, set: { long: 4096, frame: "desktop" } }, k), name: s.name }));
    const clip = allowed("video") && videoSupported() ? [{ ...resolveJob({ kind: "clip", move: HERO_CLIP.move, seconds: HERO_CLIP.seconds, set: { frame: "desktop" } }, k), name: "Orbit" }] : [];
    await runClips([...stills, ...clip], { batch: true });
  }
  function runLook(key) {
    if (ctx.p.mode !== "3d") return;
    let r;
    mutate(() => (r = applyLook(ctx.p, key)));
    if (r) toast(`${LOOKS[r.look].label}.${r.hallOff ? ` ${HALL_OFF_NOTE}` : ""} Undo puts the last look back.`);
  }
  function runPolish() {
    if (ctx.p.mode !== "3d") return;
    let r;
    mutate(() => (r = polish(ctx.p)));
    ctx.actions["reset-view"]();
    const n = (k, one) => `${k} ${one}${k === 1 ? "" : "s"}`;
    toast(`${LOOKS[r.look].label} · ${n(r.walls, "wall")} hung evenly · ${n(r.lights, "spotlight")} aimed at the work.${r.hallOff ? ` ${HALL_OFF_NOTE}` : ""} Undo puts it all back.`);
  }
  return { looksSection, heroSection, runHeroSet, runLook, runPolish };
}
