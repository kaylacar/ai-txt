/**
 * ai.txt — Policy Resolver
 *
 * Resolves the effective policy for a specific AI agent by merging
 * agent-specific overrides → wildcard defaults → site-wide policies.
 *
 * This is the module agents actually use to answer:
 * "Am I allowed to do this?"
 */

import type {
  AiTxtDocument,
  AgentPolicy,
  PolicyValue,
  RateLimit,
  ContentRequirements,
} from "./types.js";

// ── Types ──

/** Fully resolved policy for a specific agent — no undefined fields. */
export interface ResolvedPolicy {
  /** Effective training policy. */
  training: PolicyValue;
  /** Effective scraping policy. */
  scraping: PolicyValue;
  /** Effective indexing policy. */
  indexing: PolicyValue;
  /** Effective caching policy. */
  caching: PolicyValue;
  /** Effective rate limit (from agent block or wildcard). */
  rateLimit?: RateLimit;
  /** Content requirements (site-wide, not per-agent). */
  content?: ContentRequirements;
}

/** Result of a canAccess check. */
export interface AccessResult {
  /** Whether access is allowed. */
  allowed: boolean;
  /** Why — useful for logging/debugging. */
  reason: string;
}

// ── Resolver ──

/**
 * Resolve the effective policy for a named agent.
 *
 * Resolution order (first defined wins):
 *   1. Agent-specific override (`agents["ClaudeBot"]`)
 *   2. Wildcard override (`agents["*"]`)
 *   3. Site-wide policy (`policies`)
 */
export function resolve(doc: AiTxtDocument, agentName: string): ResolvedPolicy {
  const agentBlock: AgentPolicy = doc.agents[agentName.toLowerCase()] ?? {};
  const wildcardBlock: AgentPolicy = doc.agents["*"] ?? {};

  const resolved: ResolvedPolicy = {
    training: agentBlock.training ?? wildcardBlock.training ?? doc.policies.training,
    scraping: agentBlock.scraping ?? wildcardBlock.scraping ?? doc.policies.scraping,
    indexing: agentBlock.indexing ?? wildcardBlock.indexing ?? doc.policies.indexing,
    caching: agentBlock.caching ?? wildcardBlock.caching ?? doc.policies.caching,
  };

  // Rate limit: agent-specific > wildcard (no site-wide rate limit exists)
  const rateLimit = agentBlock.rateLimit ?? wildcardBlock.rateLimit;
  if (rateLimit) resolved.rateLimit = rateLimit;

  // Content requirements are site-wide, pass through
  if (doc.content) resolved.content = doc.content;

  return resolved;
}

/**
 * Check whether a specific action is allowed for an agent.
 *
 * For "conditional" training policies, pass a `path` to match against
 * the document's trainingPaths globs.
 *
 * @param doc       - The parsed ai.txt document.
 * @param agentName - The agent's User-Agent name (e.g., "ClaudeBot").
 * @param field     - Which policy to check: "training", "scraping", "indexing", or "caching".
 * @param path      - Optional URL path for conditional training path matching.
 */
export function canAccess(
  doc: AiTxtDocument,
  agentName: string,
  field: "training" | "scraping" | "indexing" | "caching",
  path?: string,
): AccessResult {
  const resolved = resolve(doc, agentName);
  const value = resolved[field];

  if (value === "allow") {
    return { allowed: true, reason: `${field} is allowed` };
  }

  if (value === "deny") {
    return { allowed: false, reason: `${field} is denied` };
  }

  // "conditional" — only training supports path-based resolution
  if (value === "conditional") {
    if (field !== "training") {
      // Conditional on non-training fields has no path mechanism — treat as deny
      return { allowed: false, reason: `${field} is conditional but path-based rules only apply to training` };
    }

    if (!path) {
      return { allowed: false, reason: "training is conditional but no path provided to check" };
    }

    if (!doc.trainingPaths) {
      return { allowed: false, reason: "training is conditional but no trainingPaths defined" };
    }

    return matchPath(path, doc.trainingPaths.allow, doc.trainingPaths.deny);
  }

  // Shouldn't happen with valid documents, but be safe
  return { allowed: false, reason: `unknown policy value: ${value}` };
}

/**
 * Match a URL path against allow/deny glob patterns.
 *
 * Rules:
 *   - Explicit deny takes precedence over allow.
 *   - If a path matches an allow pattern and no deny pattern, it's allowed.
 *   - If a path matches neither, it's denied (default-deny for conditional).
 */
export function matchPath(
  path: string,
  allowPatterns: string[],
  denyPatterns: string[],
): AccessResult {
  // Check deny first — deny takes precedence
  for (const pattern of denyPatterns) {
    if (globMatch(path, pattern)) {
      return { allowed: false, reason: `path "${path}" matches deny pattern "${pattern}"` };
    }
  }

  // Check allow
  for (const pattern of allowPatterns) {
    if (globMatch(path, pattern)) {
      return { allowed: true, reason: `path "${path}" matches allow pattern "${pattern}"` };
    }
  }

  // No match — default deny for conditional
  return { allowed: false, reason: `path "${path}" does not match any training path pattern` };
}

/**
 * Simple glob matcher for URL paths.
 *
 * Supports:
 *   - `*`  — matches any characters within a single path segment (no `/`)
 *   - `**` — matches any characters including `/` (recursive)
 *   - Literal path segments
 *
 * Examples:
 *   - `/blog/*`       matches `/blog/post-1` but not `/blog/2024/post-1`
 *   - `/blog/**`      matches `/blog/post-1` and `/blog/2024/post-1`
 *   - `/public/*.html` matches `/public/index.html`
 */
export function globMatch(path: string, pattern: string): boolean {
  // Reject patterns longer than 1000 chars to prevent pathological regex
  if (pattern.length > 1000 || path.length > 2000) return false;

  // Replace placeholder chars in input to prevent collision with our internal markers
  const sanitized = pattern
    .replace(/\u0001/g, "")
    .replace(/\u0002/g, "");

  const regexStr = sanitized
    .replace(/([.+?^${}()|[\]\\])/g, "\\$1")  // escape regex chars (not *)
    .replace(/\/\*\*\//g, "\u0001")             // /**/ → placeholder (zero or more segments)
    .replace(/\*\*/g, "\u0002")                 // ** → placeholder (anything including /)
    .replace(/\*/g, "[^/]*")                    // * = anything except /
    .replace(/\u0001/g, "(?:/.+)?/")            // restore /**/ as optional segments
    .replace(/\u0002/g, ".*");                  // restore ** as any chars

  try {
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(path);
  } catch {
    return false;
  }
}
