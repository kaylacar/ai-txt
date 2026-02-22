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
export function parse(input: string): ParseResult {
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

    // Skip empty lines and comments
    if (trimmed === "" || trimmed.startsWith("#")) {
      const specMatch = trimmed.match(/^#\s*Spec-Version:\s*(.+)/i);
      if (specMatch) specVersion = specMatch[1].trim();
      const genMatch = trimmed.match(/^#\s*Generated:\s*(.+)/i);
      if (genMatch) generatedAt = genMatch[1].trim();
      continue;
    }

    // Check if this is an indented line
    const isIndented = raw.startsWith("  ") || raw.startsWith("\t");

    if (isIndented && state === "IN_AGENT" && currentAgentPolicy) {
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) {
        warnings.push({ line: lineNum, message: `Unparseable indented line: "${trimmed}"` });
        continue;
      }
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();

      switch (key) {
        case "Training":
          if (VALID_POLICY_VALUES.has(value)) {
            currentAgentPolicy.training = value as PolicyValue;
          } else {
            warnings.push({ line: lineNum, field: "Training", message: `Invalid policy value: ${value}` });
          }
          break;
        case "Scraping":
          if (VALID_POLICY_VALUES.has(value)) {
            currentAgentPolicy.scraping = value as PolicyValue;
          } else {
            warnings.push({ line: lineNum, field: "Scraping", message: `Invalid policy value: ${value}` });
          }
          break;
        case "Indexing":
          if (VALID_POLICY_VALUES.has(value)) {
            currentAgentPolicy.indexing = value as PolicyValue;
          } else {
            warnings.push({ line: lineNum, field: "Indexing", message: `Invalid policy value: ${value}` });
          }
          break;
        case "Caching":
          if (VALID_POLICY_VALUES.has(value)) {
            currentAgentPolicy.caching = value as PolicyValue;
          } else {
            warnings.push({ line: lineNum, field: "Caching", message: `Invalid policy value: ${value}` });
          }
          break;
        case "Rate-Limit": {
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
    const value = trimmed.slice(colonIdx + 1).trim();

    switch (key) {
      case "Site-Name": site.name = value; break;
      case "Site-URL": site.url = value; break;
      case "Description":
      case "Site-Description": site.description = value; break;
      case "Contact":
      case "Site-Contact": site.contact = value; break;
      case "Policy-URL": site.policyUrl = value; break;

      // Content policies
      case "Training":
        if (VALID_POLICY_VALUES.has(value)) {
          policies.training = value;
        } else {
          warnings.push({ line: lineNum, field: "Training", message: `Invalid policy value: ${value}` });
        }
        break;
      case "Scraping":
        if (VALID_POLICY_VALUES.has(value)) {
          policies.scraping = value;
        } else {
          warnings.push({ line: lineNum, field: "Scraping", message: `Invalid policy value: ${value}` });
        }
        break;
      case "Indexing":
        if (VALID_POLICY_VALUES.has(value)) {
          policies.indexing = value;
        } else {
          warnings.push({ line: lineNum, field: "Indexing", message: `Invalid policy value: ${value}` });
        }
        break;
      case "Caching":
        if (VALID_POLICY_VALUES.has(value)) {
          policies.caching = value;
        } else {
          warnings.push({ line: lineNum, field: "Caching", message: `Invalid policy value: ${value}` });
        }
        break;

      // Training paths
      case "Training-Allow": trainingAllowPaths.push(value); break;
      case "Training-Deny": trainingDenyPaths.push(value); break;

      // Licensing
      case "Training-License": licensing.license = value; break;
      case "Training-Fee": licensing.feeUrl = value; break;

      // Content requirements
      case "Attribution":
        if (VALID_REQUIREMENT_LEVELS.has(value)) {
          content.attribution = value;
        } else {
          warnings.push({ line: lineNum, field: "Attribution", message: `Invalid requirement level: ${value}` });
        }
        break;
      case "AI-Disclosure":
        if (VALID_REQUIREMENT_LEVELS.has(value)) {
          content.aiDisclosure = value;
        } else {
          warnings.push({ line: lineNum, field: "AI-Disclosure", message: `Invalid requirement level: ${value}` });
        }
        break;

      // Compliance
      case "Audit":
        if (VALID_REQUIREMENT_LEVELS.has(value)) {
          compliance.audit = value;
        } else {
          warnings.push({ line: lineNum, field: "Audit", message: `Invalid requirement level: ${value}` });
        }
        break;
      case "Audit-Format": compliance.auditFormat = value; break;

      // Cross-references
      case "AI-JSON": metadata["AI-JSON"] = value; break;
      case "Agents-TXT": metadata["Agents-TXT"] = value; break;

      // Agent block
      case "Agent":
        currentAgentName = value;
        currentAgentPolicy = {};
        state = "IN_AGENT";
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
