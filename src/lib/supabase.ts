import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes("YOUR-PROJECT-REF");

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface PracticeAttemptInsert {
  session_id: string;
  sign_slug: string;
  category: string;
  matched: boolean;
  confidence: number;
  feedback_code?: string;
  response_ms?: number;
}

export interface EvaluationFeedbackInsert {
  respondent_group: "deaf" | "hard_of_hearing" | "hearing_learner" | "fsl_educator";
  functionality_rating: number;
  reliability_rating: number;
  usability_rating: number;
  video_clarity_rating: number;
  comments?: string;
  language_used: "en" | "fil";
}