import type { AiTxtDocument } from "./types.js";
import { sanitizeValue, formatRateLimit } from "./utils.js";

/**
 * Generate ai.txt text format from a document object.
 */
export function generate(doc: AiTxtDocument): string {
  const lines: string[] = [];

  // Header
  lines.push("# ai.txt — AI Policy Declaration");
  lines.push(`# Spec-Version: ${doc.specVersion}`);
  if (doc.generatedAt) {
    lines.push(`# Generated: ${doc.generatedAt}`);
  }
  lines.push("");

  // Site info
  lines.push(`Site-Name: ${sanitizeValue(doc.site.name)}`);
  lines.push(`Site-URL: ${sanitizeValue(doc.site.url)}`);
  if (doc.site.description) {
    lines.push(`Description: ${sanitizeValue(doc.site.description)}`);
  }
  if (doc.site.contact) {
    lines.push(`Contact: ${sanitizeValue(doc.site.contact)}`);
  }
  if (doc.site.policyUrl) {
    lines.push(`Policy-URL: ${sanitizeValue(doc.site.policyUrl)}`);
  }
  lines.push("");

  // Content policies
  lines.push(`Training: ${doc.policies.training}`);
  lines.push(`Scraping: ${doc.policies.scraping}`);
  lines.push(`Indexing: ${doc.policies.indexing}`);
  lines.push(`Caching: ${doc.policies.caching}`);
  lines.push("");

  // Training paths
  if (doc.trainingPaths) {
    for (const pattern of doc.trainingPaths.allow) {
      lines.push(`Training-Allow: ${pattern}`);
    }
    for (const pattern of doc.trainingPaths.deny) {
      lines.push(`Training-Deny: ${pattern}`);
    }
    if (doc.trainingPaths.allow.length > 0 || doc.trainingPaths.deny.length > 0) {
      lines.push("");
    }
  }

  // Licensing
  if (doc.licensing) {
    if (doc.licensing.license) {
      lines.push(`Training-License: ${sanitizeValue(doc.licensing.license)}`);
    }
    if (doc.licensing.feeUrl) {
      lines.push(`Training-Fee: ${sanitizeValue(doc.licensing.feeUrl)}`);
    }
    if (doc.licensing.license || doc.licensing.feeUrl) {
      lines.push("");
    }
  }

  // Agent policies
  for (const [agent, policy] of Object.entries(doc.agents)) {
    lines.push(`Agent: ${agent}`);
    if (policy.training) {
      lines.push(`  Training: ${policy.training}`);
    }
    if (policy.scraping) {
      lines.push(`  Scraping: ${policy.scraping}`);
    }
    if (policy.indexing) {
      lines.push(`  Indexing: ${policy.indexing}`);
    }
    if (policy.caching) {
      lines.push(`  Caching: ${policy.caching}`);
    }
    if (policy.rateLimit) {
      lines.push(`  Rate-Limit: ${formatRateLimit(policy.rateLimit.requests, policy.rateLimit.window)}`);
    }
  }
  lines.push("");

  // Content requirements
  if (doc.content) {
    if (doc.content.attribution) {
      lines.push(`Attribution: ${doc.content.attribution}`);
    }
    if (doc.content.aiDisclosure) {
      lines.push(`AI-Disclosure: ${doc.content.aiDisclosure}`);
    }
    if (doc.content.attribution || doc.content.aiDisclosure) {
      lines.push("");
    }
  }

  // Compliance
  if (doc.compliance) {
    if (doc.compliance.audit) {
      lines.push(`Audit: ${doc.compliance.audit}`);
    }
    if (doc.compliance.auditFormat) {
      lines.push(`Audit-Format: ${sanitizeValue(doc.compliance.auditFormat)}`);
    }
    if (doc.compliance.audit || doc.compliance.auditFormat) {
      lines.push("");
    }
  }

  // Metadata
  if (doc.metadata) {
    for (const [key, value] of Object.entries(doc.metadata)) {
      lines.push(`${key}: ${sanitizeValue(value)}`);
    }
  }

  return lines.join("\n") + "\n";
}
