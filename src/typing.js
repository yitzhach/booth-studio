// Whether a key press is typing in a field, so the app's own shortcuts leave
// it alone. A key typed inside a shadow root (the studio assistant's chat box,
// src/studio-assistant.js) reaches a document listener retargeted to the
// shadow host, so `ev.target` is <studio-assistant>, not the textarea: the
// first entry of the event's composed path is the element really typed in.
// Testing `ev.target` alone made Backspace in the chat box delete the
// selected artwork instead of a letter (2026-10-07).
export function typingIn(ev, also = "") {
  const t = (ev.composedPath?.()[0]) || ev.target;
  if (!t || t.nodeType !== 1) return false;
  return !!t.isContentEditable || t.matches(`input,textarea,select,[contenteditable]${also}`);
}
