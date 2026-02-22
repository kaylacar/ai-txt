import type { ParseResult } from "./types.js";
import { AiTxtDocumentSchema } from "./schema.js";

/**
 * Parse an ai.json string into a validated AiTxtDocument.
 */
export function parseJSON(input: string): ParseResult {
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

  return {
    success: true,
    document: result.data,
    errors: [],
    warnings: [],
  };
}
