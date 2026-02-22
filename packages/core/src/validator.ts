import type { AiTxtDocument, ValidationResult, ValidationError, ValidationWarning } from "./types.js";
import { AiTxtDocumentSchema } from "./schema.js";
import { parse } from "./parser.js";
import { parseJSON } from "./parser-json.js";

/**
 * Validate an AiTxtDocument object against the spec.
 */
export function validate(doc: AiTxtDocument): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Schema validation
  const schemaResult = AiTxtDocumentSchema.safeParse(doc);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      errors.push({
        path: issue.path.join("."),
        message: issue.message,
        code: "SCHEMA_VIOLATION",
      });
    }
  }

  // Training is "conditional" but no training paths defined
  if (doc.policies.training === "conditional") {
    if (!doc.trainingPaths || (doc.trainingPaths.allow.length === 0 && doc.trainingPaths.deny.length === 0)) {
      warnings.push({
        path: "policies.training",
        message: "Training is 'conditional' but no Training-Allow or Training-Deny paths are defined",
        code: "MISSING_TRAINING_PATHS",
      });
    }
  }

  // Training is "allow" but no license specified
  if (doc.policies.training === "allow" && !doc.licensing?.license) {
    warnings.push({
      path: "licensing.license",
      message: "Training is allowed but no Training-License is specified",
      code: "MISSING_LICENSE",
    });
  }

  // Site URL should be HTTPS
  if (doc.site.url && !doc.site.url.startsWith("https://")) {
    warnings.push({
      path: "site.url",
      message: "Site URL should use HTTPS",
      code: "INSECURE_URL",
    });
  }

  // Agent policy checks
  for (const [agentName, policy] of Object.entries(doc.agents)) {
    const policyFields = ["training", "scraping", "indexing", "caching"] as const;
    for (const field of policyFields) {
      const val = policy[field];
      if (val !== undefined && !["allow", "deny", "conditional"].includes(val)) {
        errors.push({
          path: `agents.${agentName}.${field}`,
          message: `Invalid policy value: "${val}"`,
          code: "INVALID_POLICY_VALUE",
        });
      }
      // "conditional" doesn't make sense at agent level (no per-agent training paths)
      if (val === "conditional") {
        warnings.push({
          path: `agents.${agentName}.${field}`,
          message: `Agent "${agentName}" uses "conditional" for ${field}, but per-agent conditional paths are not supported. Use "allow" or "deny" instead.`,
          code: "AGENT_CONDITIONAL_POLICY",
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Parse and validate an ai.txt text string.
 */
export function validateText(text: string): ValidationResult {
  const parseResult = parse(text);
  if (!parseResult.success || !parseResult.document) {
    return {
      valid: false,
      errors: parseResult.errors.map((e) => ({
        path: e.field ?? "",
        message: e.message,
        code: "PARSE_ERROR",
      })),
      warnings: [],
    };
  }
  return validate(parseResult.document);
}

/**
 * Parse and validate an ai.json string.
 */
export function validateJSON(json: string): ValidationResult {
  const parseResult = parseJSON(json);
  if (!parseResult.success || !parseResult.document) {
    return {
      valid: false,
      errors: parseResult.errors.map((e) => ({
        path: e.field ?? "",
        message: e.message,
        code: "PARSE_ERROR",
      })),
      warnings: [],
    };
  }
  return validate(parseResult.document);
}
