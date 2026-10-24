"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IntegrityEventType } from "@/contracts/domain";
import { attachIntegrityObservers, CAMERA_ONLY_CONSTRAINTS, type BrowserScreenDetails } from "./observers";

type ScreenDetailsLike = BrowserScreenDetails;
type WindowWithScreenDetails = Window & { getScreenDetails?: () => Promise<ScreenDetailsLike> };
export type PreflightStatus = "idle" | "checking" | "ready" | "blocked" | "stopped";
export type ScreenCapability = "unknown" | "supported" | "unsupported" | "denied";
export type IntegrityMonitorOptions = {
  /** P2 supplies a genuine server-issued attempt ID, never a student ID. */
  attemptId?: string;
  /** Requires permission for experimental getScreenDetails. Default false. */
  strictScreenMode?: boolean;
  onReady?: () => void;
};

/**
 * Mount for preflight; attach event observers only when status is ready AND attemptId exists.
 * Stop/unmount releases the camera and all listeners. No captured media is transmitted.
 */
export function useIntegrityMonitor({ attemptId, strictScreenMode = false, onReady }: IntegrityMonitorOptions) {
  const [status, setStatus] = useState<PreflightStatus>("idle");
  const [notice, setNotice] = useState<string>("");
  const [screenCapability, setScreenCapability] = useState<ScreenCapability>("unknown");
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const screensRef = useRef<ScreenDetailsLike | null>(null);
  const ownsFullscreenRef = useRef(false);
  const aliveRef = useRef(true);
  const observingRef = useRef(false);
  const lastSentRef = useRef<Map<IntegrityEventType, number>>(new Map());
  const sentWithinMinuteRef = useRef<number[]>([]);

  const stop = useCallback(() => {
    observingRef.current = false;
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    screensRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (ownsFullscreenRef.current && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => { /* Browser can deny exit while navigating. */ });
    }
    ownsFullscreenRef.current = false;
    setStatus("stopped");
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      observingRef.current = false;
      mediaRef.current?.getTracks().forEach((track) => track.stop());
      mediaRef.current = null;
      screensRef.current = null;
      // Never call React state setters on unmount.
      if (ownsFullscreenRef.current && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
      ownsFullscreenRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (status === "ready" && videoRef.current && mediaRef.current) {
      videoRef.current.srcObject = mediaRef.current;
      void videoRef.current.play().catch(() => { /* autoplay may require user interaction */ });
    }
  }, [status]);

  const startPreflight = useCallback(async () => {
    if (!rulesAccepted) { setNotice("Accept the assessment rules and privacy notice first."); return; }
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) { setStatus("blocked"); setNotice("A secure HTTPS connection (or localhost) is required."); return; }
    if (window.innerWidth < 768 || !window.matchMedia("(pointer: fine)").matches) {
      setStatus("blocked"); setNotice("This assessment requires a desktop or laptop with a mouse or trackpad."); return;
    }
    if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
      setStatus("blocked"); setNotice("Full-screen mode is not supported or is disabled by this browser."); return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("blocked"); setNotice("This browser cannot request a live camera feed."); return;
    }
    const supportedScreenApi = typeof (window as WindowWithScreenDetails).getScreenDetails === "function";
    setScreenCapability(supportedScreenApi ? "supported" : "unsupported");
    if (strictScreenMode && !supportedScreenApi) {
      setStatus("blocked"); setNotice("Strict screen mode needs the experimental Window Management API. Choose a supported HTTPS desktop browser or ask the assessment organizer."); return;
    }
    setNotice("");
    setStatus("checking");
    // Invoke gated APIs in the same user-gesture task. No microphone is ever requested.
    let fullscreenPromise: Promise<void>;
    let cameraPromise: Promise<MediaStream>;
    let screenPromise: Promise<ScreenDetailsLike> | null = null;
    try {
      fullscreenPromise = document.documentElement.requestFullscreen();
      cameraPromise = navigator.mediaDevices.getUserMedia(CAMERA_ONLY_CONSTRAINTS);
      if (strictScreenMode) screenPromise = (window as WindowWithScreenDetails).getScreenDetails!();
    } catch {
      setStatus("blocked"); setNotice("Unable to start camera or full-screen permission checks."); return;
    }

    const results = await Promise.allSettled([fullscreenPromise, cameraPromise, ...(screenPromise ? [screenPromise] : [])]);
    const full = results[0];
    const camera = results[1];
    const screens = results[2];
    const stream = camera.status === "fulfilled" ? camera.value as MediaStream : null;
    if (!aliveRef.current) {
      stream?.getTracks().forEach((track) => track.stop());
      if (full.status === "fulfilled" && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      return;
    }
    if (full.status === "fulfilled") ownsFullscreenRef.current = true;
    const liveVideo = stream?.getVideoTracks().some((track) => track.readyState === "live") ?? false;
    const screenAllowed = !strictScreenMode || (screens?.status === "fulfilled");
    if (strictScreenMode && !screenAllowed) setScreenCapability("denied");
    if (full.status !== "fulfilled" || !liveVideo || !screenAllowed || !document.fullscreenElement) {
      stream?.getTracks().forEach((track) => track.stop());
      if (ownsFullscreenRef.current && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
      ownsFullscreenRef.current = false;
      const cause = !liveVideo ? "Camera permission was denied, or no active video track was found." :
        full.status !== "fulfilled" || !document.fullscreenElement ? "Full-screen permission was denied or full-screen mode could not be maintained." :
        "Screen permission was denied or unavailable. This is a technical limitation, not evidence of misconduct.";
      setNotice(cause);
      setStatus("blocked");
      return;
    }
    mediaRef.current = stream!;
    screensRef.current = screens?.status === "fulfilled" ? screens.value as ScreenDetailsLike : null;
    lastSentRef.current.clear();
    sentWithinMinuteRef.current = [];
    setStatus("ready");
    onReady?.();
  }, [rulesAccepted, strictScreenMode, onReady]);

  useEffect(() => {
    if (status !== "ready" || !attemptId || !mediaRef.current) return;
    const stream = mediaRef.current;
    const details = screensRef.current;
    observingRef.current = true;
    let active = true;
    const send = (eventType: IntegrityEventType) => {
      if (!observingRef.current) return;
      const now = Date.now();
      if (now - (lastSentRef.current.get(eventType) ?? -Infinity) < 5_000) return;
      const times = sentWithinMinuteRef.current.filter((time) => now - time < 60_000);
      if (times.length >= 15) { sentWithinMinuteRef.current = times; return; }
      lastSentRef.current.set(eventType, now);
      sentWithinMinuteRef.current = [...times, now];
      void fetch(`/api/attempts/${encodeURIComponent(attemptId)}/events`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", cache: "no-store",
        body: JSON.stringify({ eventType, occurredAt: new Date(now).toISOString() }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Event endpoint unavailable (${response.status})`);
        const json: unknown = await response.json();
        if (active && typeof json === "object" && json && "eventCount" in json &&
            typeof json.eventCount === "number") setEventCount(json.eventCount);
      }).catch(() => {
        if (active) setNotice("An integrity signal could not be saved. Please notify your assessor if the problem continues.");
      });
    };
    const detach = attachIntegrityObservers({
      document, window, stream, screenDetails: details,
      onEvent: send,
      onCameraEnded: () => setNotice("The camera stream stopped. This is a technical interruption and may require private review."),
    });
    return () => { observingRef.current = false; active = false; detach(); };
  }, [attemptId, status]);

  return { videoRef, status, notice, screenCapability, eventCount, rulesAccepted,
    setRulesAccepted, startPreflight, stop };
}
