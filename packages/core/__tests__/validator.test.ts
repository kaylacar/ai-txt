import { describe, it, expect } from "vitest";
import { validate, validateText, validateJSON } from "../src/validator.js";
import type { AiTxtDocument } from "../src/types.js";

const VALID_DOC: AiTxtDocument = {
  specVersion: "1.0",
  site: { name: "Test", url: "https://test.com" },
  policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
  agents: { "*": {} },
};

describe("validate", () => {
  it("validates a correct document", () => {
    const result = validate(VALID_DOC);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("warns when training is conditional but no paths defined", () => {
    const doc: AiTxtDocument = {
      ...VALID_DOC,
      policies: { ...VALID_DOC.policies, training: "conditional" },
    };
    const result = validate(doc);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === "MISSING_TRAINING_PATHS")).toBe(true);
  });

  it("warns when training is allow but no license", () => {
    const doc: AiTxtDocument = {
      ...VALID_DOC,
      policies: { ...VALID_DOC.policies, training: "allow" },
    };
    const result = validate(doc);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === "MISSING_LICENSE")).toBe(true);
  });

  it("no license warning when training is allow with license", () => {
    const doc: AiTxtDocument = {
      ...VALID_DOC,
      policies: { ...VALID_DOC.policies, training: "allow" },
      licensing: { license: "CC-BY-4.0" },
    };
    const result = validate(doc);
    expect(result.warnings.some((w) => w.code === "MISSING_LICENSE")).toBe(false);
  });

  it("warns on insecure site URL", () => {
    const doc: AiTxtDocument = {
      ...VALID_DOC,
      site: { ...VALID_DOC.site, url: "http://test.com" },
    };
    const result = validate(doc);
    expect(result.warnings.some((w) => w.code === "INSECURE_URL")).toBe(true);
  });

  it("warns when agent uses conditional policy", () => {
    const doc: AiTxtDocument = {
      ...VALID_DOC,
      agents: { "*": { training: "conditional" } },
    };
    const result = validate(doc);
    expect(result.warnings.some((w) => w.code === "AGENT_CONDITIONAL_POLICY")).toBe(true);
  });

  it("no conditional warning for allow/deny agent policies", () => {
    const doc: AiTxtDocument = {
      ...VALID_DOC,
      agents: { "*": { training: "allow" }, "bot": { training: "deny" } },
    };
    const result = validate(doc);
    expect(result.warnings.some((w) => w.code === "AGENT_CONDITIONAL_POLICY")).toBe(false);
  });

  it("no warnings for conditional training with paths defined", () => {
    const doc: AiTxtDocument = {
      ...VALID_DOC,
      policies: { ...VALID_DOC.policies, training: "conditional" },
      trainingPaths: { allow: ["/public/*"], deny: [] },
    };
    const result = validate(doc);
    expect(result.warnings.some((w) => w.code === "MISSING_TRAINING_PATHS")).toBe(false);
  });
});

describe("validateText", () => {
  it("validates valid text", () => {
    const result = validateText("Site-Name: Test\nSite-URL: https://test.com\n");
    expect(result.valid).toBe(true);
  });

  it("reports parse errors", () => {
    const result = validateText("");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "PARSE_ERROR")).toBe(true);
  });
});

describe("validateJSON", () => {
  it("validates valid JSON", () => {
    const json = JSON.stringify({
      specVersion: "1.0",
      site: { name: "Test", url: "https://test.com" },
      policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
      agents: { "*": {} },
    });
    const result = validateJSON(json);
    expect(result.valid).toBe(true);
  });

  it("reports JSON parse errors", () => {
    const result = validateJSON("not json");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "PARSE_ERROR")).toBe(true);
  });

  it("reports schema violations", () => {
    const result = validateJSON(JSON.stringify({ specVersion: "bad" }));
    expect(result.valid).toBe(false);
  });
});
