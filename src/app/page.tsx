"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Gamepad2,
  Hand,
  Info,
  Languages,
  Medal,
  Play,
  Timer,
  Trophy,
  Video,
  Zap,
} from "lucide-react";
import {
  STARTER_FSL_SIGNS,
  type FslSign,
  type SignCategory,
} from "@/data/fslSigns";
import { translations, type Language } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import {
  getBadges,
  getRankInfo,
  type GamificationState,
} from "@/lib/gamification";
import GestureVerifier from "@/components/GestureVerifier";
import EvaluationForm from "@/components/EvaluationForm";
import SigningAvatar from "@/components/SigningAvatar";

const INITIAL_GAME_STATE: GamificationState = {
  xp: 0,
  combo: 0,
  bestCombo: 0,
  challengesWon: 0,
};

export default function HomePage() {
  const [lang, setLang] = useState<Language>("en");
  const [activeTab, setActiveTab] = useState<"learn" | "evaluate">("learn");
  const [mode, setMode] = useState<"practice" | "challenge">("practice");
  const [category, setCategory] = useState<SignCategory>("alphabet");
  const [signs, setSigns] = useState<FslSign[]>(STARTER_FSL_SIGNS);
  const [selectedSlug, setSelectedSlug] = useState<string>("alphabet-a");
  const [verifiedSlugs, setVerifiedSlugs] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string>("guest-session");
  const [game, setGame] = useState<GamificationState>(INITIAL_GAME_STATE);
  const [showBadges, setShowBadges] = useState(false);

  // Challenge Sprint State (5 random signs in 60s)
  const [challengeQueue, setChallengeQueue] = useState<FslSign[]>([]);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [challengeActive, setChallengeActive] = useState(false);
  const [challengeFinished, setChallengeFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [challengeScore, setChallengeScore] = useState(0);

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
        // ignore
      }
    }

    const savedGame = window.localStorage.getItem("ssaign_game_state");
    if (savedGame) {
      try {
        setGame(JSON.parse(savedGame));
      } catch {
        // ignore
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

  // Countdown timer for Challenge Sprint
  useEffect(() => {
    if (!challengeActive || challengeFinished) return;
    if (timeLeft <= 0) {
      setChallengeActive(false);
      setChallengeFinished(true);
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [challengeActive, challengeFinished, timeLeft]);

  const saveGameState = (next: GamificationState) => {
    setGame(next);
    window.localStorage.setItem("ssaign_game_state", JSON.stringify(next));
  };

  const categorySigns = useMemo(
    () => signs.filter((s) => s.category === category),
    [signs, category]
  );

  const selectedSign = useMemo(() => {
    if (mode === "challenge" && challengeQueue.length > 0) {
      return challengeQueue[challengeIndex] ?? categorySigns[0];
    }
    return categorySigns.find((s) => s.slug === selectedSlug) ?? categorySigns[0];
  }, [mode, challengeQueue, challengeIndex, categorySigns, selectedSlug]);

  const rank = useMemo(() => getRankInfo(game.xp, lang), [game.xp, lang]);
  const badges = useMemo(
    () => getBadges(verifiedSlugs, game),
    [verifiedSlugs, game]
  );
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  const handleCategoryChange = (nextCategory: SignCategory) => {
    setCategory(nextCategory);
    setChallengeActive(false);
    setChallengeFinished(false);
    const firstInCat = signs.find((s) => s.category === nextCategory);
    if (firstInCat) setSelectedSlug(firstInCat.slug);
  };

  const startChallengeSprint = () => {
    const pool = [...categorySigns];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const roundSigns = pool.slice(0, Math.min(5, pool.length));
    setChallengeQueue(roundSigns);
    setChallengeIndex(0);
    setChallengeScore(0);
    setTimeLeft(60);
    setChallengeFinished(false);
    setChallengeActive(true);
  };

  const handleVerified = (slug: string) => {
    const isNew = !verifiedSlugs.includes(slug);
    if (isNew) {
      const nextVerified = [...verifiedSlugs, slug];
      setVerifiedSlugs(nextVerified);
      window.localStorage.setItem(
        "ssaign_verified_slugs",
        JSON.stringify(nextVerified)
      );
    }

    const nextCombo = game.combo + 1;
    const earnedXp = (isNew ? 25 : 10) + Math.min(nextCombo * 5, 25);

    if (mode === "challenge" && challengeActive) {
      const nextScore = challengeScore + 1;
      setChallengeScore(nextScore);
      const isRoundDone = challengeIndex + 1 >= challengeQueue.length;
      saveGameState({
        xp: game.xp + earnedXp + (isRoundDone ? 50 : 0),
        combo: nextCombo,
        bestCombo: Math.max(game.bestCombo, nextCombo),
        challengesWon: game.challengesWon + (isRoundDone ? 1 : 0),
      });

      if (isRoundDone) {
        setChallengeActive(false);
        setChallengeFinished(true);
      } else {
        window.setTimeout(() => {
          setChallengeIndex((prev) => prev + 1);
        }, 700);
      }
    } else {
      saveGameState({
        ...game,
        xp: game.xp + earnedXp,
        combo: nextCombo,
        bestCombo: Math.max(game.bestCombo, nextCombo),
      });
    }
  };

  const handleNextSign = () => {
    if (mode === "challenge" && challengeActive) {
      if (challengeIndex + 1 < challengeQueue.length) {
        setChallengeIndex((prev) => prev + 1);
      }
      return;
    }
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-700 to-violet-700 text-white shadow-sm">
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
                  ? "bg-indigo-700 text-white"
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
                  ? "bg-indigo-700 text-white"
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
            >
              <Languages className="h-4 w-4 text-indigo-700" />
              {lang === "en" ? "EN → FIL" : "FIL → EN"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === "evaluate" ? (
          <EvaluationForm lang={lang} />
        ) : (
          <div className="space-y-5">
            {/* Studio Gamified Hero & XP HUD */}
            <section className="rounded-2xl bg-gradient-to-r from-indigo-950 via-violet-900 to-purple-900 p-6 text-white shadow-md">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                <div className="max-w-xl">
                  <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-violet-100">
                    {t.heroBadge}
                  </span>
                  <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                    {t.heroTitle}
                  </h2>
                  <p className="mt-1.5 text-sm text-violet-100/90">
                    {t.heroDesc}
                  </p>
                </div>

                {/* Gamification HUD Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {/* Rank & XP */}
                  <div className="col-span-2 rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm sm:col-span-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                      <Zap className="h-4 w-4" />
                      <span>
                        Lvl {rank.level} • {game.xp} XP
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-bold">
                      {rank.title}
                    </p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-300"
                        style={{ width: `${rank.progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Combo Streak */}
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-orange-200">
                      <Flame className="h-4 w-4 text-orange-400" />
                      <span>{lang === "en" ? "Combo" : "Sunod-sunod"}</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold">x{game.combo}</p>
                    <p className="text-[11px] text-violet-200">
                      {lang === "en" ? "Best" : "Pinakamataas"}: {game.bestCombo}
                    </p>
                  </div>

                  {/* Badges Button */}
                  <button
                    type="button"
                    onClick={() => setShowBadges((prev) => !prev)}
                    className="rounded-2xl border border-white/15 bg-white/10 p-3.5 text-left backdrop-blur-sm transition hover:bg-white/20"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-200">
                      <Medal className="h-4 w-4 text-emerald-400" />
                      <span>{lang === "en" ? "Badges" : "Mga Medalya"}</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold">
                      {unlockedCount}/{badges.length}
                    </p>
                    <p className="text-[11px] text-violet-200">
                      {lang === "en" ? "Tap to view" : "Pindutin"}
                    </p>
                  </button>
                </div>
              </div>

              {/* Expandable Badges Drawer */}
              {showBadges && (
                <div className="mt-4 grid gap-2.5 border-t border-white/15 pt-4 sm:grid-cols-3 lg:grid-cols-6">
                  {badges.map((b) => (
                    <div
                      key={b.id}
                      className={`rounded-xl border p-3 text-xs ${
                        b.unlocked
                          ? "border-amber-300/60 bg-amber-400/15 text-white"
                          : "border-white/10 bg-white/5 text-violet-200/60"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <Award
                          className={`h-4 w-4 ${
                            b.unlocked ? "text-amber-300" : "text-white/30"
                          }`}
                        />
                        <span>{lang === "en" ? b.title_en : b.title_fil}</span>
                      </div>
                      <p className="mt-1 text-[11px]">
                        {lang === "en" ? b.desc_en : b.desc_fil}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Category Tabs + Practice vs Challenge Mode Toggle */}
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
                              ? "bg-indigo-700 text-white shadow-sm"
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

                {/* Practice vs Challenge Game Switch */}
                <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("practice");
                      setChallengeActive(false);
                      setChallengeFinished(false);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      mode === "practice"
                        ? "bg-white text-indigo-800 shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    {lang === "en" ? "Practice Mode" : "Magsanay"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("challenge");
                      setChallengeActive(false);
                      setChallengeFinished(false);
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      mode === "challenge"
                        ? "bg-violet-700 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    <Gamepad2 className="h-3.5 w-3.5" />
                    {lang === "en" ? "5-Sign Sprint" : "Hamon (5 Senyas)"}
                  </button>
                </div>
              </div>

              {/* Practice Sign Grid OR Challenge Sprint Banner */}
              {mode === "practice" ? (
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
                            ? "border-indigo-700 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-200"
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
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-violet-950">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      {lang === "en"
                        ? "5-Sign Speed Challenge"
                        : "Mabilisang Hamon (5 Senyas)"}
                    </h4>
                    <p className="mt-0.5 text-xs text-violet-800">
                      {lang === "en"
                        ? "Sign 5 random gestures from this category within 60 seconds for +50 bonus XP!"
                        : "I-senyas ang 5 random na kumpas sa loob ng 60 segundo para sa +50 bonus XP!"}
                    </p>
                  </div>

                  {challengeActive ? (
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-bold text-violet-900 shadow-sm">
                        <Timer className="h-4 w-4 text-rose-600" />
                        {timeLeft}s
                      </span>
                      <span className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">
                        {challengeScore}/{challengeQueue.length}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startChallengeSprint}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-800"
                    >
                      <Play className="h-4 w-4" />
                      {challengeFinished
                        ? lang === "en"
                          ? "Play Again"
                          : "Maglaro Muli"
                        : lang === "en"
                          ? "Start Sprint"
                          : "Simulan ang Hamon"}
                    </button>
                  )}
                </div>
              )}

              {mode === "challenge" && challengeFinished && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <div className="flex items-center gap-2.5">
                    <Trophy className="h-6 w-6 text-amber-500" />
                    <div>
                      <p className="text-sm font-bold">
                        {lang === "en"
                          ? `Sprint Complete! Score: ${challengeScore}/${challengeQueue.length}`
                          : `Tapos na ang Hamon! Iskor: ${challengeScore}/${challengeQueue.length}`}
                      </p>
                      <p className="text-xs text-emerald-700">
                        {challengeScore === challengeQueue.length
                          ? lang === "en"
                            ? "Perfect run! +50 Bonus XP earned!"
                            : "Perpekto! Nakakuha ng +50 Bonus XP!"
                          : lang === "en"
                            ? "Great effort! Try again to beat your record."
                            : "Magaling! Subukan muli para sa mas mataas na iskor."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Split-Screen Studio Stage */}
            <section className="grid gap-6 lg:grid-cols-2">
              {/* Left: Instructional Reference Video OR Animated Studio Character */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-violet-700" />
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
                    className="aspect-video w-full rounded-2xl bg-slate-950 object-contain"
                  />
                ) : (
                  <SigningAvatar sign={selectedSign} lang={lang} />
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
                challengeMode={mode === "challenge" && challengeActive}
              />
            </section>

            {/* Scope & Delimitation Footer Notice */}
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
              <p>{t.scopeNotice}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}