import { describe, it, expect } from "vitest";
import { generate } from "../src/generator.js";
import { generateJSON } from "../src/generator-json.js";
import { parse } from "../src/parser.js";
import { parseJSON } from "../src/parser-json.js";
import type { AiTxtDocument } from "../src/types.js";

const TEST_DOC: AiTxtDocument = {
  specVersion: "1.0",
  site: {
    name: "Roundtrip Test",
    url: "https://roundtrip.com",
    description: "Testing roundtrip",
    contact: "test@roundtrip.com",
    policyUrl: "https://roundtrip.com/ai-policy",
  },
  policies: {
    training: "conditional",
    scraping: "allow",
    indexing: "allow",
    caching: "deny",
  },
  trainingPaths: {
    allow: ["/public/*"],
    deny: ["/premium/*"],
  },
  licensing: {
    license: "CC-BY-4.0",
    feeUrl: "https://roundtrip.com/license",
  },
  agents: {
    "*": { rateLimit: { requests: 60, window: "minute" } },
    "claudebot": { training: "allow", rateLimit: { requests: 200, window: "minute" } },
  },
  content: {
    attribution: "required",
    aiDisclosure: "recommended",
  },
  compliance: {
    audit: "optional",
    auditFormat: "rer-artifact/0.1",
  },
};

describe("roundtrip: generate -> parse", () => {
  it("text roundtrip preserves site info", () => {
    const text = generate(TEST_DOC);
    const result = parse(text);
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe(TEST_DOC.site.name);
    expect(result.document?.site.url).toBe(TEST_DOC.site.url);
    expect(result.document?.site.description).toBe(TEST_DOC.site.description);
    expect(result.document?.site.contact).toBe(TEST_DOC.site.contact);
    expect(result.document?.site.policyUrl).toBe(TEST_DOC.site.policyUrl);
  });

  it("text roundtrip preserves policies", () => {
    const text = generate(TEST_DOC);
    const result = parse(text);
    expect(result.document?.policies).toEqual(TEST_DOC.policies);
  });

  it("text roundtrip preserves training paths", () => {
    const text = generate(TEST_DOC);
    const result = parse(text);
    expect(result.document?.trainingPaths).toEqual(TEST_DOC.trainingPaths);
  });

  it("text roundtrip preserves licensing", () => {
    const text = generate(TEST_DOC);
    const result = parse(text);
    expect(result.document?.licensing).toEqual(TEST_DOC.licensing);
  });

  it("text roundtrip preserves agent policies", () => {
    const text = generate(TEST_DOC);
    const result = parse(text);
    expect(result.document?.agents["*"]).toEqual(TEST_DOC.agents["*"]);
    expect(result.document?.agents["claudebot"]).toEqual(TEST_DOC.agents["claudebot"]);
  });

  it("text roundtrip preserves content requirements", () => {
    const text = generate(TEST_DOC);
    const result = parse(text);
    expect(result.document?.content).toEqual(TEST_DOC.content);
  });

  it("text roundtrip preserves compliance", () => {
    const text = generate(TEST_DOC);
    const result = parse(text);
    expect(result.document?.compliance).toEqual(TEST_DOC.compliance);
  });

  it("JSON roundtrip produces identical document", () => {
    const json = generateJSON(TEST_DOC);
    const result = parseJSON(json);
    expect(result.success).toBe(true);
    expect(result.document).toEqual(TEST_DOC);
  });
});
