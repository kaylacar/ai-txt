import { describe, it, expect } from "vitest";
import { parse } from "../src/parser.js";

const MINIMAL_DOC = `
Site-Name: My Blog
Site-URL: https://myblog.com
`;

const FULL_DOC = `# ai.txt — AI Policy Declaration
Spec-Version: 1.0
Generated-At: 2026-02-21T00:00:00.000Z

Site-Name: News Daily
Site-URL: https://newsdaily.com
Description: Breaking news and analysis
Contact: ai@newsdaily.com
Policy-URL: https://newsdaily.com/ai-policy

Training: conditional
Scraping: allow
Indexing: allow
Caching: allow

Training-Allow: /articles/free/*
Training-Deny: /articles/premium/*
Training-Deny: /private/*

Training-License: CC-BY-4.0
Training-Fee: https://newsdaily.com/ai-licensing

Agent: *
  Rate-Limit: 30/minute
Agent: ClaudeBot
  Training: allow
  Rate-Limit: 120/minute
Agent: GPTBot
  Training: deny
  Scraping: deny

Attribution: required
AI-Disclosure: required

Audit: optional
Audit-Format: rer-artifact/0.1

AI-JSON: https://newsdaily.com/.well-known/ai.json
Agents-TXT: https://newsdaily.com/.well-known/agents.txt
`;

describe("parse", () => {
  it("parses minimal document", () => {
    const result = parse(MINIMAL_DOC);
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("My Blog");
    expect(result.document?.site.url).toBe("https://myblog.com");
  });

  it("uses defaults for minimal document", () => {
    const result = parse(MINIMAL_DOC);
    const doc = result.document!;
    expect(doc.policies.training).toBe("deny");
    expect(doc.policies.scraping).toBe("allow");
    expect(doc.policies.indexing).toBe("allow");
    expect(doc.policies.caching).toBe("allow");
    expect(doc.agents["*"]).toEqual({});
  });

  it("parses full document", () => {
    const result = parse(FULL_DOC);
    expect(result.success).toBe(true);
    const doc = result.document!;

    expect(doc.specVersion).toBe("1.0");
    expect(doc.generatedAt).toBe("2026-02-21T00:00:00.000Z");
    expect(doc.site.name).toBe("News Daily");
    expect(doc.site.description).toBe("Breaking news and analysis");
    expect(doc.site.contact).toBe("ai@newsdaily.com");
    expect(doc.site.policyUrl).toBe("https://newsdaily.com/ai-policy");
  });

  it("parses content policies", () => {
    const result = parse(FULL_DOC);
    const policies = result.document!.policies;
    expect(policies.training).toBe("conditional");
    expect(policies.scraping).toBe("allow");
    expect(policies.indexing).toBe("allow");
    expect(policies.caching).toBe("allow");
  });

  it("parses training paths", () => {
    const result = parse(FULL_DOC);
    const tp = result.document!.trainingPaths!;
    expect(tp.allow).toEqual(["/articles/free/*"]);
    expect(tp.deny).toEqual(["/articles/premium/*", "/private/*"]);
  });

  it("parses licensing", () => {
    const result = parse(FULL_DOC);
    const lic = result.document!.licensing!;
    expect(lic.license).toBe("CC-BY-4.0");
    expect(lic.feeUrl).toBe("https://newsdaily.com/ai-licensing");
  });

  it("parses agent policies (names normalized to lowercase)", () => {
    const result = parse(FULL_DOC);
    const agents = result.document!.agents;
    expect(agents["*"].rateLimit?.requests).toBe(30);
    expect(agents["*"].rateLimit?.window).toBe("minute");
    expect(agents["claudebot"].training).toBe("allow");
    expect(agents["claudebot"].rateLimit?.requests).toBe(120);
    expect(agents["gptbot"].training).toBe("deny");
    expect(agents["gptbot"].scraping).toBe("deny");
  });

  it("parses content requirements", () => {
    const result = parse(FULL_DOC);
    expect(result.document!.content?.attribution).toBe("required");
    expect(result.document!.content?.aiDisclosure).toBe("required");
  });

  it("parses compliance config", () => {
    const result = parse(FULL_DOC);
    expect(result.document!.compliance?.audit).toBe("optional");
    expect(result.document!.compliance?.auditFormat).toBe("rer-artifact/0.1");
  });

  it("parses metadata and cross-references", () => {
    const result = parse(FULL_DOC);
    expect(result.document!.metadata?.["AI-JSON"]).toBe("https://newsdaily.com/.well-known/ai.json");
    expect(result.document!.metadata?.["Agents-TXT"]).toBe("https://newsdaily.com/.well-known/agents.txt");
  });

  it("fails on missing Site-Name", () => {
    const result = parse("Site-URL: https://example.com\n");
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Site-Name"))).toBe(true);
  });

  it("fails on missing Site-URL", () => {
    const result = parse("Site-Name: Test\n");
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Site-URL"))).toBe(true);
  });

  it("handles empty input", () => {
    const result = parse("");
    expect(result.success).toBe(false);
  });

  it("ignores comment lines", () => {
    const result = parse("# Comment\nSite-Name: Test\nSite-URL: https://test.com\n");
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("Test");
  });

  it("warns on invalid policy values", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Training: invalid
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Invalid policy value"))).toBe(true);
  });

  it("warns on invalid requirement levels", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Attribution: maybe
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Invalid requirement level"))).toBe(true);
  });

  it("accepts Site-Description and Site-Contact aliases", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Site-Description: A test site
Site-Contact: test@test.com
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.document!.site.description).toBe("A test site");
    expect(result.document!.site.contact).toBe("test@test.com");
  });

  it("warns on orphan indented lines", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
  Orphan-Field: value
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Indented line outside of a block"))).toBe(true);
  });

  it("warns on empty agent name", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent:
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Agent name must not be empty"))).toBe(true);
  });

  it("warns on zero rate limit", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent: testbot
  Rate-Limit: 0/minute
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Invalid rate limit"))).toBe(true);
  });

  it("parses all agent policy overrides", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent: mybot
  Training: allow
  Scraping: deny
  Indexing: deny
  Caching: allow
  Rate-Limit: 100/hour
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    const agent = result.document!.agents["mybot"];
    expect(agent.training).toBe("allow");
    expect(agent.scraping).toBe("deny");
    expect(agent.indexing).toBe("deny");
    expect(agent.caching).toBe("allow");
    expect(agent.rateLimit?.requests).toBe(100);
    expect(agent.rateLimit?.window).toBe("hour");
  });

  it("parses deny-all document", () => {
    const doc = `
Site-Name: Private Corp
Site-URL: https://privatecorp.com
Training: deny
Scraping: deny
Indexing: deny
Caching: deny
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    const p = result.document!.policies;
    expect(p.training).toBe("deny");
    expect(p.scraping).toBe("deny");
    expect(p.indexing).toBe("deny");
    expect(p.caching).toBe("deny");
  });

  // Case-insensitive parsing (spec requirement)
  it("parses keys case-insensitively", () => {
    const doc = `
site-name: Lowercase Blog
site-url: https://lowercase.com
training: deny
scraping: allow
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.document!.site.name).toBe("Lowercase Blog");
    expect(result.document!.site.url).toBe("https://lowercase.com");
    expect(result.document!.policies.training).toBe("deny");
    expect(result.document!.policies.scraping).toBe("allow");
  });

  it("parses mixed-case keys", () => {
    const doc = `
SITE-NAME: Uppercase Blog
SITE-URL: https://uppercase.com
TRAINING: allow
training-license: MIT
ATTRIBUTION: required
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.document!.site.name).toBe("Uppercase Blog");
    expect(result.document!.policies.training).toBe("allow");
    expect(result.document!.licensing?.license).toBe("MIT");
    expect(result.document!.content?.attribution).toBe("required");
  });

  it("normalizes agent names to lowercase", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent: ClaudeBot
  Training: allow
Agent: GPTBot
  Training: deny
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.document!.agents["claudebot"]?.training).toBe("allow");
    expect(result.document!.agents["gptbot"]?.training).toBe("deny");
    // Original case should not exist
    expect(result.document!.agents["ClaudeBot"]).toBeUndefined();
    expect(result.document!.agents["GPTBot"]).toBeUndefined();
  });

  it("parses agent block fields case-insensitively", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
agent: mybot
  training: allow
  scraping: deny
  rate-limit: 50/minute
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    const agent = result.document!.agents["mybot"];
    expect(agent.training).toBe("allow");
    expect(agent.scraping).toBe("deny");
    expect(agent.rateLimit?.requests).toBe(50);
  });

  // ── Edge cases ──

  it("handles CRLF line endings", () => {
    const doc = "Site-Name: Test\r\nSite-URL: https://test.com\r\nTraining: deny\r\n";
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("Test");
    expect(result.document?.policies.training).toBe("deny");
  });

  it("handles tab-indented agent blocks", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent: tabbot
\tTraining: allow
\tRate-Limit: 50/minute
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    const agent = result.document!.agents["tabbot"];
    expect(agent.training).toBe("allow");
    expect(agent.rateLimit?.requests).toBe(50);
  });

  it("warns on unparseable top-level lines (no colon)", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
this line has no colon
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Unparseable line"))).toBe(true);
  });

  it("warns on unparseable indented lines in agent blocks", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent: mybot
  no colon here either
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Unparseable indented line"))).toBe(true);
  });

  it("warns on unknown agent fields", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent: mybot
  Custom-Field: value
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Unknown agent field"))).toBe(true);
  });

  it("last definition wins for duplicate keys", () => {
    const doc = `
Site-Name: First
Site-URL: https://first.com
Site-Name: Second
Site-URL: https://second.com
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("Second");
    expect(result.document?.site.url).toBe("https://second.com");
  });

  it("second agent block with same name overwrites first", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent: mybot
  Training: allow
Agent: MyBot
  Training: deny
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    // Both normalize to "mybot", second wins
    expect(result.document!.agents["mybot"].training).toBe("deny");
  });

  it("stores generic unknown keys as metadata", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Custom-Header: my-value
X-Extra: another-value
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.document?.metadata?.["Custom-Header"]).toBe("my-value");
    expect(result.document?.metadata?.["X-Extra"]).toBe("another-value");
  });

  it("parses Spec-Version from comment lines (legacy format)", () => {
    const doc = `
# Spec-Version: 2.0
# Generated-At: 2026-01-01T00:00:00.000Z
Site-Name: Test
Site-URL: https://test.com
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.document?.specVersion).toBe("2.0");
    expect(result.document?.generatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("warns on invalid rate limit formats", () => {
    const cases = ["abc/minute", "60/weekly", "noslash", "/minute", "60/"];
    for (const rl of cases) {
      const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent: bot
  Rate-Limit: ${rl}
`;
      const result = parse(doc);
      expect(result.success).toBe(true);
      expect(result.warnings.some((w) => w.message.includes("Invalid rate limit"))).toBe(true);
    }
  });

  it("warns on invalid agent policy values", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent: mybot
  Training: maybe
  Scraping: perhaps
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.filter((w) => w.message.includes("Invalid policy value")).length).toBe(2);
  });

  it("handles values containing colons", () => {
    const doc = `
Site-Name: My Site: The Best
Site-URL: https://test.com
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("My Site: The Best");
  });

  it("trims whitespace from values", () => {
    const doc = `
Site-Name:   Spacey Name
Site-URL:   https://test.com
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("Spacey Name");
    expect(result.document?.site.url).toBe("https://test.com");
  });

  // ── New behavior tests ──

  it("warns on duplicate Agent blocks", () => {
    const doc = `
Site-Name: Test
Site-URL: https://test.com
Agent: MyBot
  Training: allow
Agent: mybot
  Training: deny
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Duplicate Agent block"))).toBe(true);
    // Second block should win
    expect(result.document!.agents["mybot"].training).toBe("deny");
  });

  it("rejects input exceeding size limit", () => {
    const huge = `Site-Name: Test\nSite-URL: https://test.com\n` + "X: ".padEnd(1_100_000, "a");
    const result = parse(huge);
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("too large");
  });

  it("warns on comment-style Spec-Version", () => {
    const doc = `
# Spec-Version: 1.0
Site-Name: Test
Site-URL: https://test.com
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Spec-Version found in comment"))).toBe(true);
  });

  it("warns on comment-style Generated-At", () => {
    const doc = `
# Generated-At: 2026-01-01T00:00:00.000Z
Site-Name: Test
Site-URL: https://test.com
`;
    const result = parse(doc);
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Generated-At found in comment"))).toBe(true);
  });
});
