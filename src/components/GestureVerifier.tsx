"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { Camera, CameraOff, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { FslSign } from "@/data/fslSigns";
import { translations, type Language } from "@/lib/i18n";
import { analyzeGesture, computeMotionAmount } from "@/lib/gestureAnalyzer";
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
}

export default function GestureVerifier({
  sign,
  lang,
  sessionId,
  isAlreadyVerified,
  onVerified,
}: GestureVerifierProps) {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const prevLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const motionWindowRef = useRef<number[]>([]);
  const streakRef = useRef<number>(0);
  const lastLoggedAtRef = useRef<number>(0);
  const signStartTimeRef = useRef<number>(0);
  const verifiedCurrentSignRef = useRef<boolean>(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [holdPercent, setHoldPercent] = useState(0);
  const [feedback, setFeedback] = useState<string>(t.noHandDetected);
  const [justVerified, setJustVerified] = useState(false);

  // Reset per-sign counters whenever the user picks a different sign
  useEffect(() => {
    streakRef.current = 0;
    motionWindowRef.current = [];
    verifiedCurrentSignRef.current = false;
    signStartTimeRef.current = Date.now();
    setHoldPercent(0);
    setConfidence(0);
    setJustVerified(false);
    setFeedback(cameraOn ? t.noHandDetected : t.cameraReady);
  }, [sign.slug, cameraOn, t.noHandDetected, t.cameraReady]);

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
    setCameraOn(false);
    setHoldPercent(0);
    setConfidence(0);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      landmarkerRef.current?.close();
    };
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
      response_ms: signStartTimeRef.current > 0 ? now - signStartTimeRef.current : 0,
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
    // Mirror horizontally to match mirrored webcam preview
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

      setCameraOn(true);
      setLoadingModel(false);

      let lastVideoTime = -1;
      const REQUIRED_STREAK = 12;

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
            const lm = result.landmarks[0];
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
            prevLandmarksRef.current = null;
            streakRef.current = 0;
            setHoldPercent(0);
            setConfidence(0);
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
          <Sparkles className="h-5 w-5 text-blue-700" />
          <h3 className="text-lg font-semibold text-slate-900">
            {t.cameraPanelTitle}
          </h3>
        </div>

        {!cameraOn ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={loadingModel}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-60"
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

      {/* Camera Viewport */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950">
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

        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300">
            <Camera className="mb-3 h-10 w-10 text-slate-400" />
            <p className="max-w-xs text-sm">
              {loadingModel ? t.loadingModel : t.cameraReady}
            </p>
          </div>
        )}

        {(justVerified || isAlreadyVerified) && (
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

      {/* Confidence & Hold Progress */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
            <span>{t.confidenceLabel}</span>
            <span>{confidence}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-150"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
            <span>{t.holdProgress}</span>
            <span>{holdPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-150"
              style={{ width: `${holdPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Real-time Corrective Feedback Banner */}
      <div
        className={`mt-3 rounded-xl border p-3.5 text-sm font-medium ${
          justVerified
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-blue-100 bg-blue-50 text-blue-900"
        }`}
      >
        {justVerified ? `${t.verifiedTitle} — ${t.verifiedSub}` : feedback}
      </div>
    </div>
  );
}