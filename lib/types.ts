export type Seniority = "intern" | "junior" | "mid" | "senior" | "staff";

export interface InferredRole {
  title: string;
  confidence: number;
  fit_reason: string;
  interview_focus: {
    core_skills: string[];
    probe_areas: string[];
    project_deep_dives: string[];
  };
}

export interface ResumeAnalysis {
  candidate_name?: string;
  skills: { strong: string[]; moderate: string[]; weak: string[] };
  experience_years: number;
  domain: string;
  seniority: Seniority;
  inferred_roles: InferredRole[];
  raw_text: string;
}

export interface JobMatch {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_city?: string | null;
  job_country?: string | null;
  job_employment_type?: string | null;
  job_apply_link: string;
  job_description?: string;
  match_score: number;
  match_reasons: string[];
}

export type QuestionType =
  | "technical"
  | "behavioral"
  | "system_design"
  | "coding"
  | "project_deep_dive";

export interface InterviewQuestion {
  id: string;
  question: string;
  type: QuestionType;
  difficulty: number;
  expected_keywords: string[];
  encouragement?: string | null;
  index: number;
}

export interface AnswerEvaluation {
  correctness_score: number;
  depth_score: number;
  missing_concepts: string[];
  strengths: string[];
  brief_ideal_answer: string;
  follow_up_if_weak?: string;
}

export interface AudioMetrics {
  transcription: string;
  confidence: number;
  hesitation_count: number;
  speech_rate_wpm: number;
  filler_word_ratio: number;
  duration_sec: number;
}

export interface VisualMetrics {
  engagement: number;
  composure: number;
  posture: number;
  stress_level: number;
  frame_count: number;
}

export interface AnswerRecord {
  question: InterviewQuestion;
  transcript: string;
  evaluation: AnswerEvaluation;
  audio: AudioMetrics;
  visual: VisualMetrics;
  combined_score: {
    technical: number;
    communication: number;
    confidence: number;
  };
}

export interface InterviewSession {
  id: string;
  startedAt: number;
  resume: ResumeAnalysis;
  targetRole: string;
  difficultyLevel: number;
  questions: InterviewQuestion[];
  answers: AnswerRecord[];
  status: "active" | "completed";
}

export interface FinalReport {
  overall_score: number;
  hire_recommendation: "strong_yes" | "yes" | "maybe" | "no";
  technical_summary: {
    score: number;
    strengths: string[];
    gaps: string[];
    study_topics: string[];
  };
  communication_summary: {
    score: number;
    observations: string[];
    tips: string[];
  };
  confidence_summary: {
    score: number;
    observations: string[];
    tips: string[];
  };
  top_3_improvements: string[];
  top_3_strengths: string[];
  next_steps: string[];
}
