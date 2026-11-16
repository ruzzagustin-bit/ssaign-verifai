"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Hand,
  Info,
  Languages,
  Video,
} from "lucide-react";
import {
  STARTER_FSL_SIGNS,
  type FslSign,
  type SignCategory,
} from "@/data/fslSigns";
import { translations, type Language } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import GestureVerifier from "@/components/GestureVerifier";
import EvaluationForm from "@/components/EvaluationForm";
import HandDiagram from "@/components/HandDiagram";

export default function HomePage() {
  const [lang, setLang] = useState<Language>("en");
  const [activeTab, setActiveTab] = useState<"learn" | "evaluate">("learn");
  const [category, setCategory] = useState<SignCategory>("alphabet");
  const [signs, setSigns] = useState<FslSign[]>(STARTER_FSL_SIGNS);
  const [selectedSlug, setSelectedSlug] = useState<string>("alphabet-a");
  const [verifiedSlugs, setVerifiedSlugs] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string>("guest-session");

  const t = translations[lang];

  useEffect(() => {
    const existing = window.localStorage.getItem("ssaign_session_id");
    if (existing) {
      setSessionId(existing);
    } else {
      const created = crypto.randomUUID();
      window.localStorage.setItem("ssaign_session_id", created);
      setSessionId(created);
    }

    const savedVerified = window.localStorage.getItem("ssaign_verified_slugs");
    if (savedVerified) {
      try {
        setVerifiedSlugs(JSON.parse(savedVerified));
      } catch {
        // ignore invalid storage
      }
    }

    const syncRemoteVideos = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from("signs")
        .select("slug, video_url")
        .not("video_url", "is", null);

      if (data && data.length > 0) {
        const urlMap = new Map(data.map((r) => [r.slug, r.video_url as string]));
        setSigns((prev) =>
          prev.map((s) => ({
            ...s,
            video_url: urlMap.get(s.slug) ?? s.video_url ?? null,
          }))
        );
      }
    };

    void syncRemoteVideos();
  }, []);

  const categorySigns = useMemo(
    () => signs.filter((s) => s.category === category),
    [signs, category]
  );

  const selectedSign = useMemo(
    () =>
      categorySigns.find((s) => s.slug === selectedSlug) ?? categorySigns[0],
    [categorySigns, selectedSlug]
  );

  const masteryPct = Math.round((verifiedSlugs.length / signs.length) * 100);

  const handleCategoryChange = (nextCategory: SignCategory) => {
    setCategory(nextCategory);
    const firstInCat = signs.find((s) => s.category === nextCategory);
    if (firstInCat) setSelectedSlug(firstInCat.slug);
  };

  const handleVerified = (slug: string) => {
    setVerifiedSlugs((prev) => {
      if (prev.includes(slug)) return prev;
      const next = [...prev, slug];
      window.localStorage.setItem("ssaign_verified_slugs", JSON.stringify(next));
      return next;
    });
  };

  const handleNextSign = () => {
    const idx = categorySigns.findIndex((s) => s.slug === selectedSign.slug);
    if (idx >= 0 && idx < categorySigns.length - 1) {
      setSelectedSlug(categorySigns[idx + 1].slug);
    } else if (categorySigns.length > 0) {
      setSelectedSlug(categorySigns[0].slug);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white shadow-sm">
              <Hand className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                SSAign-VerifAI
              </h1>
              <p className="text-xs text-slate-500">{t.brandSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("learn")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                activeTab === "learn"
                  ? "bg-blue-800 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              {t.navLearn}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("evaluate")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                activeTab === "evaluate"
                  ? "bg-blue-800 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <ClipboardCheck className="h-4 w-4" />
              {t.navEvaluate}
            </button>

            <button
              type="button"
              onClick={() => setLang((prev) => (prev === "en" ? "fil" : "en"))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              title="Switch English / Filipino"
            >
              <Languages className="h-4 w-4 text-blue-700" />
              {lang === "en" ? "EN → FIL" : "FIL → EN"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === "evaluate" ? (
          <EvaluationForm lang={lang} />
        ) : (
          <div className="space-y-6">
            {/* Hero Banner */}
            <section className="rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-6 text-white shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="max-w-2xl">
                  <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-blue-100">
                    {t.heroBadge}
                  </span>
                  <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                    {t.heroTitle}
                  </h2>
                  <p className="mt-1.5 text-sm text-blue-100">{t.heroDesc}</p>
                </div>

                <div className="min-w-[200px] shrink-0 rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-xs font-medium text-blue-100">
                    <span className="inline-flex items-center gap-1">
                      <Award className="h-4 w-4 text-amber-300" />
                      {t.verifiedCountLabel}
                    </span>
                    <span>{masteryPct}%</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold">
                    {verifiedSlugs.length}{" "}
                    <span className="text-sm font-normal text-blue-200">
                      / {signs.length}
                    </span>
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                      style={{ width: `${masteryPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Category Tabs + Sign Selector */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(["alphabet", "numbers", "greetings"] as SignCategory[]).map(
                    (cat) => {
                      const catList = signs.filter((s) => s.category === cat);
                      const catDone = catList.filter((s) =>
                        verifiedSlugs.includes(s.slug)
                      ).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleCategoryChange(cat)}
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            category === cat
                              ? "bg-blue-700 text-white shadow-sm"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <span>{t.categories[cat]}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              category === cat
                                ? "bg-white/20 text-white"
                                : "bg-white text-slate-600"
                            }`}
                          >
                            {catDone}/{catList.length}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
                <p className="text-xs font-medium text-slate-500">
                  {t.selectSign}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {categorySigns.map((sign) => {
                  const isSelected = sign.slug === selectedSign.slug;
                  const isDone = verifiedSlugs.includes(sign.slug);
                  return (
                    <button
                      key={sign.slug}
                      type="button"
                      onClick={() => setSelectedSlug(sign.slug)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                        isSelected
                          ? "border-blue-700 bg-blue-50 text-blue-800 ring-2 ring-blue-200"
                          : isDone
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{sign.shortLabel}</span>
                      {isDone && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Split-Screen Practice Area */}
            <section className="grid gap-6 lg:grid-cols-2">
              {/* Left: Instructional Reference Video or Visual Hand Guide */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-blue-700" />
                    <h3 className="text-lg font-semibold text-slate-900">
                      {t.referencePanelTitle}
                    </h3>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      selectedSign.is_dynamic
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {selectedSign.is_dynamic ? t.dynamicBadge : t.staticBadge}
                  </span>
                </div>

                {selectedSign.video_url ? (
                  <video
                    key={selectedSign.video_url}
                    src={selectedSign.video_url}
                    controls
                    loop
                    playsInline
                    className="aspect-video w-full rounded-xl bg-slate-950 object-contain"
                  />
                ) : (
                  <HandDiagram sign={selectedSign} lang={lang} />
                )}

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xl font-bold text-slate-900">
                      {lang === "en"
                        ? selectedSign.title_en
                        : selectedSign.title_fil}
                    </h4>
                    <button
                      type="button"
                      onClick={handleNextSign}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t.nextSign}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t.howToSign}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">
                      {lang === "en"
                        ? selectedSign.description_en
                        : selectedSign.description_fil}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                      {t.tipLabel}
                    </p>
                    <p className="mt-1 text-sm text-amber-900">
                      {lang === "en"
                        ? selectedSign.hint_en
                        : selectedSign.hint_fil}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Live Camera Hand Gesture Verifier */}
              <GestureVerifier
                sign={selectedSign}
                lang={lang}
                sessionId={sessionId}
                isAlreadyVerified={verifiedSlugs.includes(selectedSign.slug)}
                onVerified={handleVerified}
                onNextSign={handleNextSign}
              />
            </section>

            {/* Scope & Delimitation Footer Notice */}
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <p>{t.scopeNotice}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}