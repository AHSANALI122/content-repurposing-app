// Mirrors the backend schemas in backend/app/schemas.py — keep in sync.

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export type Platform = "twitter" | "linkedin" | "instagram" | "newsletter";

export type Tone = "professional" | "casual" | "witty" | "bold";

export interface RepurposeRequest {
  source_text: string;
  title?: string;
  tone: Tone;
  platforms: Platform[];
}

export interface RepurposeOutput {
  id: number;
  platform: Platform;
  content: string;
  created_at: string;
}

export interface RepurposeJob {
  id: number;
  user_id: number;
  title: string;
  source_text: string;
  tone: Tone;
  created_at: string;
  outputs: RepurposeOutput[];
}

// --- Agent repurpose ---------------------------------------------------------

export interface AgentRepurposeRequest {
  url?: string;
  source_text?: string;
  title?: string;
  tone: Tone;
  platforms: Platform[];
}

export type TraceStepType = "tool" | "note" | "finish" | "error";

export interface TraceStep {
  type: TraceStepType;
  detail: string;
}

export interface AgentRepurposeResponse {
  job: RepurposeJob;
  trace: TraceStep[];
}
