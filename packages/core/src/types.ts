/**
 * ai.txt — Core Type System
 *
 * These types define the complete ai.txt document structure.
 * A document declares a website's AI policy — training, scraping,
 * indexing, caching, licensing, and per-agent overrides.
 */

// ── Document ──

export interface AiTxtDocument {
  /** Spec version. Currently "1.0". */
  specVersion: string;
  /** ISO 8601 timestamp of when this file was generated. */
  generatedAt?: string;
  /** Site identity and metadata. */
  site: SiteInfo;
  /** Site-wide content policies. */
  policies: ContentPolicies;
  /** Path-based training control (when training is "conditional"). */
  trainingPaths?: TrainingPaths;
  /** Licensing information for AI training use. */
  licensing?: LicensingInfo;
  /** Per-agent policy overrides (keyed by agent name, "*" = default). */
  agents: Record<string, AgentPolicy>;
  /** Content attribution and disclosure requirements. */
  content?: ContentRequirements;
  /** Compliance and audit requirements. */
  compliance?: ComplianceConfig;
  /** Optional free-form metadata. */
  metadata?: Record<string, string>;
}

// ── Site Info ──

export interface SiteInfo {
  /** Human-readable site name. */
  name: string;
  /** Canonical site URL. */
  url: string;
  /** Brief description of the site. */
  description?: string;
  /** Contact email for AI policy inquiries. */
  contact?: string;
  /** URL to human-readable AI policy page. */
  policyUrl?: string;
}

// ── Content Policies ──

export type PolicyValue = "allow" | "deny" | "conditional";

export interface ContentPolicies {
  /** Whether AI systems may use content for model training. Default: "deny". */
  training: PolicyValue;
  /** Whether AI agents may scrape/read content. Default: "allow". */
  scraping: PolicyValue;
  /** Whether AI systems may index content for retrieval. Default: "allow". */
  indexing: PolicyValue;
  /** Whether AI systems may cache content. Default: "allow". */
  caching: PolicyValue;
}

// ── Training Paths ──

export interface TrainingPaths {
  /** Glob patterns for paths where training is permitted. */
  allow: string[];
  /** Glob patterns for paths where training is denied. */
  deny: string[];
}

// ── Licensing ──

export interface LicensingInfo {
  /** SPDX license identifier for AI training use. */
  license?: string;
  /** URL to commercial licensing/pricing page. */
  feeUrl?: string;
}

// ── Agent Policies ──

export interface AgentPolicy {
  /** Override training policy for this agent. */
  training?: PolicyValue;
  /** Override scraping policy for this agent. */
  scraping?: PolicyValue;
  /** Override indexing policy for this agent. */
  indexing?: PolicyValue;
  /** Override caching policy for this agent. */
  caching?: PolicyValue;
  /** Advisory rate limit for this agent. */
  rateLimit?: RateLimit;
}

export interface RateLimit {
  /** Number of allowed requests per window. */
  requests: number;
  /** Time window. */
  window: RateLimitWindow;
}

export type RateLimitWindow = "second" | "minute" | "hour" | "day";

// ── Content Requirements ──

export type RequirementLevel = "required" | "recommended" | "optional" | "none";

export interface ContentRequirements {
  /** Whether AI outputs must attribute the source. */
  attribution?: RequirementLevel;
  /** Whether AI-generated content must be disclosed. */
  aiDisclosure?: RequirementLevel;
}

// ── Compliance ──

export interface ComplianceConfig {
  /** Whether AI agents must provide audit receipts. */
  audit?: RequirementLevel;
  /** Expected audit format identifier. */
  auditFormat?: string;
}

// ── Parse/Validate Results ──

export interface ParseResult {
  success: boolean;
  document?: AiTxtDocument;
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseError {
  line?: number;
  field?: string;
  message: string;
}

export interface ParseWarning {
  line?: number;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}
