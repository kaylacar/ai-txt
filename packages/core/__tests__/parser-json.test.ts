import { describe, it, expect } from "vitest";
import { parseJSON } from "../src/parser-json.js";

const VALID_DOC = {
  specVersion: "1.0",
  site: { name: "Test", url: "https://test.com" },
  policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
  agents: { "*": {} },
};

describe("parseJSON", () => {
  it("parses a valid JSON document", () => {
    const result = parseJSON(JSON.stringify(VALID_DOC));
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("Test");
    expect(result.document?.policies.training).toBe("deny");
  });

  it("returns all required fields from a full document", () => {
    const full = {
      ...VALID_DOC,
      generatedAt: "2026-02-21T00:00:00.000Z",
      site: { ...VALID_DOC.site, description: "A test", contact: "test@test.com" },
      trainingPaths: { allow: ["/public/*"], deny: ["/private/*"] },
      licensing: { license: "CC-BY-4.0" },
      content: { attribution: "required" },
      compliance: { audit: "optional", auditFormat: "rer-artifact/0.1" },
    };
    const result = parseJSON(JSON.stringify(full));
    expect(result.success).toBe(true);
    expect(result.document?.trainingPaths?.allow).toEqual(["/public/*"]);
    expect(result.document?.licensing?.license).toBe("CC-BY-4.0");
    expect(result.document?.content?.attribution).toBe("required");
    expect(result.document?.compliance?.auditFormat).toBe("rer-artifact/0.1");
  });

  it("fails on invalid JSON syntax", () => {
    const result = parseJSON("not json {{{");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("Invalid JSON");
  });

  it("fails on missing required fields", () => {
    const result = parseJSON(JSON.stringify({ specVersion: "1.0" }));
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("fails on invalid specVersion format", () => {
    const doc = { ...VALID_DOC, specVersion: "abc" };
    const result = parseJSON(JSON.stringify(doc));
    expect(result.success).toBe(false);
  });

  it("fails on invalid policy values", () => {
    const doc = { ...VALID_DOC, policies: { ...VALID_DOC.policies, training: "banana" } };
    const result = parseJSON(JSON.stringify(doc));
    expect(result.success).toBe(false);
  });

  it("normalizes agent names to lowercase", () => {
    const doc = { ...VALID_DOC, agents: { ClaudeBot: { training: "allow" } } };
    const result = parseJSON(JSON.stringify(doc));
    expect(result.success).toBe(true);
    expect(result.document?.agents["claudebot"]).toBeDefined();
    expect(result.document?.agents["ClaudeBot"]).toBeUndefined();
  });

  it("preserves wildcard agent name", () => {
    const doc = { ...VALID_DOC, agents: { "*": { training: "deny" } } };
    const result = parseJSON(JSON.stringify(doc));
    expect(result.success).toBe(true);
    expect(result.document?.agents["*"]?.training).toBe("deny");
  });

  it("rejects input exceeding size limit", () => {
    const huge = JSON.stringify({ ...VALID_DOC, metadata: { data: "x".repeat(1_100_000) } });
    const result = parseJSON(huge);
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("too large");
  });

  it("fails on empty string", () => {
    const result = parseJSON("");
    expect(result.success).toBe(false);
  });

  it("fails on array instead of object", () => {
    const result = parseJSON("[1, 2, 3]");
    expect(result.success).toBe(false);
  });
});
