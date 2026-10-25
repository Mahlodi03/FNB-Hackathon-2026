
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IntegrityEventType } from "@/contracts/domain";
import {
  attachIntegrityObservers,
  CAMERA_ONLY_CONSTRAINTS,
  type BrowserScreenDetails,
} from "./observers";
import { attachLocalFaceDetection } from "./faceDetection";

type ScreenDetailsLike = BrowserScreenDetails;

type WindowWithScreenDetails = Window & {
  getScreenDetails?: () => Promise<ScreenDetailsLike>;
};

export type PreflightStatus =
  | "idle"
  | "checking"
  | "ready"
  | "blocked"
  | "stopped";

export type ScreenCapability =
  | "unknown"
  | "supported"
  | "unsupported"
  | "denied";

export type IntegrityMonitorOptions = {
  /** P2 supplies a genuine server-issued attempt ID, never a student ID. */
  attemptId?: string;
  /** Requires permission for experimental getScreenDetails. Default false. */
  strictScreenMode?: boolean;
  onReady?: () => void;
};

/**
 * Privacy-aware integrity monitoring.
 *
 * - Camera only; no microphone access.
 * - MediaPipe face detection runs locally.
 * - No camera footage or face coordinates are uploaded.
 * - Integrity events are sent only for a server-issued attempt.
 * - Camera and observer resources are released on stop/unmount.
 */
export function useIntegrityMonitor({
  attemptId,
  strictScreenMode = false,
  onReady,
}: IntegrityMonitorOptions) {
  const [status, setStatus] = useState<PreflightStatus>("idle");
  const [notice, setNotice] = useState<string>("");
  const [screenCapability, setScreenCapability] =
    useState<ScreenCapability>("unknown");
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const screensRef = useRef<ScreenDetailsLike | null>(null);

  const ownsFullscreenRef = useRef(false);
  const aliveRef = useRef(true);
  const observingRef = useRef(false);

  const lastSentRef = useRef<Map<IntegrityEventType, number>>(
    new Map()
  );
  const sentWithinMinuteRef = useRef<number[]>([]);

  /**
   * Release camera and fullscreen resources.
   * Used for voluntary stopping and unexpected camera interruption.
   */
  const stop = useCallback(() => {
    observingRef.current = false;

    // Stop all camera tracks.
    mediaRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    mediaRef.current = null;
    screensRef.current = null;

    // Clear the camera preview.
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Exit fullscreen if this monitor started it.
    if (
      ownsFullscreenRef.current &&
      document.fullscreenElement
    ) {
      void document.exitFullscreen().catch(() => {
        // Browser can deny exit while navigating.
      });
    }

    ownsFullscreenRef.current = false;

    setStatus("stopped");
  }, []);

  /**
   * Cleanup on component unmount.
   */
  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;
      observingRef.current = false;

      mediaRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      mediaRef.current = null;
      screensRef.current = null;

      if (
        ownsFullscreenRef.current &&
        document.fullscreenElement
      ) {
        void document.exitFullscreen().catch(() => {});
      }

      ownsFullscreenRef.current = false;
    };
  }, []);

  /**
   * Connect the camera stream to the local video preview.
   */
  useEffect(() => {
    if (
      status === "ready" &&
      videoRef.current &&
      mediaRef.current
    ) {
      videoRef.current.srcObject = mediaRef.current;

      void videoRef.current.play().catch(() => {
        // Autoplay may require user interaction.
      });
    }
  }, [status]);

  /**
   * Camera and browser preflight.
   */
  const startPreflight = useCallback(async () => {
    if (!rulesAccepted) {
      setNotice(
        "Accept the assessment rules and privacy notice first."
      );
      return;
    }

    if (typeof window === "undefined") return;

    if (!window.isSecureContext) {
      setStatus("blocked");
      setNotice(
        "A secure HTTPS connection (or localhost) is required."
      );
      return;
    }

    if (
      window.innerWidth < 768 ||
      !window.matchMedia("(pointer: fine)").matches
    ) {
      setStatus("blocked");
      setNotice(
        "This assessment requires a desktop or laptop " +
          "with a mouse or trackpad."
      );
      return;
    }

    if (
      !document.fullscreenEnabled ||
      !document.documentElement.requestFullscreen
    ) {
      setStatus("blocked");
      setNotice(
        "Full-screen mode is not supported or is disabled " +
          "by this browser."
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("blocked");
      setNotice(
        "This browser cannot request a live camera feed."
      );
      return;
    }

    const supportedScreenApi =
      typeof (window as WindowWithScreenDetails)
        .getScreenDetails === "function";

    setScreenCapability(
      supportedScreenApi ? "supported" : "unsupported"
    );

    if (strictScreenMode && !supportedScreenApi) {
      setStatus("blocked");
      setNotice(
        "Strict screen mode needs the experimental " +
          "Window Management API. Choose a supported HTTPS " +
          "desktop browser or ask the assessment organizer."
      );
      return;
    }

    setNotice("");
    setStatus("checking");

    // Permission requests are invoked in the user-gesture task.
    // No microphone is requested.
    let fullscreenPromise: Promise<void>;
    let cameraPromise: Promise<MediaStream>;
    let screenPromise: Promise<ScreenDetailsLike> | null = null;

    try {
      fullscreenPromise =
        document.documentElement.requestFullscreen();

      cameraPromise =
        navigator.mediaDevices.getUserMedia(
          CAMERA_ONLY_CONSTRAINTS
        );

      if (strictScreenMode) {
        screenPromise =
          (window as WindowWithScreenDetails)
            .getScreenDetails!();
      }
    } catch {
      setStatus("blocked");
      setNotice(
        "Unable to start camera or full-screen permission checks."
      );
      return;
    }

    const results = await Promise.allSettled([
      fullscreenPromise,
      cameraPromise,
      ...(screenPromise ? [screenPromise] : []),
    ]);

    const full = results[0];
    const camera = results[1];
    const screens = results[2];

    const stream =
      camera.status === "fulfilled"
        ? (camera.value as MediaStream)
        : null;

    if (!aliveRef.current) {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });

      if (
        full.status === "fulfilled" &&
        document.fullscreenElement
      ) {
        void document.exitFullscreen().catch(() => {});
      }

      return;
    }

    if (full.status === "fulfilled") {
      ownsFullscreenRef.current = true;
    }

    const liveVideo =
      stream?.getVideoTracks().some(
        (track) => track.readyState === "live"
      ) ?? false;

    const screenAllowed =
      !strictScreenMode ||
      screens?.status === "fulfilled";

    if (strictScreenMode && !screenAllowed) {
      setScreenCapability("denied");
    }

    if (
      full.status !== "fulfilled" ||
      !liveVideo ||
      !screenAllowed ||
      !document.fullscreenElement
    ) {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });

      if (
        ownsFullscreenRef.current &&
        document.fullscreenElement
      ) {
        void document.exitFullscreen().catch(() => {});
      }

      ownsFullscreenRef.current = false;

      const cause = !liveVideo
        ? "Camera permission was denied, or no active video track was found."
        : full.status !== "fulfilled" ||
            !document.fullscreenElement
          ? "Full-screen permission was denied or full-screen mode could not be maintained."
          : "Screen permission was denied or unavailable. " +
            "This is a technical limitation, not evidence of misconduct.";

      setNotice(cause);
      setStatus("blocked");
      return;
    }

    mediaRef.current = stream!;
    screensRef.current =
      screens?.status === "fulfilled"
        ? (screens.value as ScreenDetailsLike)
        : null;

    lastSentRef.current.clear();
    sentWithinMinuteRef.current = [];

    setStatus("ready");

    onReady?.();
  }, [rulesAccepted, strictScreenMode, onReady]);

  /**
   * Browser integrity monitoring and local MediaPipe detection.
   *
   * Both activate only after preflight and when
   * a valid server-issued attempt ID is available.
   */
  useEffect(() => {
    if (
      status !== "ready" ||
      !attemptId ||
      !mediaRef.current
    ) {
      return;
    }

    const stream = mediaRef.current;
    const details = screensRef.current;

    observingRef.current = true;

    let active = true;

    /**
     * Lightweight, server-timestamped monitoring transport receipt.
     * These browser-reported booleans are not independent proof that the camera
     * operated correctly and cannot authorize integrity clearance.
     * No media, faces, coordinates, answers or student IDs leave the browser.
     */
    const sendMonitoringReceipt = () => {
      if (!active || !observingRef.current) return;
      const cameraTrackLive = stream.getVideoTracks().some(
        (track) => track.readyState === "live" && track.enabled
      );
      void fetch(`/api/attempts/${encodeURIComponent(attemptId)}/monitoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          cameraTrackLive,
          fullscreenActive: Boolean(document.fullscreenElement),
          pageVisible: document.visibilityState === "visible",
        }),
      }).catch(() => {
        // A failed receipt creates a measurable coverage gap; do not label it
        // misconduct or interfere with an active timed assessment.
      });
    };
    sendMonitoringReceipt();
    const receiptInterval = window.setInterval(sendMonitoringReceipt, 30_000);

    /**
     * Send integrity event metadata to the backend.
     * The event throttling rules remain unchanged.
     */
    const send = (eventType: IntegrityEventType) => {
      if (!observingRef.current) return;

      const now = Date.now();

      // Five-second cooldown per event type.
      if (
        now -
          (lastSentRef.current.get(eventType) ?? -Infinity) <
        5_000
      ) {
        return;
      }

      // Maximum fifteen client events per minute.
      const times = sentWithinMinuteRef.current.filter(
        (time) => now - time < 60_000
      );

      if (times.length >= 15) {
        sentWithinMinuteRef.current = times;
        return;
      }

      lastSentRef.current.set(eventType, now);
      sentWithinMinuteRef.current = [...times, now];

      void fetch(
        `/api/attempts/${encodeURIComponent(attemptId)}/events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            eventType,
            occurredAt: new Date(now).toISOString(),
          }),
        }
      )
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Event endpoint unavailable (${response.status})`
            );
          }

          const json: unknown = await response.json();

          if (
            active &&
            typeof json === "object" &&
            json !== null &&
            "eventCount" in json &&
            typeof json.eventCount === "number"
          ) {
            setEventCount(json.eventCount);
          }
        })
        .catch(() => {
          if (active) {
            setNotice(
              "An integrity signal could not be saved. " +
                "Please notify your assessor if the problem continues."
            );
          }
        });
    };

    /**
     * Existing browser-event observers.
     */
    const detach = attachIntegrityObservers({
      document,
      window,
      stream,
      screenDetails: details,
      onEvent: send,

      /**
       * Unexpected camera interruption.
       *
       * attachIntegrityObservers sends camera_track_ended
       * before invoking this callback.
       */
      onCameraEnded: () => {
        // Release camera and fullscreen resources.
        stop();

        // An unexpected interruption is blocked,
        // not a voluntary stop.
        setStatus("blocked");

        setNotice(
          "The camera stream stopped unexpectedly. " +
            "Monitoring is no longer active. " +
            "Restore camera access and run preflight again if available. " +
            "If the assessment is in progress, inform your assessor. " +
            "This is a technical interruption, not evidence of misconduct."
        );
      },
    });

    /**
     * Local MediaPipe face detection.
     *
     * Sends face_missing and multiple_faces through
     * the existing event reporting function.
     */
    const detachFaceDetection = videoRef.current
      ? attachLocalFaceDetection({
          video: videoRef.current,

          onEvent: send,

          onError: () => {
            if (active && observingRef.current) {
              setNotice(
                "Local face detection is unavailable. " +
                  "Browser-event monitoring remains active."
              );
            }
          },
        })
      : () => {};

    /**
     * Stop all observers when monitoring ends.
     */
    return () => {
      observingRef.current = false;
      active = false;
      window.clearInterval(receiptInterval);

      detachFaceDetection();
      detach();
    };
  }, [attemptId, status, stop]);

  return {
    videoRef,
    status,
    notice,
    screenCapability,
    eventCount,
    rulesAccepted,
    setRulesAccepted,
    startPreflight,
    stop,
  };
}
