"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, RefreshCw, Send } from "lucide-react";
import { translations, type Language } from "@/lib/i18n";
import { supabase, type EvaluationFeedbackInsert } from "@/lib/supabase";

interface EvaluationFormProps {
  lang: Language;
}

interface AccuracyStats {
  total: number;
  matched: number;
  matchRate: number;
  avgConfidence: number;
}

export default function EvaluationForm({ lang }: EvaluationFormProps) {
  const t = translations[lang].evaluation;

  const [stats, setStats] = useState<AccuracyStats>({
    total: 0,
    matched: 0,
    matchRate: 0,
    avgConfidence: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  const [group, setGroup] =
    useState<EvaluationFeedbackInsert["respondent_group"]>("hearing_learner");
  const [functionality, setFunctionality] = useState(5);
  const [reliability, setReliability] = useState(5);
  const [usability, setUsability] = useState(5);
  const [videoClarity, setVideoClarity] = useState(5);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const loadStats = useCallback(async () => {
    if (!supabase) return;
    setLoadingStats(true);
    const { data, error } = await supabase
      .from("practice_attempts")
      .select("matched, confidence")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!error && data) {
      const total = data.length;
      const matched = data.filter((row) => row.matched).length;
      const avgConf =
        total > 0
          ? data.reduce((acc, row) => acc + Number(row.confidence || 0), 0) / total
          : 0;
      setStats({
        total,
        matched,
        matchRate: total > 0 ? Math.round((matched / total) * 100) : 0,
        avgConfidence: Math.round(avgConf * 100),
      });
    }
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setStatus("error");
      return;
    }
    setSubmitting(true);
    setStatus("idle");

    const { error } = await supabase.from("evaluation_feedback").insert({
      respondent_group: group,
      functionality_rating: functionality,
      reliability_rating: reliability,
      usability_rating: usability,
      video_clarity_rating: videoClarity,
      comments: comments.trim() || undefined,
      language_used: lang,
    });

    setSubmitting(false);
    if (error) {
      console.error(error);
      setStatus("error");
    } else {
      setStatus("success");
      setComments("");
    }
  };

  const renderRatingRow = (
    label: string,
    value: number,
    onChange: (val: number) => void
  ) => (
    <div className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:flex-row sm:items-center">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${
              value === num
                ? "bg-blue-700 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>
      </div>

      {/* Live Accuracy Stats Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-700" />
            <h3 className="text-lg font-semibold text-slate-900">
              {t.statsTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={loadStats}
            disabled={loadingStats}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingStats ? "animate-spin" : ""}`}
            />
            {t.refreshStats}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">{t.totalAttempts}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs font-medium text-emerald-700">
              {t.verifiedMatches}
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">
              {stats.matched}
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-700">{t.matchRate}</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">
              {stats.matchRate}%
            </p>
          </div>
          <div className="rounded-xl bg-indigo-50 p-4">
            <p className="text-xs font-medium text-indigo-700">
              {t.avgConfidence}
            </p>
            <p className="mt-1 text-2xl font-bold text-indigo-900">
              {stats.avgConfidence}%
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Survey Card */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-slate-900">{t.formTitle}</h3>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            {t.groupLabel}
          </label>
          <select
            value={group}
            onChange={(e) =>
              setGroup(
                e.target.value as EvaluationFeedbackInsert["respondent_group"]
              )
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            <option value="deaf">{t.groups.deaf}</option>
            <option value="hard_of_hearing">{t.groups.hard_of_hearing}</option>
            <option value="hearing_learner">{t.groups.hearing_learner}</option>
            <option value="fsl_educator">{t.groups.fsl_educator}</option>
          </select>
        </div>

        <div className="space-y-2.5">
          {renderRatingRow(t.functionality, functionality, setFunctionality)}
          {renderRatingRow(t.reliability, reliability, setReliability)}
          {renderRatingRow(t.usability, usability, setUsability)}
          {renderRatingRow(t.videoClarity, videoClarity, setVideoClarity)}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            {t.commentsLabel}
          </label>
          <textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={t.commentsPlaceholder}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>

        {status === "success" && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {t.submitSuccess}
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            {t.submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {submitting ? t.submitting : t.submitBtn}
        </button>
      </form>
    </section>
  );
}