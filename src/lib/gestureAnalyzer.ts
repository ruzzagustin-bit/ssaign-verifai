import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { FingerState, FslSign } from "@/data/fslSigns";
import type { Language } from "@/lib/i18n";

export type FingerKey = "thumb" | "index" | "middle" | "ring" | "pinky";

export interface FingerMatchStatus {
  key: FingerKey;
  label: string;
  ok: boolean;
}

export interface AnalysisResult {
  matched: boolean;
  confidence: number;
  feedbackCode: string;
  feedbackMessage: string;
  fingerStatuses: FingerMatchStatus[];
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isFingerExtended(
  lm: NormalizedLandmark[],
  mcpIdx: number,
  pipIdx: number,
  tipIdx: number
): boolean {
  const wrist = lm[0];
  const tipToWrist = dist(lm[tipIdx], wrist);
  const pipToWrist = dist(lm[pipIdx], wrist);
  const tipToMcp = dist(lm[tipIdx], lm[mcpIdx]);
  const pipToMcp = dist(lm[pipIdx], lm[mcpIdx]);
  return tipToWrist > pipToWrist * 1.08 && tipToMcp > pipToMcp * 1.04;
}

function isThumbExtended(lm: NormalizedLandmark[], palmSize: number): boolean {
  const thumbTip = lm[4];
  const pinkyMcp = lm[17];
  const middleMcp = lm[9];
  const indexMcp = lm[5];

  const farFromPinky = dist(thumbTip, pinkyMcp) > palmSize * 1.02;
  const awayFromCenter = dist(thumbTip, middleMcp) > palmSize * 0.66;
  const awayFromIndex = dist(thumbTip, indexMcp) > palmSize * 0.44;
  return farFromPinky && (awayFromCenter || awayFromIndex);
}

function getOrientation(
  lm: NormalizedLandmark[],
  palmSize: number
): "up" | "down" | "side" {
  const wrist = lm[0];
  const refX = (lm[9].x + lm[8].x) / 2;
  const refY = (lm[9].y + lm[8].y) / 2;
  const dx = refX - wrist.x;
  const dy = refY - wrist.y;

  if (Math.abs(dx) > Math.abs(dy) * 1.15 && Math.abs(dx) > palmSize * 0.35) {
    return "side";
  }
  return dy > palmSize * 0.2 ? "down" : "up";
}

export function smoothLandmarks(
  prev: NormalizedLandmark[] | null,
  curr: NormalizedLandmark[],
  alpha = 0.55
): NormalizedLandmark[] {
  if (!prev || prev.length !== curr.length) return curr;
  return curr.map((pt, idx) => ({
    x: prev[idx].x * (1 - alpha) + pt.x * alpha,
    y: prev[idx].y * (1 - alpha) + pt.y * alpha,
    z: (prev[idx].z ?? 0) * (1 - alpha) + (pt.z ?? 0) * alpha,
    visibility: pt.visibility,
  }));
}

export function computeMotionAmount(
  prev: NormalizedLandmark[] | null,
  curr: NormalizedLandmark[]
): number {
  if (!prev || prev.length < 21 || curr.length < 21) return 0;
  const palmSize = Math.max(dist(curr[0], curr[9]), 0.05);
  const movement =
    (dist(prev[0], curr[0]) +
      dist(prev[8], curr[8]) +
      dist(prev[20], curr[20])) /
    3;
  return movement / palmSize;
}

const FINGER_NAMES: Record<FingerKey, { en: string; fil: string }> = {
  thumb: { en: "Thumb", fil: "Hinlalaki" },
  index: { en: "Index", fil: "Hintuturo" },
  middle: { en: "Middle", fil: "Hinlalato" },
  ring: { en: "Ring", fil: "Palasingsingan" },
  pinky: { en: "Pinky", fil: "Hinliliit" },
};

export function analyzeGesture(
  lm: NormalizedLandmark[],
  sign: FslSign,
  recentPeakMotion: number,
  lang: Language
): AnalysisResult {
  const palmSize = dist(lm[0], lm[9]);
  const fingerKeys: FingerKey[] = ["thumb", "index", "middle", "ring", "pinky"];

  if (palmSize < 0.01) {
    return {
      matched: false,
      confidence: 0,
      feedbackCode: "hand_too_small",
      feedbackMessage:
        lang === "en"
          ? "Move your hand slightly closer to the camera."
          : "Ilapit nang kaunti ang iyong kamay sa kamera.",
      fingerStatuses: fingerKeys.map((k) => ({
        key: k,
        label: FINGER_NAMES[k][lang],
        ok: false,
      })),
    };
  }

  const detected: Record<FingerKey, boolean> = {
    thumb: isThumbExtended(lm, palmSize),
    index: isFingerExtended(lm, 5, 6, 8),
    middle: isFingerExtended(lm, 9, 10, 12),
    ring: isFingerExtended(lm, 13, 14, 16),
    pinky: isFingerExtended(lm, 17, 18, 20),
  };

  const p = sign.profile;
  let totalChecks = 0;
  let passedChecks = 0;
  let firstErrorCode = "";
  let firstErrorMsg = "";

  const recordError = (code: string, enMsg: string, filMsg: string) => {
    if (!firstErrorCode) {
      firstErrorCode = code;
      firstErrorMsg = lang === "en" ? enMsg : filMsg;
    }
  };

  const fingerStatuses: FingerMatchStatus[] = fingerKeys.map((key) => {
    const expected: FingerState = p[key];
    if (expected === "any") {
      return { key, label: FINGER_NAMES[key][lang], ok: true };
    }
    totalChecks++;
    const actual = detected[key];
    const shouldBeExtended = expected === "extended";
    const ok = actual === shouldBeExtended;

    if (ok) {
      passedChecks++;
    } else {
      const fname = FINGER_NAMES[key][lang].toLowerCase();
      if (shouldBeExtended) {
        recordError(
          `extend_${key}`,
          `Extend your ${fname} finger.`,
          `Itaas o ituwid ang iyong ${fname}.`
        );
      } else {
        recordError(
          `curl_${key}`,
          `Curl or tuck your ${fname} finger.`,
          `Ibaluktot o itiklop ang iyong ${fname}.`
        );
      }
    }
    return { key, label: FINGER_NAMES[key][lang], ok };
  });

  // Extra distinction for Letter C (curved open gap between thumb & index)
  if (sign.slug === "alphabet-c") {
    totalChecks++;
    const gap = dist(lm[4], lm[8]) / palmSize;
    if (gap > 0.36 && gap < 1.35) {
      passedChecks++;
    } else {
      recordError(
        "shape_c_gap",
        "Keep a rounded C-shaped opening between your thumb and fingers.",
        "Panatilihing bukas at pakurbang hugis C ang agwat ng hinlalaki at mga daliri."
      );
    }
  }

  if (p.pinchThumbIndex) {
    totalChecks++;
    const pinchDist = dist(lm[4], lm[8]) / palmSize;
    if (pinchDist < 0.45) {
      passedChecks++;
    } else {
      recordError(
        "pinch_thumb_index",
        "Touch the tips of your thumb and index finger together.",
        "Pagdikitin ang dulo ng iyong hinlalaki at hintuturo."
      );
    }
  }

  if (typeof p.spreadIndexMiddle === "boolean") {
    totalChecks++;
    const spreadDist = dist(lm[8], lm[12]) / palmSize;
    const isSpread = spreadDist > 0.36;
    if (isSpread === p.spreadIndexMiddle) {
      passedChecks++;
    } else if (p.spreadIndexMiddle) {
      recordError(
        "spread_index_middle",
        "Spread your index and middle fingers apart into a V.",
        "Ibuka ang hintuturo at hinlalato upang makabuo ng V."
      );
    } else {
      recordError(
        "close_index_middle",
        "Press your index and middle fingers closer together.",
        "Pagdikitin ang iyong hintuturo at hinlalato."
      );
    }
  }

  if (p.orientation && p.orientation !== "any") {
    totalChecks++;
    const actualOrient = getOrientation(lm, palmSize);
    if (actualOrient === p.orientation) {
      passedChecks++;
    } else {
      const orientText = {
        up: { en: "upward", fil: "paitaas" },
        down: { en: "downward", fil: "pababa" },
        side: { en: "to the side", fil: "sa gilid" },
      }[p.orientation];
      recordError(
        `orient_${p.orientation}`,
        `Point your hand ${orientText.en}.`,
        `Ituro ang iyong kamay ${orientText.fil}.`
      );
    }
  }

  if (p.requiresMotion) {
    totalChecks++;
    if (recentPeakMotion > 0.055) {
      passedChecks++;
    } else {
      recordError(
        "need_motion",
        "Add the required hand movement shown in the guide.",
        "Idagdag ang kailangang galaw ng kamay ayon sa gabay."
      );
    }
  }

  const confidence = totalChecks > 0 ? passedChecks / totalChecks : 0;
  const matched = totalChecks > 0 && passedChecks === totalChecks;

  return {
    matched,
    confidence,
    feedbackCode: matched ? "ok" : firstErrorCode || "adjust_hand",
    feedbackMessage: matched
      ? lang === "en"
        ? "Handshape matches! Hold steady..."
        : "Tugma ang hugis ng kamay! Panatilihing pirmi..."
      : firstErrorMsg ||
        (lang === "en"
          ? "Adjust your handshape to match the reference."
          : "Isaayos ang hugis ng kamay ayon sa gabay."),
    fingerStatuses,
  };
}