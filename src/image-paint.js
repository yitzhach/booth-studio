// Painting an image's edits onto a canvas: the one part of the image edits
// that needs a document. The rules — what an edit is, which edits are valid,
// the shape one gives — are in src/image-edit.js, which the scene build that
// studio-api runs imports; this half stays in the browser (main.js,
// scene.js), so the type check can hold that build to a Worker's globals.
import { normalizeImageEdits } from "./image-edit.js";

export function applyImageEdits(source, value) {
  const e = normalizeImageEdits(value);
  const sideways = e.rotation % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = sideways ? source.height : source.width;
  canvas.height = sideways ? source.width : source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((e.rotation * Math.PI) / 180);
  ctx.scale(e.flipX ? -1 : 1, e.flipY ? -1 : 1);
  ctx.filter = [
    `brightness(${Math.pow(2, e.exposure) * 100}%)`,
    `contrast(${100 + e.contrast}%)`,
    `saturate(${100 + e.saturation}%)`,
  ].join(" ");
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  ctx.restore();

  if (e.temperature || e.tint) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const warm = e.temperature * 0.55;
    const tint = e.tint * 0.38;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + warm + Math.max(0, tint) * 0.35));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] - tint));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] - warm + Math.max(0, tint) * 0.35));
    }
    ctx.putImageData(image, 0, 0);
  }
  return canvas;
}
