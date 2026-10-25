
import { describe, expect, it } from "vitest";
import { createFaceSignalTracker } from "./faceDetection";

describe("MediaPipe face detection signals", () => {
  it("reports a missing face only after 10 seconds", () => {
    const tracker = createFaceSignalTracker();

    expect(tracker.observe(0, 0)).toBeNull();
    expect(tracker.observe(0, 5000)).toBeNull();
    expect(tracker.observe(0, 9999)).toBeNull();

    expect(tracker.observe(0, 10000)).toBe("face_missing");

    // Do not repeatedly report the same incident.
    expect(tracker.observe(0, 15000)).toBeNull();
  });

  it("reports multiple faces only after 5 seconds", () => {
    const tracker = createFaceSignalTracker();

    expect(tracker.observe(2, 0)).toBeNull();
    expect(tracker.observe(2, 3000)).toBeNull();
    expect(tracker.observe(2, 4999)).toBeNull();

    expect(tracker.observe(2, 5000)).toBe("multiple_faces");

    // The same incident should not be reported again.
    expect(tracker.observe(3, 8000)).toBeNull();
  });

  it("resets the timer when one face is visible", () => {
    const tracker = createFaceSignalTracker();

    expect(tracker.observe(0, 0)).toBeNull();
    expect(tracker.observe(0, 9000)).toBeNull();

    // Normal observation resets the missing-face incident.
    expect(tracker.observe(1, 10000)).toBeNull();

    expect(tracker.observe(0, 11000)).toBeNull();
    expect(tracker.observe(0, 20000)).toBeNull();

    expect(tracker.observe(0, 21000)).toBe("face_missing");
  });

  it("starts a new timer when the signal type changes", () => {
    const tracker = createFaceSignalTracker();

    expect(tracker.observe(0, 0)).toBeNull();
    expect(tracker.observe(0, 7000)).toBeNull();

    // Change from no face to multiple faces.
    expect(tracker.observe(2, 8000)).toBeNull();
    expect(tracker.observe(2, 12000)).toBeNull();

    expect(tracker.observe(2, 13000)).toBe("multiple_faces");
  });

  it("resets detection after invalid observations", () => {
    const tracker = createFaceSignalTracker();

    expect(tracker.observe(0, 0)).toBeNull();
    expect(tracker.observe(0, 9000)).toBeNull();

    // Invalid observations must not create evidence.
    expect(tracker.observe(-1, 9500)).toBeNull();

    expect(tracker.observe(0, 10000)).toBeNull();
    expect(tracker.observe(0, 20000)).toBe("face_missing");
  });
});
