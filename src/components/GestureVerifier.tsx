"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  ArrowRight,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { FslSign } from "@/data/fslSigns";
import { translations, type Language } from "@/lib/i18n";
import {
  analyzeGesture,
  computeMotionAmount,
  smoothLandmarks,
  type FingerMatchStatus,
} from "@/lib/gestureAnalyzer";
import { supabase } from "@/lib/supabase";

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

interface GestureVerifierProps {
  sign: FslSign;
  lang: Language;
  sessionId: string;
  isAlreadyVerified: boolean;
  onVerified: (slug: string) => void;
  onNextSign?: () => void;
  challengeMode?: boolean;
}

const DEFAULT_FINGERS: Record<Language, FingerMatchStatus[]> = {
  en: [
    { key: "thumb", label: "Thumb", ok: false },
    { key: "index", label: "Index", ok: false },
    { key: "middle", label: "Middle", ok: false },
    { key: "ring", label: "Ring", ok: false },
    { key: "pinky", label: "Pinky", ok: false },
  ],
  fil: [
    { key: "thumb", label: "Hinlalaki", ok: false },
    { key: "index", label: "Hintuturo", ok: false },
    { key: "middle", label: "Hinlalato", ok: false },
    { key: "ring", label: "Palasingsingan", ok: false },
    { key: "pinky", label: "Hinliliit", ok: false },
  ],
};

export default function GestureVerifier({
  sign,
  lang,
  sessionId,
  isAlreadyVerified,
  onVerified,
  onNextSign,
  challengeMode = false,
}: GestureVerifierProps) {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const smoothedLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const prevLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const motionWindowRef = useRef<number[]>([]);
  const streakRef = useRef<number>(0);
  const lastLoggedAtRef = useRef<number>(0);
  const signStartTimeRef = useRef<number>(0);
  const verifiedCurrentSignRef = useRef<boolean>(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [handInFrame, setHandInFrame] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [holdPercent, setHoldPercent] = useState(0);
  const [feedback, setFeedback] = useState<string>(t.noHandDetected);
  const [fingerStatuses, setFingerStatuses] = useState<FingerMatchStatus[]>(
    DEFAULT_FINGERS[lang]
  );
  const [justVerified, setJustVerified] = useState(false);

  const resetSignPractice = () => {
    streakRef.current = 0;
    motionWindowRef.current = [];
    verifiedCurrentSignRef.current = false;
    signStartTimeRef.current = Date.now();
    setHoldPercent(0);
    setConfidence(0);
    setJustVerified(false);
    setFingerStatuses(DEFAULT_FINGERS[lang]);
    setFeedback(cameraOn ? t.noHandDetected : t.cameraReady);
  };

  useEffect(() => {
    resetSignPractice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign.slug, cameraOn, lang]);

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    smoothedLandmarksRef.current = null;
    prevLandmarksRef.current = null;
    setCameraOn(false);
    setHandInFrame(false);
    setHoldPercent(0);
    setConfidence(0);
    setFingerStatuses(DEFAULT_FINGERS[lang]);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      landmarkerRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logAttempt = async (
    matched: boolean,
    conf: number,
    feedbackCode: string
  ) => {
    if (!supabase) return;
    const now = Date.now();
    if (!matched && now - lastLoggedAtRef.current < 4500) return;
    lastLoggedAtRef.current = now;

    await supabase.from("practice_attempts").insert({
      session_id: sessionId,
      sign_slug: sign.slug,
      category: sign.category,
      matched,
      confidence: Number(conf.toFixed(4)),
      feedback_code: feedbackCode,
      response_ms:
        signStartTimeRef.current > 0 ? now - signStartTimeRef.current : 0,
    });
  };

  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: NormalizedLandmark[],
    width: number,
    height: number,
    isMatch: boolean
  ) => {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);

    ctx.lineWidth = 3;
    ctx.strokeStyle = isMatch ? "#10b981" : "#38bdf8";

    for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
      const a = landmarks[startIdx];
      const b = landmarks[endIdx];
      ctx.beginPath();
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
      ctx.stroke();
    }

    for (let i = 0; i < landmarks.length; i++) {
      const pt = landmarks[i];
      ctx.beginPath();
      ctx.arc(pt.x * width, pt.y * height, i === 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isMatch ? "#34d399" : "#ffffff";
      ctx.fill();
    }
    ctx.restore();
  };

  const startCamera = async () => {
    setErrorMsg(null);
    setLoadingModel(true);

    try {
      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        try {
          landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
          });
        } catch {
          landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
          });
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      signStartTimeRef.current = Date.now();
      setCameraOn(true);
      setLoadingModel(false);

      let lastVideoTime = -1;
      const REQUIRED_STREAK = challengeMode ? 8 : 12;

      const detectFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const landmarker = landmarkerRef.current;

        if (!video || !canvas || !landmarker || !streamRef.current) return;

        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          if (
            canvas.width !== video.videoWidth ||
            canvas.height !== video.videoHeight
          ) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
          }

          const ctx = canvas.getContext("2d");
          const result = landmarker.detectForVideo(video, performance.now());

          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }

          if (result.landmarks && result.landmarks.length > 0) {
            setHandInFrame(true);
            const rawLm = result.landmarks[0];
            const lm = smoothLandmarks(smoothedLandmarksRef.current, rawLm, 0.55);
            smoothedLandmarksRef.current = lm;

            const instantMotion = computeMotionAmount(prevLandmarksRef.current, lm);
            prevLandmarksRef.current = lm;

            motionWindowRef.current.push(instantMotion);
            if (motionWindowRef.current.length > 15) {
              motionWindowRef.current.shift();
            }
            const peakMotion = Math.max(...motionWindowRef.current, 0);

            const analysis = analyzeGesture(lm, sign, peakMotion, lang);
            setConfidence(Math.round(analysis.confidence * 100));
            setFeedback(analysis.feedbackMessage);
            setFingerStatuses(analysis.fingerStatuses);

            if (ctx) {
              drawLandmarks(ctx, lm, canvas.width, canvas.height, analysis.matched);
            }

            if (analysis.matched) {
              streakRef.current = Math.min(streakRef.current + 1, REQUIRED_STREAK);
              const pct = Math.round((streakRef.current / REQUIRED_STREAK) * 100);
              setHoldPercent(pct);

              if (
                streakRef.current >= REQUIRED_STREAK &&
                !verifiedCurrentSignRef.current
              ) {
                verifiedCurrentSignRef.current = true;
                setJustVerified(true);
                onVerified(sign.slug);
                void logAttempt(true, analysis.confidence, "ok");
              }
            } else {
              streakRef.current = Math.max(streakRef.current - 2, 0);
              setHoldPercent(Math.round((streakRef.current / REQUIRED_STREAK) * 100));
              if (!verifiedCurrentSignRef.current) {
                void logAttempt(false, analysis.confidence, analysis.feedbackCode);
              }
            }
          } else {
            setHandInFrame(false);
            smoothedLandmarksRef.current = null;
            prevLandmarksRef.current = null;
            streakRef.current = 0;
            setHoldPercent(0);
            setConfidence(0);
            setFingerStatuses(DEFAULT_FINGERS[lang]);
            setFeedback(t.noHandDetected);
          }
        }

        rafRef.current = requestAnimationFrame(detectFrame);
      };

      rafRef.current = requestAnimationFrame(detectFrame);
    } catch (err) {
      console.error(err);
      setLoadingModel(false);
      setErrorMsg(t.cameraError);
      stopCamera();
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-700" />
          <h3 className="text-lg font-semibold text-slate-900">
            {t.cameraPanelTitle}
          </h3>
        </div>

        {!cameraOn ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={loadingModel}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-60"
          >
            {loadingModel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {loadingModel ? t.loadingModel : t.startCamera}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
          >
            <CameraOff className="h-4 w-4" />
            {t.stopCamera}
          </button>
        )}
      </div>

      {/* Studio Camera Viewport with Framing Box & Frosted Captions */}
      <div
        className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 transition-all ${
          justVerified ? "ring-4 ring-emerald-400" : ""
        }`}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full -scale-x-100 object-cover"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        {/* Signs-AI style Corner Framing Box */}
        {cameraOn && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
            <div
              className={`h-full w-3/5 max-w-[260px] rounded-3xl border-2 border-dashed transition-colors duration-300 ${
                justVerified
                  ? "border-emerald-400 bg-emerald-500/10"
                  : handInFrame
                    ? "border-sky-400/80"
                    : "border-white/40"
              }`}
            />
          </div>
        )}

        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-indigo-950 p-6 text-center text-slate-200">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur">
              <Camera className="h-7 w-7 text-violet-300" />
            </div>
            <p className="max-w-xs text-sm">
              {loadingModel ? t.loadingModel : t.cameraReady}
            </p>
          </div>
        )}

        {/* Frosted-Glass Live Feedback Caption (like signs-ai.com!) */}
        {cameraOn && !justVerified && (
          <div className="pointer-events-none absolute right-3 bottom-3 left-3 rounded-xl border border-white/15 bg-slate-950/65 px-3.5 py-2 text-center text-xs font-medium text-white backdrop-blur-md">
            {feedback}
          </div>
        )}

        {/* Deaf-accessible Visual Celebration Overlay */}
        {justVerified && (
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-600/95 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 shrink-0 animate-bounce" />
              <div>
                <p className="text-sm font-bold">{t.verifiedTitle}</p>
                <p className="text-xs text-emerald-100">{t.verifiedSub}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!challengeMode && (
                <button
                  type="button"
                  onClick={resetSignPractice}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/30"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {lang === "en" ? "Retry" : "Ulitin"}
                </button>
              )}
              {onNextSign && (
                <button
                  type="button"
                  onClick={onNextSign}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                >
                  {t.nextSign}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {!justVerified && isAlreadyVerified && !challengeMode && (
          <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow">
            <CheckCircle2 className="h-4 w-4" />
            {t.verifiedTitle}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Live 5-Finger Status Pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {fingerStatuses.map((f) => (
          <span
            key={f.key}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              cameraOn && f.ok
                ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                cameraOn && f.ok ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            {f.label}
          </span>
        ))}
      </div>

      {/* Confidence & Hold Progress */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
            <span>{t.confidenceLabel}</span>
            <span>{confidence}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-violet-600 transition-all duration-150"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
            <span>{t.holdProgress}</span>
            <span>{holdPercent}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-150"
              style={{ width: `${holdPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}