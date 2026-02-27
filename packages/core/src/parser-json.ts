import type { ParseResult } from "./types.js";
import { AiTxtDocumentSchema } from "./schema.js";

/**
 * Parse an ai.json string into a validated AiTxtDocument.
 */
const MAX_INPUT_SIZE = 1_048_576; // 1 MB

export function parseJSON(input: string): ParseResult {
  if (input.length > MAX_INPUT_SIZE) {
    return { success: false, errors: [{ message: `Input too large (${input.length} bytes). Maximum is ${MAX_INPUT_SIZE} bytes.` }], warnings: [] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch (err) {
    return {
      success: false,
      errors: [{ message: `Invalid JSON: ${err instanceof Error ? err.message : "parse error"}` }],
      warnings: [],
    };
  }

  const result = AiTxtDocumentSchema.safeParse(raw);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
      warnings: [],
    };
  }

  // Normalize agent names to lowercase (spec requires case-insensitive matching)
  const doc = result.data;
  if (doc.agents) {
    const normalized: typeof doc.agents = {};
    for (const [name, policy] of Object.entries(doc.agents)) {
      normalized[name === "*" ? "*" : name.toLowerCase()] = policy;
    }
    doc.agents = normalized;
  }

  return {
    success: true,
    document: doc,
    errors: [],
    warnings: [],
  };
}
