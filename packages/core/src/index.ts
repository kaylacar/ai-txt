// Parser
export { parse } from "./parser.js";
export { parseJSON } from "./parser-json.js";

// Generator
export { generate } from "./generator.js";
export { generateJSON } from "./generator-json.js";

// Validator
export { validate, validateText, validateJSON } from "./validator.js";

// Resolver
export { resolve, canAccess, matchPath, globMatch } from "./resolver.js";
export type { ResolvedPolicy, AccessResult } from "./resolver.js";

// Client
export { AiTxtClient } from "./client.js";
export type { ClientOptions } from "./client.js";

// Types
export type {
  AiTxtDocument,
  SiteInfo,
  ContentPolicies,
  PolicyValue,
  TrainingPaths,
  LicensingInfo,
  AgentPolicy,
  RateLimit,
  RateLimitWindow,
  ContentRequirements,
  RequirementLevel,
  ComplianceConfig,
  ParseResult,
  ParseError,
  ParseWarning,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "./types.js";

// Schema
export {
  AiTxtDocumentSchema,
  SiteInfoSchema,
  ContentPoliciesSchema,
  PolicyValueSchema,
  AgentPolicySchema,
  RateLimitSchema,
  RateLimitWindowSchema,
  RequirementLevelSchema,
  TrainingPathsSchema,
  LicensingInfoSchema,
  ContentRequirementsSchema,
  ComplianceConfigSchema,
} from "./schema.js";

// Utilities
export { sanitizeValue, parseRateLimit, formatRateLimit } from "./utils.js";
