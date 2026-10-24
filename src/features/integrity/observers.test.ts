import { describe, expect, it } from "vitest";
import { attachIntegrityObservers, CAMERA_ONLY_CONSTRAINTS, type BrowserScreenDetails } from "./observers";
import type { IntegrityEventType } from "../../contracts/domain";

class MockDocument extends EventTarget {
  hidden = false;
  fullscreenElement: Element | null = {} as Element;
}
class MockScreens extends EventTarget { screens: unknown[] = [1]; }

describe("local-only browser monitoring", () => {
  it("requests video only, never the microphone", () => {
    expect(CAMERA_ONLY_CONSTRAINTS).toEqual({ video: true, audio: false });
  });
  it("captures named signals and detaches every observer", () => {
    const doc = new MockDocument();
    const win = new EventTarget();
    const track = new EventTarget();
    const screens = new MockScreens();
    const stream = { getVideoTracks: () => [track] } as unknown as MediaStream;
    const received: IntegrityEventType[] = [];
    const detach = attachIntegrityObservers({
      document: doc as unknown as Document, window: win as unknown as Window,
      stream, screenDetails: screens as BrowserScreenDetails, onEvent: (type) => received.push(type),
    });
    doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("blur"));
    doc.fullscreenElement = null; doc.dispatchEvent(new Event("fullscreenchange"));
    doc.dispatchEvent(new Event("paste")); doc.dispatchEvent(new Event("copy"));
    track.dispatchEvent(new Event("ended"));
    screens.screens = [1,2]; screens.dispatchEvent(new Event("screenschange"));
    screens.dispatchEvent(new Event("currentscreenchange"));
    expect(received).toEqual(["tab_hidden", "window_blur", "fullscreen_exit", "paste_attempt", "copy_attempt", "camera_track_ended", "display_change", "display_change"]);
    detach();
    received.length = 0;
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("blur"));
    doc.dispatchEvent(new Event("paste"));
    track.dispatchEvent(new Event("ended"));
    screens.dispatchEvent(new Event("screenschange"));
    expect(received).toEqual([]);
  });
});
