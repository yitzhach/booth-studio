// The Export tab's actions: the PNG, the hero set, the AI render's pack and
// its render, the show pack, the hanging guide, elevations, the .glb, the
// saved views as PNGs, and Keep your work's and Something wrong?'s buttons.
// The Video tab's clip and batch are src/actions/video.js. Merged back into
// main.js's one action table with Object.assign. Moved out of src/main.js's
// boot() as it was (MAIN_SPLIT_PHASE.md, seam 14): `ctx` is boot's state,
// read and set through it, and the helpers these call.
import { escapeHTML as e } from "../model.js";
import { download } from "../storage.js";
import { readSession } from "../studio-session.js";
import { elevationsHTML } from "../elevations.js";
import { provider as aiProvider, render as aiRender } from "../ai-render.js";
import { hangingGuide } from "../guide.js";
import { showPack } from "../showpack.js";
import { recentErrors, reportText } from "../report.js";

export function createExportActions(ctx) {
  const { makeAiPack, paintKeepSafe, renderInspector, runHeroSet, safeName, toast } = ctx;
  return {
    // Report a problem (src/report.js): copied, never sent. Where the
    // clipboard is refused, the report opens in a dialog to copy by hand.
    "copy-report": async () => {
      const text = reportText({
        build: ctx.BUILD,
        href: location.href,
        userAgent: navigator.userAgent,
        viewport: `${innerWidth}×${innerHeight} @${devicePixelRatio}x`,
        signedIn: !!readSession(),
        project: ctx.p,
        assets: window.BOOTH_ASSETS,
        errors: recentErrors(),
      });
      try {
        await navigator.clipboard.writeText(text);
        toast("Problem report copied. Paste it into a message to whoever looks after Booth Studio.");
      } catch {
        const d = document.querySelector("#dialog");
        document.querySelector("#dialog-content").innerHTML =
          `<h2>Problem report</h2><p class="muted">Select it all and copy it into a message. Nothing has been sent.</p><textarea class="report-text" readonly rows="14" aria-label="Problem report">${e(text)}</textarea><div class="button-row"><button class="primary" id="report-close">Done</button></div>`;
        document.querySelector("#report-close").onclick = () => d.close();
        d.showModal();
        document.querySelector(".report-text")?.select();
      }
    },
    // The one place persist() is asked: Firefox answers with a permission
    // prompt, so it waits for this button (src/keep-safe.js).
    "keep-device-copy": async () => {
      let granted = false;
      const askable = typeof navigator.storage?.persist === "function";
      try {
        if (askable) granted = !!(await navigator.storage.persist());
      } catch {}
      toast(
        granted
          ? "This browser will keep this device's copy until you clear it yourself."
          : `${askable ? "This browser said no." : "This browser can't be asked to keep it."} Download a backup now and then, or sign in to keep your booths in your studio.`,
        !granted,
      );
      paintKeepSafe(true);
    },
    "show-pack": () => {
      download(
        new Blob([showPack(ctx.p)], { type: "text/html" }),
        safeName() + "-show-pack.html",
      );
      toast("Show pack downloaded: floor plan, inventory and packing list. Open it to print or save as PDF.");
    },
    guide: () => {
      download(
        new Blob([hangingGuide(ctx.p)], { type: "text/html" }),
        safeName() + "-hanging-guide.html",
      );
      toast("Hanging guide downloaded. Open it to print or save as PDF.");
    },
    "export-image": async () => {
      if (ctx.busy) return toast("Another export is still running: try again in a moment.");
      ctx.busy = true;
      const b = document.querySelector('[data-action="export-image"]');
      b.disabled = true;
      b.textContent = "Rendering…";
      try {
        // The Video tab offers the same PNG without the size menu beside it,
        // so the menu is read when it is there and the high setting assumed
        // when it is not.
        // The Video tab offers the same PNG without the size menu beside it,
        // so the menu is read when it is there and the remembered setting
        // used when it is not.
        const long = Number(document.querySelector("#export-size")?.value) || ctx.exportLong,
          // A photograph has a shape of its own — its own pixels — and a
          // frame here would crop or letterbox it, so the frame is the 3D
          // booth's alone and photo mode keeps taking a width.
          blob = await (ctx.p.mode === "photo"
            ? ctx.photo.export(long)
            : ctx.scene?.export(long, { frame: ctx.exportFrame, custom: ctx.customFrame, place: ctx.framePlace.export }));
        if (!blob)
          throw new Error(
            "3D is not available. Photo exports and guides still work.",
          );
        download(blob, safeName() + "-" + ctx.p.mode + ".png");
        toast(`${long} px PNG exported.`);
      } catch (err) {
        toast(err.message, true);
      } finally {
        ctx.busy = false;
        renderInspector();
      }
    },
    "ai-pack": async () => {
      if (ctx.busy) return;
      ctx.busy = true;
      try {
        const pack = await makeAiPack();
        download(new Blob([JSON.stringify(pack)], { type: "application/json" }), safeName() + "-ai-render.json");
        toast(`AI render pack downloaded: ${pack.width} × ${pack.height} frame, depth and mask, and the scene in words.`);
      } catch (err) {
        toast(err.message, true);
      } finally {
        ctx.busy = false;
      }
    },
    "ai-render": async () => {
      if (ctx.busy) return;
      ctx.busy = true;
      try {
        // With no provider this is where it stops, and says why — before
        // three passes are rendered for nothing; with one, its image comes
        // back as a download.
        const out = await aiRender(aiProvider ? await makeAiPack() : null);
        download(out, safeName() + "-ai.png");
      } catch (err) {
        toast(err.message, true);
      } finally {
        ctx.busy = false;
      }
    },
    "hero-export": () => runHeroSet(),
    "export-glb": async () => {
      if (ctx.busy || !ctx.scene) return;
      ctx.busy = true;
      try {
        toast("Writing the booth as .glb…");
        const blob = await ctx.scene.exportGLB();
        download(blob, safeName() + ".glb");
        toast(`Booth exported as .glb · ${(blob.size / 1048576).toFixed(1)} MB. Opens in SketchUp (with the glTF importer), Blender and AR viewers.`);
      } catch (err) {
        toast(err.message || "The .glb could not be written.", true);
      } finally {
        ctx.busy = false;
      }
    },
    elevations: () => {
      download(new Blob([elevationsHTML(ctx.p)], { type: "text/html" }), safeName() + "-elevations.html");
      toast("Elevations downloaded: a floor plan and every hung wall, to scale. Print at 100%.");
    },
    "views-export": async () => {
      if (ctx.busy || !ctx.scene) return;
      const views = ctx.p.views || [];
      if (!views.length) return;
      ctx.busy = true;
      const back = ctx.scene.pose();
      try {
        for (const [i, v] of views.entries()) {
          toast(`Rendering ${i + 1} of ${views.length}: ${v.name}…`);
          ctx.scene.applyPose(v);
          const blob = await ctx.scene.export(ctx.exportLong, { frame: ctx.exportFrame, custom: ctx.customFrame, place: ctx.framePlace.export });
          if (blob) download(blob, `${safeName()}-${v.name.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "") || "view-" + (i + 1)}.png`);
        }
        toast(`${views.length} views exported as ${ctx.exportLong} px PNGs.`);
      } catch (err) {
        toast(err.message, true);
      } finally {
        ctx.scene.applyPose(back);
        ctx.busy = false;
      }
    },
  };
}
