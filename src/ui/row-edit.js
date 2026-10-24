// The row of booths: `activeSlot` (which booth of the row new work goes
// into), `editRow` (one edit to the row as one undo step, which takes a
// removed booth's artwork with it), and `addRowBooths`, `addRowSpace`,
// `removeRowSlot` and `rowCount`, which are returned with `activeSlot`;
// `editRow` is only theirs. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 21): `ctx` is boot's state, read and set
// through it, and the helpers these call.
import { DEFAULT_SPACE, MAX_SLOTS, addBooths, addSpace, normalizeRow, removeSlot } from "../row.js";

export function createRowEdit(ctx) {
  const { mutate, toast } = ctx;
  /**
   * The booth of the row that new artwork goes into, as a slot id, or null for
   * this booth. Validated on the way out: a booth that has been removed
   * cannot stay selected, and the answer then is home.
   */
  function activeSlot() {
    if (!ctx.activeBooth) return null;
    const row = normalizeRow(ctx.p.booth);
    const slot = row.slots.find((x) => x.id === ctx.activeBooth && x.kind === "booth");
    if (!slot || slot.id === row.home) {
      ctx.activeBooth = null;
      return null;
    }
    return ctx.activeBooth;
  }
  /** The row, edited and written back. One undo step, like every other edit. */
  function editRow(fn) {
    mutate(() => {
      ctx.p.booth.row = fn(ctx.p.booth);
      // A booth that has just gone takes its artwork with it: leaving the
      // works behind would leave them hanging on walls that are not drawn,
      // which is the one state this row must never produce.
      const ids = new Set(
        normalizeRow(ctx.p.booth).slots.filter((x) => x.kind === "booth").map((x) => x.id),
      );
      ctx.p.art = ctx.p.art.filter((a) => !a.booth || ids.has(a.booth));
      activeSlot();
    });
  }
  function addRowBooths(side, count) {
    const before = normalizeRow(ctx.p.booth).slots.length;
    editRow((booth) => addBooths(booth, side, count));
    const added = normalizeRow(ctx.p.booth).slots.length - before;
    if (!added) {
      toast(`A row holds ${MAX_SLOTS} slots. Remove one to add another.`, true);
      return;
    }
    toast(
      `${added} booth${added === 1 ? "" : "s"} added to the ${side}. Pick one under “Hang new artwork in”, then tap an original.`,
    );
  }
  function addRowSpace(side) {
    const before = normalizeRow(ctx.p.booth).slots.length;
    editRow((booth) => addSpace(booth, side, DEFAULT_SPACE));
    if (normalizeRow(ctx.p.booth).slots.length === before) {
      toast(`A row holds ${MAX_SLOTS} slots. Remove one to add another.`, true);
      return;
    }
    toast(`A ${DEFAULT_SPACE}″ space added to the ${side}. Type its width to change it.`);
  }
  function removeRowSlot(id) {
    const hung = ctx.p.art.filter((a) => a.booth === id).length;
    editRow((booth) => removeSlot(booth, id));
    toast(hung ? `Booth removed, with the ${hung} work${hung === 1 ? "" : "s"} hung in it.` : "Removed from the row.");
  }
  const rowCount = () =>
    Math.max(1, Math.min(MAX_SLOTS, Math.round(+document.querySelector("#row-count")?.value || 1)));
  return { activeSlot, addRowBooths, addRowSpace, removeRowSlot, rowCount };
}
