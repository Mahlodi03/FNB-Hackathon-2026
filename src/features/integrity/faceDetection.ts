
import type { IntegrityEventType } from "@/contracts/domain";

type FaceSignal = Extract<
  IntegrityEventType,
  "face_missing" | "multiple_faces"
>;

const SAMPLE_INTERVAL_MS = 1000;
const FACE_MISSING_MS = 10000;
const MULTIPLE_FACES_MS = 5000;

/**
 * Requires sustained observations before producing an event.
 * Reports each continuous incident only once.
 */
export function createFaceSignalTracker() {
  let currentSignal: FaceSignal | null = null;
  let firstObservedAt = 0;
  let reported = false;

  const reset = () => {
    currentSignal = null;
    firstObservedAt = 0;
    reported = false;
  };

  const observe = (
    faceCount: number,
    timestamp: number
  ): FaceSignal | null => {
    if (
      !Number.isInteger(faceCount) ||
      faceCount < 0 ||
      !Number.isFinite(timestamp)
    ) {
      reset();
      return null;
    }

    const nextSignal: FaceSignal | null =
      faceCount === 0
        ? "face_missing"
        : faceCount > 1
          ? "multiple_faces"
          : null;

    // A single face is the normal observation.
    if (nextSignal === null) {
      reset();
      return null;
    }

    // Start timing a new type of observation.
    if (nextSignal !== currentSignal) {
      currentSignal = nextSignal;
      firstObservedAt = timestamp;
      reported = false;
      return null;
    }

    const threshold =
      nextSignal === "face_missing"
        ? FACE_MISSING_MS
        : MULTIPLE_FACES_MS;

    if (
      !reported &&
      timestamp - firstObservedAt >= threshold
    ) {
      reported = true;
      return nextSignal;
    }

    return null;
  };

  return { observe, reset };
}

/**
 * Performs face detection in the browser.
 *
 * No camera frames, face coordinates, or landmarks
 * are transmitted to the server.
 *
 * Returns a cleanup function that also works
 * while the MediaPipe model is still loading.
 */
export function attachLocalFaceDetection({
  video,
  onEvent,
  onError,
}: {
  video: HTMLVideoElement;
  onEvent: (eventType: FaceSignal) => void;
  onError?: () => void;
}): () => void {
  let stopped = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let closeDetector: (() => void) | null = null;
  let lastVideoTime = -1;

  const tracker = createFaceSignalTracker();

  const stop = () => {
    if (stopped) return;

    stopped = true;

    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }

    closeDetector?.();
    closeDetector = null;

    tracker.reset();
  };

  void (async () => {
    try {
      const { FaceDetector, FilesetResolver } =
        await import("@mediapipe/tasks-vision");

      if (stopped) return;

      const vision = await FilesetResolver.forVisionTasks(
        "/mediapipe/wasm"
      );

      if (stopped) return;

      const detector = await FaceDetector.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              "/models/blaze_face_short_range.tflite",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.55,
        }
      );

      // The user might have stopped monitoring
      // while the model was loading.
      if (stopped) {
        detector.close();
        return;
      }

      closeDetector = () => detector.close();

      interval = setInterval(() => {
        if (stopped) return;

        // Do not interpret an unavailable or frozen
        // video frame as a missing face.
        if (
          document.hidden ||
          video.paused ||
          video.ended ||
          video.readyState <
            HTMLMediaElement.HAVE_CURRENT_DATA ||
          video.videoWidth === 0 ||
          video.videoHeight === 0 ||
          video.currentTime <= lastVideoTime
        ) {
          tracker.reset();
          return;
        }

        lastVideoTime = video.currentTime;

        try {
          const timestamp = performance.now();

          const result = detector.detectForVideo(
            video,
            timestamp
          );

          const signal = tracker.observe(
            result.detections.length,
            timestamp
          );

          if (signal) {
            onEvent(signal);
          }
        } catch {
          stop();
          onError?.();
        }
      }, SAMPLE_INTERVAL_MS);
    } catch {
      if (!stopped) {
        stop();
        onError?.();
      }
    }
  })();

  return stop;
}
