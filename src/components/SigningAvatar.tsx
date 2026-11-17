"use client";

import React from "react";
import type { FslSign } from "@/data/fslSigns";
import type { Language } from "@/lib/i18n";

interface SigningAvatarProps {
  sign: FslSign;
  lang: Language;
}

export default function SigningAvatar({ sign, lang }: SigningAvatarProps) {
  const { profile, slug, is_dynamic, shortLabel } = sign;

  const isCShape = slug === "alphabet-c";
  const isOShape = slug === "alphabet-o" || slug === "number-0";
  const isXShape = slug === "alphabet-x";
  const pinch = Boolean(profile.pinchThumbIndex);
  const spreadAngle = profile.spreadIndexMiddle ? 9 : 0;

  const handRotation =
    profile.orientation === "side"
      ? -70
      : profile.orientation === "down"
        ? 172
        : 0;

  const renderFinger = (
    x: number,
    fullLen: number,
    state: "extended" | "curled" | "any",
    tilt = 0,
    hooked = false
  ) => {
    const ext = state === "extended";
    const len = hooked ? fullLen * 0.6 : ext ? fullLen : 16;
    const yTop = 128 - len;
    return (
      <g transform={`rotate(${tilt} ${x} 128)`}>
        <rect
          x={x - 5}
          y={yTop}
          width={10}
          height={len + 4}
          rx={5}
          fill={ext || hooked ? "#f6c39b" : "#dfb08b"}
          stroke="#9a6443"
          strokeWidth={1.6}
        />
        {hooked && (
          <path
            d={`M ${x - 2} ${yTop + 4} Q ${x + 8} ${yTop - 3} ${x + 6} ${yTop + 10}`}
            fill="none"
            stroke="#9a6443"
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
      </g>
    );
  };

  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-end overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-900 via-violet-900 to-slate-950 shadow-inner">
      {/* Studio subtle glow */}
      <div className="pointer-events-none absolute top-6 h-48 w-48 rounded-full bg-violet-500/25 blur-3xl" />

      {/* Top pills */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-indigo-100 backdrop-blur-md">
          {lang === "en" ? "FSL Studio Guide" : "Gabay sa FSL Studio"}
        </span>
      </div>
      <div className="absolute top-3 right-3 rounded-full bg-indigo-500 px-3.5 py-1 text-xs font-bold text-white shadow">
        {shortLabel}
      </div>

      {/* Stylized 2.5D Signing Character */}
      <svg
        viewBox="0 0 320 220"
        className="h-full w-full max-w-[360px]"
        aria-label={`Animated guide for ${sign.title_en}`}
      >
        <defs>
          <linearGradient id="shirtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8caa6" />
            <stop offset="100%" stopColor="#e5a97c" />
          </linearGradient>
        </defs>

        {/* Shoulders & Torso */}
        <path
          d="M 64 220 C 66 168, 96 150, 160 150 C 224 150, 254 168, 256 220 Z"
          fill="url(#shirtGrad)"
        />
        {/* Neck */}
        <rect x="145" y="128" width="30" height="28" rx="10" fill="#e5a97c" />

        {/* Head */}
        <ellipse cx="160" cy="88" rx="34" ry="40" fill="url(#skinGrad)" />
        {/* Hair */}
        <path
          d="M 126 84 C 124 48, 196 48, 194 84 C 190 66, 174 58, 160 60 C 144 58, 130 68, 126 84 Z"
          fill="#1e1b4b"
        />
        {/* Friendly Eyes & Smile */}
        <circle cx="147" cy="88" r="3.2" fill="#1e293b" />
        <circle cx="173" cy="88" r="3.2" fill="#1e293b" />
        <path
          d="M 151 104 Q 160 111 169 104"
          fill="none"
          stroke="#9a5b3c"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Resting Left Arm */}
        <path
          d="M 88 182 Q 74 202 88 220"
          fill="none"
          stroke="#2563eb"
          strokeWidth="26"
          strokeLinecap="round"
        />

        {/* Raised Signing Right Arm (viewer's right) */}
        <path
          d="M 236 184 Q 252 162 240 134"
          fill="none"
          stroke="#2563eb"
          strokeWidth="22"
          strokeLinecap="round"
        />

        {/* Signing Hand (highlighted in front of studio chest/shoulder) */}
        <g
          transform={`translate(115, 0) ${is_dynamic ? "" : ""}`}
          className={is_dynamic ? "animate-[pulse_1.6s_ease-in-out_infinite]" : ""}
        >
          <g transform={`rotate(${handRotation} 125 130)`}>
            {isCShape || isOShape ? (
              <g>
                <path
                  d={
                    isOShape
                      ? "M 110 144 C 96 128, 100 96, 125 94 C 150 96, 152 128, 138 144 Z"
                      : "M 138 98 C 110 92, 100 120, 114 144 L 132 144 C 122 126, 124 110, 140 110"
                  }
                  fill="#f6c39b"
                  stroke="#9a6443"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
                {isOShape && (
                  <circle
                    cx={125}
                    cy={118}
                    r={11}
                    fill="#312e81"
                    stroke="#fbbf24"
                    strokeWidth={2}
                  />
                )}
              </g>
            ) : (
              <g>
                {renderFinger(108, 36, profile.index, -spreadAngle, isXShape)}
                {renderFinger(120, 41, profile.middle, spreadAngle)}
                {renderFinger(132, 37, profile.ring, spreadAngle * 0.5)}
                {renderFinger(144, 30, profile.pinky, spreadAngle * 0.8)}

                {/* Palm */}
                <rect
                  x={101}
                  y={124}
                  width={49}
                  height={32}
                  rx={12}
                  fill="#f6c39b"
                  stroke="#9a6443"
                  strokeWidth={2}
                />

                {/* Thumb */}
                {profile.thumb === "extended" ? (
                  <rect
                    x={84}
                    y={122}
                    width={22}
                    height={10}
                    rx={5}
                    transform="rotate(-24 102 132)"
                    fill="#f6c39b"
                    stroke="#9a6443"
                    strokeWidth={1.8}
                  />
                ) : (
                  <rect
                    x={104}
                    y={131}
                    width={24}
                    height={9}
                    rx={4.5}
                    fill={pinch ? "#fbbf24" : "#dfb08b"}
                    stroke="#9a6443"
                    strokeWidth={1.6}
                  />
                )}

                {pinch && (
                  <circle
                    cx={110}
                    cy={120}
                    r={7}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    strokeDasharray="3 2"
                  />
                )}
              </g>
            )}
          </g>

          {/* Motion arrows for dynamic signs */}
          {is_dynamic && (
            <g>
              <path
                d="M 158 96 Q 178 112 162 136"
                fill="none"
                stroke="#fbbf24"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="4 3"
              />
              <polygon points="159,138 168,136 162,129" fill="#fbbf24" />
            </g>
          )}
        </g>
      </svg>

      {/* Frosted-Glass Bottom Caption (like signs-ai.com!) */}
      <div className="absolute right-3 bottom-3 left-3 rounded-xl border border-white/15 bg-slate-950/65 px-3.5 py-2 text-center text-xs text-slate-100 backdrop-blur-md">
        <span className="font-semibold text-amber-300">
          {lang === "en" ? sign.title_en : sign.title_fil}:
        </span>{" "}
        {lang === "en" ? sign.hint_en : sign.hint_fil}
      </div>
    </div>
  );
}