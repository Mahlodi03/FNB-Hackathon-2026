import type { IntegrityEventType } from "../../contracts/domain";

export type BrowserScreenDetails = EventTarget & { screens: readonly unknown[] };
export const CAMERA_ONLY_CONSTRAINTS: MediaStreamConstraints = { video: true, audio: false };

/** Browser signals are fallible. This attaches only after preflight and owns its cleanup. */
export function attachIntegrityObservers(input: {
  document: Document;
  window: Window;
  stream: MediaStream;
  screenDetails?: BrowserScreenDetails | null;
  onEvent: (type: IntegrityEventType) => void;
  onCameraEnded?: () => void;
}): () => void {
  const { document: doc, window: win, stream, screenDetails, onEvent, onCameraEnded } = input;
  let screenCount = screenDetails?.screens.length;
  const onVisibility = () => { if (doc.hidden) onEvent("tab_hidden"); };
  const onBlur = () => onEvent("window_blur");
  const onFullscreen = () => { if (!doc.fullscreenElement) onEvent("fullscreen_exit"); };
  const onPaste = () => onEvent("paste_attempt");
  const onCopy = () => onEvent("copy_attempt");
  const onEnded = () => { onEvent("camera_track_ended"); onCameraEnded?.(); };
  const onScreensChange = () => {
    const updated = screenDetails?.screens.length;
    if (screenCount !== updated) { screenCount = updated; onEvent("display_change"); }
  };
  const onCurrentScreenChange = () => onEvent("display_change");
  doc.addEventListener("visibilitychange", onVisibility);
  win.addEventListener("blur", onBlur);
  doc.addEventListener("fullscreenchange", onFullscreen);
  doc.addEventListener("paste", onPaste, { capture: true });
  doc.addEventListener("copy", onCopy, { capture: true });
  stream.getVideoTracks().forEach((track) => track.addEventListener("ended", onEnded));
  screenDetails?.addEventListener("screenschange", onScreensChange);
  screenDetails?.addEventListener("currentscreenchange", onCurrentScreenChange);
  return () => {
    doc.removeEventListener("visibilitychange", onVisibility);
    win.removeEventListener("blur", onBlur);
    doc.removeEventListener("fullscreenchange", onFullscreen);
    doc.removeEventListener("paste", onPaste, { capture: true });
    doc.removeEventListener("copy", onCopy, { capture: true });
    stream.getVideoTracks().forEach((track) => track.removeEventListener("ended", onEnded));
    screenDetails?.removeEventListener("screenschange", onScreensChange);
    screenDetails?.removeEventListener("currentscreenchange", onCurrentScreenChange);
  };
}
