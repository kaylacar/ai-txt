import { z } from "zod";

export const PolicyValueSchema = z.enum(["allow", "deny", "conditional"]);

export const RequirementLevelSchema = z.enum(["required", "recommended", "optional", "none"]);

export const RateLimitWindowSchema = z.enum(["second", "minute", "hour", "day"]);

export const RateLimitSchema = z.object({
  requests: z.number().int().positive(),
  window: RateLimitWindowSchema,
});

export const SiteInfoSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  description: z.string().max(500).optional(),
  contact: z.string().max(200).optional(),
  policyUrl: z.string().url().optional(),
});

export const ContentPoliciesSchema = z.object({
  training: PolicyValueSchema,
  scraping: PolicyValueSchema,
  indexing: PolicyValueSchema,
  caching: PolicyValueSchema,
});

export const TrainingPathsSchema = z.object({
  allow: z.array(z.string()),
  deny: z.array(z.string()),
});

export const LicensingInfoSchema = z.object({
  license: z.string().max(100).optional(),
  feeUrl: z.string().url().optional(),
});

export const AgentPolicySchema = z.object({
  training: PolicyValueSchema.optional(),
  scraping: PolicyValueSchema.optional(),
  indexing: PolicyValueSchema.optional(),
  caching: PolicyValueSchema.optional(),
  rateLimit: RateLimitSchema.optional(),
});

export const ContentRequirementsSchema = z.object({
  attribution: RequirementLevelSchema.optional(),
  aiDisclosure: RequirementLevelSchema.optional(),
});

export const ComplianceConfigSchema = z.object({
  audit: RequirementLevelSchema.optional(),
  auditFormat: z.string().max(100).optional(),
});

export const AiTxtDocumentSchema = z.object({
  specVersion: z.string().regex(/^\d+\.\d+$/, "Must be major.minor format"),
  generatedAt: z.string().datetime().optional(),
  site: SiteInfoSchema,
  policies: ContentPoliciesSchema,
  trainingPaths: TrainingPathsSchema.optional(),
  licensing: LicensingInfoSchema.optional(),
  agents: z.record(z.string(), AgentPolicySchema),
  content: ContentRequirementsSchema.optional(),
  compliance: ComplianceConfigSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});
