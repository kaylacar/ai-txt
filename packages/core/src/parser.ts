import type {
  AiTxtDocument,
  AgentPolicy,
  ParseResult,
  ParseError,
  ParseWarning,
  PolicyValue,
  RateLimitWindow,
  RequirementLevel,
} from "./types.js";
import { parseRateLimit } from "./utils.js";

type ParserState = "TOP_LEVEL" | "IN_AGENT";

const VALID_POLICY_VALUES = new Set(["allow", "deny", "conditional"]);
const VALID_REQUIREMENT_LEVELS = new Set(["required", "recommended", "optional", "none"]);

/**
 * Parse an ai.txt text document into a structured AiTxtDocument.
 */
const MAX_INPUT_SIZE = 1_048_576; // 1 MB

export function parse(input: string): ParseResult {
  if (input.length > MAX_INPUT_SIZE) {
    return { success: false, errors: [{ message: `Input too large (${input.length} characters). Maximum is ${MAX_INPUT_SIZE}.` }], warnings: [] };
  }

  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const lines = input.split(/\r?\n/);

  // Collected data
  let specVersion = "1.0";
  let generatedAt: string | undefined;
  const site: Record<string, string> = {};
  const policies: Record<string, string> = {};
  const trainingAllowPaths: string[] = [];
  const trainingDenyPaths: string[] = [];
  const licensing: Record<string, string> = {};
  const agents: Record<string, AgentPolicy> = {};
  const content: Record<string, string> = {};
  const compliance: Record<string, string> = {};
  const metadata: Record<string, string> = {};

  let state: ParserState = "TOP_LEVEL";
  let currentAgentName: string | null = null;
  let currentAgentPolicy: AgentPolicy | null = null;

  function flushAgent() {
    if (currentAgentName !== null && currentAgentPolicy !== null) {
      agents[currentAgentName] = currentAgentPolicy;
    }
    currentAgentName = null;
    currentAgentPolicy = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip empty lines and comments (accept legacy # Spec-Version / # Generated for backward compat)
    if (trimmed === "" || trimmed.startsWith("#")) {
      const specMatch = trimmed.match(/^#\s*Spec-Version:\s*(.+)/i);
      if (specMatch) {
        specVersion = specMatch[1].trim();
        warnings.push({ line: lineNum, message: "Spec-Version found in comment — use a top-level field instead" });
      }
      const genMatch = trimmed.match(/^#\s*Generated(?:-At)?:\s*(.+)/i);
      if (genMatch) {
        generatedAt = genMatch[1].trim();
        warnings.push({ line: lineNum, message: "Generated-At found in comment — use a top-level field instead" });
      }
      continue;
    }

    // Check if this is an indented line
    const isIndented = raw.startsWith("  ") || raw.startsWith("\t");

    // Indented line outside a block — warn and skip
    if (isIndented && state === "TOP_LEVEL") {
      warnings.push({ line: lineNum, message: `Indented line outside of a block: "${trimmed}"` });
      continue;
    }

    if (isIndented && state === "IN_AGENT" && currentAgentPolicy) {
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) {
        warnings.push({ line: lineNum, message: `Unparseable indented line: "${trimmed}"` });
        continue;
      }
      const key = trimmed.slice(0, colonIdx).trim();
      const keyLower = key.toLowerCase();
      const value = trimmed.slice(colonIdx + 1).trim();

      switch (keyLower) {
        case "training":
          if (VALID_POLICY_VALUES.has(value)) {
            currentAgentPolicy.training = value as PolicyValue;
          } else {
            warnings.push({ line: lineNum, field: "Training", message: `Invalid policy value: ${value}` });
          }
          break;
        case "scraping":
          if (VALID_POLICY_VALUES.has(value)) {
            currentAgentPolicy.scraping = value as PolicyValue;
          } else {
            warnings.push({ line: lineNum, field: "Scraping", message: `Invalid policy value: ${value}` });
          }
          break;
        case "indexing":
          if (VALID_POLICY_VALUES.has(value)) {
            currentAgentPolicy.indexing = value as PolicyValue;
          } else {
            warnings.push({ line: lineNum, field: "Indexing", message: `Invalid policy value: ${value}` });
          }
          break;
        case "caching":
          if (VALID_POLICY_VALUES.has(value)) {
            currentAgentPolicy.caching = value as PolicyValue;
          } else {
            warnings.push({ line: lineNum, field: "Caching", message: `Invalid policy value: ${value}` });
          }
          break;
        case "rate-limit": {
          const rl = parseRateLimit(value);
          if (rl) {
            currentAgentPolicy.rateLimit = { requests: rl.requests, window: rl.window as RateLimitWindow };
          } else {
            warnings.push({ line: lineNum, field: "Rate-Limit", message: `Invalid rate limit: ${value}` });
          }
          break;
        }
        default:
          warnings.push({ line: lineNum, message: `Unknown agent field: ${key}` });
      }
      continue;
    }

    // Non-indented line — flush any open block
    if (state === "IN_AGENT") { flushAgent(); state = "TOP_LEVEL"; }

    // Parse top-level key: value
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) {
      warnings.push({ line: lineNum, message: `Unparseable line: "${trimmed}"` });
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const keyLower = key.toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();

    switch (keyLower) {
      case "spec-version": specVersion = value; break;
      case "generated-at": generatedAt = value; break;

      case "site-name": site.name = value; break;
      case "site-url": site.url = value; break;
      case "description":
      case "site-description": site.description = value; break;
      case "contact":
      case "site-contact": site.contact = value; break;
      case "policy-url": site.policyUrl = value; break;

      // Content policies
      case "training":
        if (VALID_POLICY_VALUES.has(value)) {
          policies.training = value;
        } else {
          warnings.push({ line: lineNum, field: "Training", message: `Invalid policy value: ${value}` });
        }
        break;
      case "scraping":
        if (VALID_POLICY_VALUES.has(value)) {
          policies.scraping = value;
        } else {
          warnings.push({ line: lineNum, field: "Scraping", message: `Invalid policy value: ${value}` });
        }
        break;
      case "indexing":
        if (VALID_POLICY_VALUES.has(value)) {
          policies.indexing = value;
        } else {
          warnings.push({ line: lineNum, field: "Indexing", message: `Invalid policy value: ${value}` });
        }
        break;
      case "caching":
        if (VALID_POLICY_VALUES.has(value)) {
          policies.caching = value;
        } else {
          warnings.push({ line: lineNum, field: "Caching", message: `Invalid policy value: ${value}` });
        }
        break;

      // Training paths
      case "training-allow": trainingAllowPaths.push(value); break;
      case "training-deny": trainingDenyPaths.push(value); break;

      // Licensing
      case "training-license": licensing.license = value; break;
      case "training-fee": licensing.feeUrl = value; break;

      // Content requirements
      case "attribution":
        if (VALID_REQUIREMENT_LEVELS.has(value)) {
          content.attribution = value;
        } else {
          warnings.push({ line: lineNum, field: "Attribution", message: `Invalid requirement level: ${value}` });
        }
        break;
      case "ai-disclosure":
        if (VALID_REQUIREMENT_LEVELS.has(value)) {
          content.aiDisclosure = value;
        } else {
          warnings.push({ line: lineNum, field: "AI-Disclosure", message: `Invalid requirement level: ${value}` });
        }
        break;

      // Compliance
      case "audit":
        if (VALID_REQUIREMENT_LEVELS.has(value)) {
          compliance.audit = value;
        } else {
          warnings.push({ line: lineNum, field: "Audit", message: `Invalid requirement level: ${value}` });
        }
        break;
      case "audit-format": compliance.auditFormat = value; break;

      // Cross-references
      case "ai-json": metadata["AI-JSON"] = value; break;
      case "agents-txt": metadata["Agents-TXT"] = value; break;

      // Agent block
      case "agent":
        if (!value) {
          warnings.push({ line: lineNum, field: "Agent", message: "Agent name must not be empty" });
        } else {
          const normalizedAgent = value.toLowerCase();
          if (agents[normalizedAgent]) {
            warnings.push({ line: lineNum, field: "Agent", message: `Duplicate Agent block "${value}" — previous block will be overwritten` });
          }
          currentAgentName = normalizedAgent;
          currentAgentPolicy = {};
          state = "IN_AGENT";
        }
        break;

      default:
        metadata[key] = value;
    }
  }

  // Flush any remaining open block
  if (state === "IN_AGENT") flushAgent();

  // Validate required fields
  if (!site.name) errors.push({ field: "Site-Name", message: "Site-Name is required" });
  if (!site.url) errors.push({ field: "Site-URL", message: "Site-URL is required" });

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  const document: AiTxtDocument = {
    specVersion,
    generatedAt,
    site: {
      name: site.name!,
      url: site.url!,
      description: site.description,
      contact: site.contact,
      policyUrl: site.policyUrl,
    },
    policies: {
      training: (policies.training as PolicyValue) ?? "deny",
      scraping: (policies.scraping as PolicyValue) ?? "allow",
      indexing: (policies.indexing as PolicyValue) ?? "allow",
      caching: (policies.caching as PolicyValue) ?? "allow",
    },
    trainingPaths: (trainingAllowPaths.length > 0 || trainingDenyPaths.length > 0)
      ? { allow: trainingAllowPaths, deny: trainingDenyPaths }
      : undefined,
    licensing: (licensing.license || licensing.feeUrl)
      ? { license: licensing.license, feeUrl: licensing.feeUrl }
      : undefined,
    agents: Object.keys(agents).length > 0 ? agents : { "*": {} },
    content: (content.attribution || content.aiDisclosure)
      ? {
          attribution: content.attribution as RequirementLevel | undefined,
          aiDisclosure: content.aiDisclosure as RequirementLevel | undefined,
        }
      : undefined,
    compliance: (compliance.audit || compliance.auditFormat)
      ? {
          audit: compliance.audit as RequirementLevel | undefined,
          auditFormat: compliance.auditFormat,
        }
      : undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };

  return { success: true, document, errors, warnings };
}
