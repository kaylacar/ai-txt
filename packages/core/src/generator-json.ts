import type { AiTxtDocument } from "./types.js";

/**
 * Generate ai.json from a document object.
 */
export function generateJSON(doc: AiTxtDocument): string {
  return JSON.stringify(doc, null, 2);
}
