const dbPromise = new Promise((resolve, reject) => {
  const r = indexedDB.open("artist-os-booth-studio", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("projects");
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
export async function load() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const r = db.transaction("projects").objectStore("projects").get("current");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function save(p) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(p, "current");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
export async function readImage(file) {
  if (!["image/png", "image/jpeg"].includes(file.type))
    throw new Error("Choose an original JPG or PNG image.");
  if (file.size > 25 * 1024 * 1024)
    throw new Error("Choose an image smaller than 25 MB.");
  const data = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("This file could not be read."));
    r.readAsDataURL(file);
  });
  const im = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("This image could not be decoded."));
    i.src = data;
  });
  if (im.width * im.height > 100000000)
    throw new Error("Please use an image below 100 megapixels.");
  return { data, width: im.width, height: im.height, name: file.name };
}
