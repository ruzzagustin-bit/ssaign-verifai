"use client";

import React from "react";
import type { FslSign } from "@/data/fslSigns";
import type { Language } from "@/lib/i18n";

interface HandDiagramProps {
  sign: FslSign;
  lang: Language;
}

export default function HandDiagram({ sign, lang }: HandDiagramProps) {
  const { profile, slug, is_dynamic, shortLabel } = sign;

  const isCShape = slug === "alphabet-c";
  const isOShape = slug === "alphabet-o" || slug === "number-0";
  const isXShape = slug === "alphabet-x";

  const rotation =
    profile.orientation === "side"
      ? -75
      : profile.orientation === "down"
        ? 175
        : 0;

  const fingerColor = (extended: boolean, highlightPinch = false) => {
    if (highlightPinch) return "#f59e0b"; // amber for pinch contact
    return extended ? "#1d4ed8" : "#cbd5e1"; // bold blue extended, soft slate curled
  };

  const fingerStroke = (extended: boolean, highlightPinch = false) => {
    if (highlightPinch) return "#b45309";
    return extended ? "#1e3a8a" : "#94a3b8";
  };

  const renderFinger = (
    x: number,
    fullHeight: number,
    state: "extended" | "curled" | "any",
    tiltDeg = 0,
    pinchHighlight = false,
    hooked = false
  ) => {
    const isExt = state === "extended";
    const height = hooked ? fullHeight * 0.62 : isExt ? fullHeight : 28;
    const yTop = 108 - height;
    const fill = fingerColor(isExt || hooked, pinchHighlight);
    const stroke = fingerStroke(isExt || hooked, pinchHighlight);

    return (
      <g transform={`rotate(${tiltDeg} ${x} 108)`}>
        <rect
          x={x - 9}
          y={yTop}
          width={18}
          height={height + 6}
          rx={9}
          fill={fill}
          stroke={stroke}
          strokeWidth={2.2}
        />
        {!isExt && !hooked && (
          <line
            x1={x - 5}
            y1={yTop + 12}
            x2={x + 5}
            y2={yTop + 12}
            stroke="#64748b"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}
        {hooked && (
          <path
            d={`M ${x - 4} ${yTop + 6} Q ${x + 12} ${yTop - 4} ${x + 10} ${yTop + 14}`}
            fill="none"
            stroke="#1e3a8a"
            strokeWidth={4}
            strokeLinecap="round"
          />
        )}
      </g>
    );
  };

  const spreadAngle = profile.spreadIndexMiddle ? 10 : 0;
  const thumbExtended = profile.thumb === "extended";
  const pinch = Boolean(profile.pinchThumbIndex);

  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="absolute top-2.5 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-blue-900 shadow-sm">
        {lang === "en" ? "Visual Hand Guide" : "Biswal na Gabay ng Kamay"}
      </div>

      <div className="absolute top-2.5 right-3 rounded-full bg-blue-800 px-3 py-1 text-xs font-bold text-white shadow-sm">
        {shortLabel}
      </div>

      <svg
        viewBox="0 0 240 190"
        className="h-40 w-52 drop-shadow-sm sm:h-44 sm:w-56"
        aria-label={`Hand posture diagram for ${sign.title_en}`}
      >
        <g transform={`rotate(${rotation} 120 110)`}>
          {/* Wrist */}
          <rect
            x={94}
            y={146}
            width={52}
            height={34}
            rx={10}
            fill="#e2e8f0"
            stroke="#94a3b8"
            strokeWidth={2}
          />

          {isCShape || isOShape ? (
            /* Curved C / O hand illustration */
            <g>
              <path
                d={
                  isOShape
                    ? "M 92 142 C 66 115, 72 52, 120 48 C 166 52, 170 110, 140 142 Z"
                    : "M 145 55 C 90 45, 72 95, 95 142 L 135 142 C 115 110, 120 75, 150 75"
                }
                fill={isOShape ? "#dbeafe" : "#bfdbfe"}
                stroke="#1d4ed8"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {isOShape && (
                <circle
                  cx={120}
                  cy={92}
                  r={22}
                  fill="#ffffff"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  strokeDasharray="4 3"
                />
              )}
            </g>
          ) : (
            <g>
              {/* Index, Middle, Ring, Pinky */}
              {renderFinger(88, 66, profile.index, -spreadAngle, pinch, isXShape)}
              {renderFinger(110, 74, profile.middle, spreadAngle)}
              {renderFinger(132, 68, profile.ring, spreadAngle * 0.5)}
              {renderFinger(153, 54, profile.pinky, spreadAngle * 0.8)}

              {/* Palm */}
              <rect
                x={76}
                y={102}
                width={88}
                height={52}
                rx={22}
                fill="#eff6ff"
                stroke="#1e40af"
                strokeWidth={2.4}
              />

              {/* Thumb */}
              {thumbExtended ? (
                <rect
                  x={44}
                  y={96}
                  width={38}
                  height={18}
                  rx={9}
                  transform="rotate(-24 76 114)"
                  fill="#1d4ed8"
                  stroke="#1e3a8a"
                  strokeWidth={2.2}
                />
              ) : (
                <rect
                  x={80}
                  y={114}
                  width={44}
                  height={16}
                  rx={8}
                  fill={pinch ? "#f59e0b" : "#cbd5e1"}
                  stroke={pinch ? "#b45309" : "#64748b"}
                  strokeWidth={2.2}
                />
              )}

              {/* Pinch contact ring */}
              {pinch && (
                <circle
                  cx={92}
                  cy={96}
                  r={11}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="3 2"
                />
              )}
            </g>
          )}
        </g>

        {/* Animated Motion Cue for Dynamic Signs */}
        {is_dynamic && (
          <g className="animate-pulse">
            <path
              d="M 178 46 Q 204 68 182 96"
              fill="none"
              stroke="#ea580c"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray="5 4"
            />
            <polygon points="178,99 189,97 182,88" fill="#ea580c" />
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-700" />
          {lang === "en" ? "Extended" : "Nakataas"}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300 ring-1 ring-slate-400" />
          {lang === "en" ? "Curled" : "Nakabaluktot"}
        </span>
        {pinch && (
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            {lang === "en" ? "Touch Tips" : "Pagdikitin"}
          </span>
        )}
        {is_dynamic && (
          <span className="inline-flex items-center gap-1 text-orange-700">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            {lang === "en" ? "Move Hand" : "Igalaw ang Kamay"}
          </span>
        )}
      </div>
    </div>
  );
}