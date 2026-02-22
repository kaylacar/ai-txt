import { describe, it, expect } from "vitest";
import { generate } from "../src/generator.js";
import type { AiTxtDocument } from "../src/types.js";

const TEST_DOC: AiTxtDocument = {
  specVersion: "1.0",
  generatedAt: "2026-02-21T00:00:00.000Z",
  site: {
    name: "Test Blog",
    url: "https://testblog.com",
    description: "A test blog",
    contact: "ai@testblog.com",
    policyUrl: "https://testblog.com/ai-policy",
  },
  policies: {
    training: "conditional",
    scraping: "allow",
    indexing: "allow",
    caching: "allow",
  },
  trainingPaths: {
    allow: ["/blog/public/*"],
    deny: ["/blog/premium/*"],
  },
  licensing: {
    license: "CC-BY-4.0",
    feeUrl: "https://testblog.com/licensing",
  },
  agents: {
    "*": { rateLimit: { requests: 60, window: "minute" } },
    "ClaudeBot": { training: "allow", rateLimit: { requests: 200, window: "minute" } },
    "GPTBot": { training: "deny", scraping: "deny" },
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

describe("generate", () => {
  it("generates header", () => {
    const output = generate(TEST_DOC);
    expect(output).toContain("# ai.txt");
    expect(output).toContain("Spec-Version: 1.0");
    expect(output).toContain("Generated-At: 2026-02-21T00:00:00.000Z");
  });

  it("generates site info", () => {
    const output = generate(TEST_DOC);
    expect(output).toContain("Site-Name: Test Blog");
    expect(output).toContain("Site-URL: https://testblog.com");
    expect(output).toContain("Description: A test blog");
    expect(output).toContain("Contact: ai@testblog.com");
    expect(output).toContain("Policy-URL: https://testblog.com/ai-policy");
  });

  it("generates content policies", () => {
    const output = generate(TEST_DOC);
    expect(output).toContain("Training: conditional");
    expect(output).toContain("Scraping: allow");
    expect(output).toContain("Indexing: allow");
    expect(output).toContain("Caching: allow");
  });

  it("generates training paths", () => {
    const output = generate(TEST_DOC);
    expect(output).toContain("Training-Allow: /blog/public/*");
    expect(output).toContain("Training-Deny: /blog/premium/*");
  });

  it("generates licensing", () => {
    const output = generate(TEST_DOC);
    expect(output).toContain("Training-License: CC-BY-4.0");
    expect(output).toContain("Training-Fee: https://testblog.com/licensing");
  });

  it("generates agent blocks", () => {
    const output = generate(TEST_DOC);
    expect(output).toContain("Agent: *");
    expect(output).toContain("  Rate-Limit: 60/minute");
    expect(output).toContain("Agent: ClaudeBot");
    expect(output).toContain("  Training: allow");
    expect(output).toContain("  Rate-Limit: 200/minute");
    expect(output).toContain("Agent: GPTBot");
    expect(output).toContain("  Training: deny");
    expect(output).toContain("  Scraping: deny");
  });

  it("generates content requirements", () => {
    const output = generate(TEST_DOC);
    expect(output).toContain("Attribution: required");
    expect(output).toContain("AI-Disclosure: recommended");
  });

  it("generates compliance", () => {
    const output = generate(TEST_DOC);
    expect(output).toContain("Audit: optional");
    expect(output).toContain("Audit-Format: rer-artifact/0.1");
  });

  it("generates minimal document", () => {
    const minimal: AiTxtDocument = {
      specVersion: "1.0",
      site: { name: "Simple", url: "https://simple.com" },
      policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
      agents: { "*": {} },
    };
    const output = generate(minimal);
    expect(output).toContain("Site-Name: Simple");
    expect(output).toContain("Training: deny");
    expect(output).not.toContain("Training-License");
    expect(output).not.toContain("Attribution");
  });

  it("ends with newline", () => {
    const output = generate(TEST_DOC);
    expect(output.endsWith("\n")).toBe(true);
  });
});
