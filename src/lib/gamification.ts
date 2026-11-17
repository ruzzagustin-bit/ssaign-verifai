import type { Language } from "@/lib/i18n";

export interface GamificationState {
  xp: number;
  combo: number;
  bestCombo: number;
  challengesWon: number;
}

export interface RankInfo {
  level: number;
  title: string;
  minXp: number;
  nextXp: number;
  progressPct: number;
}

export interface BadgeInfo {
  id: string;
  title_en: string;
  title_fil: string;
  desc_en: string;
  desc_fil: string;
  unlocked: boolean;
}

const RANKS = [
  { level: 1, en: "FSL Explorer", fil: "Baguhang Manlalakbay", minXp: 0 },
  { level: 2, en: "Handshape Apprentice", fil: "Estudyante ng Senyas", minXp: 100 },
  { level: 3, en: "Confident Signer", fil: "Mahusay na Tagapag-senyas", minXp: 250 },
  { level: 4, en: "FSL Advocate", fil: "Tagapagtaguyod ng FSL", minXp: 500 },
  { level: 5, en: "SSAign Master", fil: "Dalubhasa sa SSAign", minXp: 850 },
];

export function getRankInfo(xp: number, lang: Language): RankInfo {
  let current = RANKS[0];
  let next = RANKS[1];

  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].minXp) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? { ...RANKS[i], minXp: RANKS[i].minXp + 300 };
    }
  }

  const span = Math.max(next.minXp - current.minXp, 1);
  const progressPct =
    current.level === RANKS[RANKS.length - 1].level && xp >= current.minXp
      ? 100
      : Math.min(100, Math.round(((xp - current.minXp) / span) * 100));

  return {
    level: current.level,
    title: lang === "en" ? current.en : current.fil,
    minXp: current.minXp,
    nextXp: next.minXp,
    progressPct,
  };
}

export function getBadges(
  verifiedSlugs: string[],
  state: GamificationState
): BadgeInfo[] {
  const alphaCount = verifiedSlugs.filter((s) => s.startsWith("alphabet-")).length;
  const numCount = verifiedSlugs.filter((s) => s.startsWith("number-")).length;
  const greetCount = verifiedSlugs.filter((s) => s.startsWith("greeting-")).length;

  return [
    {
      id: "first-sign",
      title_en: "First Sign!",
      title_fil: "Unang Senyas!",
      desc_en: "Verify your very first FSL sign",
      desc_fil: "Maberipika ang iyong unang senyas",
      unlocked: verifiedSlugs.length >= 1,
    },
    {
      id: "combo-3",
      title_en: "Hot Streak x3",
      title_fil: "Sunod-sunod x3",
      desc_en: "Verify 3 signs in a row",
      desc_fil: "Makapagberipika ng 3 sunod-sunod na senyas",
      unlocked: state.bestCombo >= 3,
    },
    {
      id: "alphabet-5",
      title_en: "Alphabet Explorer",
      title_fil: "Bida sa Alpabeto",
      desc_en: "Verify 5 Alphabet letters",
      desc_fil: "Makapagberipika ng 5 titik sa Alpabeto",
      unlocked: alphaCount >= 5,
    },
    {
      id: "number-5",
      title_en: "Number Ninja",
      title_fil: "Mahusay sa Bilang",
      desc_en: "Verify 5 FSL numbers",
      desc_fil: "Makapagberipika ng 5 bilang sa FSL",
      unlocked: numCount >= 5,
    },
    {
      id: "greeting-3",
      title_en: "Friendly Greeter",
      title_fil: "Magalang na Pagbati",
      desc_en: "Verify 3 Basic Greetings",
      desc_fil: "Makapagberipika ng 3 pangunahing pagbati",
      unlocked: greetCount >= 3,
    },
    {
      id: "sprint-winner",
      title_en: "Sprint Champion",
      title_fil: "Kampeon sa Hamon",
      desc_en: "Complete a 5-Sign Challenge",
      desc_fil: "Matapos ang 5-Senyas na Hamon",
      unlocked: state.challengesWon >= 1,
    },
  ];
}