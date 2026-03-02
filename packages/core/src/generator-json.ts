import type { AiTxtDocument } from "./types.js";
import { AiTxtDocumentSchema } from "./schema.js";

/**
 * Generate ai.json from a document object.
 * Validates the document against the schema before serialization.
 * Throws if the document is invalid.
 */
export function generateJSON(doc: AiTxtDocument): string {
  const result = AiTxtDocumentSchema.safeParse(doc);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid AiTxtDocument: ${issues}`);
  }
  return JSON.stringify(result.data, null, 2);
}
