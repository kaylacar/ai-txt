import { describe, it, expect } from "vitest";
import { resolve, canAccess, matchPath, globMatch } from "../src/resolver.js";
import type { AiTxtDocument } from "../src/types.js";

const BASE_DOC: AiTxtDocument = {
  specVersion: "1.0",
  site: { name: "Test", url: "https://test.com" },
  policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
  agents: {
    "*": { rateLimit: { requests: 60, window: "minute" } },
    ClaudeBot: { training: "allow", rateLimit: { requests: 200, window: "minute" } },
    GPTBot: { training: "deny", scraping: "deny" },
  },
};

// ── resolve ──

describe("resolve", () => {
  it("resolves named agent with overrides", () => {
    const policy = resolve(BASE_DOC, "ClaudeBot");
    expect(policy.training).toBe("allow");       // agent override
    expect(policy.scraping).toBe("allow");        // falls through to site-wide
    expect(policy.indexing).toBe("allow");
    expect(policy.caching).toBe("allow");
    expect(policy.rateLimit).toEqual({ requests: 200, window: "minute" }); // agent rate limit
  });

  it("resolves GPTBot with deny overrides", () => {
    const policy = resolve(BASE_DOC, "GPTBot");
    expect(policy.training).toBe("deny");         // agent override
    expect(policy.scraping).toBe("deny");          // agent override
    expect(policy.indexing).toBe("allow");          // site-wide
    expect(policy.rateLimit).toEqual({ requests: 60, window: "minute" }); // wildcard rate limit
  });

  it("resolves unknown agent via wildcard then site-wide", () => {
    const policy = resolve(BASE_DOC, "SomeNewBot");
    expect(policy.training).toBe("deny");          // site-wide (wildcard has no training)
    expect(policy.scraping).toBe("allow");
    expect(policy.rateLimit).toEqual({ requests: 60, window: "minute" }); // wildcard
  });

  it("resolves when no wildcard exists", () => {
    const doc: AiTxtDocument = {
      ...BASE_DOC,
      agents: { ClaudeBot: { training: "allow" } },
    };
    const policy = resolve(doc, "UnknownBot");
    expect(policy.training).toBe("deny");          // site-wide
    expect(policy.rateLimit).toBeUndefined();       // no wildcard, no agent
  });

  it("passes through content requirements", () => {
    const doc: AiTxtDocument = {
      ...BASE_DOC,
      content: { attribution: "required", aiDisclosure: "recommended" },
    };
    const policy = resolve(doc, "ClaudeBot");
    expect(policy.content).toEqual({ attribution: "required", aiDisclosure: "recommended" });
  });

  it("no content requirements when none defined", () => {
    const policy = resolve(BASE_DOC, "ClaudeBot");
    expect(policy.content).toBeUndefined();
  });
});

// ── canAccess ──

describe("canAccess", () => {
  it("returns allowed for allow policy", () => {
    const result = canAccess(BASE_DOC, "ClaudeBot", "training");
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("allowed");
  });

  it("returns denied for deny policy", () => {
    const result = canAccess(BASE_DOC, "GPTBot", "training");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("denied");
  });

  it("returns denied for deny scraping override", () => {
    const result = canAccess(BASE_DOC, "GPTBot", "scraping");
    expect(result.allowed).toBe(false);
  });

  it("handles conditional training with matching allow path", () => {
    const doc: AiTxtDocument = {
      ...BASE_DOC,
      policies: { ...BASE_DOC.policies, training: "conditional" },
      trainingPaths: { allow: ["/blog/*"], deny: ["/blog/premium/*"] },
      agents: { "*": {} },
    };
    const result = canAccess(doc, "SomeBot", "training", "/blog/post-1");
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("/blog/*");
  });

  it("handles conditional training with matching deny path", () => {
    const doc: AiTxtDocument = {
      ...BASE_DOC,
      policies: { ...BASE_DOC.policies, training: "conditional" },
      trainingPaths: { allow: ["/blog/*"], deny: ["/blog/premium/*"] },
      agents: { "*": {} },
    };
    const result = canAccess(doc, "SomeBot", "training", "/blog/premium/article");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("deny");
  });

  it("deny takes precedence over allow in conditional paths", () => {
    const doc: AiTxtDocument = {
      ...BASE_DOC,
      policies: { ...BASE_DOC.policies, training: "conditional" },
      trainingPaths: { allow: ["/content/**"], deny: ["/content/private/**"] },
      agents: { "*": {} },
    };
    // This path matches both allow and deny — deny wins
    const result = canAccess(doc, "SomeBot", "training", "/content/private/secret");
    expect(result.allowed).toBe(false);
  });

  it("returns denied for conditional training with no path provided", () => {
    const doc: AiTxtDocument = {
      ...BASE_DOC,
      policies: { ...BASE_DOC.policies, training: "conditional" },
      trainingPaths: { allow: ["/blog/*"], deny: [] },
      agents: { "*": {} },
    };
    const result = canAccess(doc, "SomeBot", "training");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("no path");
  });

  it("returns denied for conditional training with no trainingPaths defined", () => {
    const doc: AiTxtDocument = {
      ...BASE_DOC,
      policies: { ...BASE_DOC.policies, training: "conditional" },
      agents: { "*": {} },
    };
    const result = canAccess(doc, "SomeBot", "training", "/blog/post-1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("no trainingPaths");
  });

  it("returns denied for conditional non-training field", () => {
    const doc: AiTxtDocument = {
      ...BASE_DOC,
      policies: { ...BASE_DOC.policies, scraping: "conditional" },
      agents: { "*": {} },
    };
    const result = canAccess(doc, "SomeBot", "scraping", "/some/path");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("only apply to training");
  });

  it("unmatched path defaults to deny", () => {
    const doc: AiTxtDocument = {
      ...BASE_DOC,
      policies: { ...BASE_DOC.policies, training: "conditional" },
      trainingPaths: { allow: ["/blog/*"], deny: [] },
      agents: { "*": {} },
    };
    const result = canAccess(doc, "SomeBot", "training", "/private/data");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("does not match");
  });
});

// ── globMatch ──

describe("globMatch", () => {
  it("matches exact path", () => {
    expect(globMatch("/blog/post-1", "/blog/post-1")).toBe(true);
  });

  it("does not match different path", () => {
    expect(globMatch("/blog/post-1", "/blog/post-2")).toBe(false);
  });

  it("* matches single segment", () => {
    expect(globMatch("/blog/post-1", "/blog/*")).toBe(true);
    expect(globMatch("/blog/anything", "/blog/*")).toBe(true);
  });

  it("* does not cross path separators", () => {
    expect(globMatch("/blog/2024/post-1", "/blog/*")).toBe(false);
  });

  it("** matches across path separators", () => {
    expect(globMatch("/blog/2024/post-1", "/blog/**")).toBe(true);
    expect(globMatch("/blog/a/b/c/d", "/blog/**")).toBe(true);
  });

  it("** matches single segment too", () => {
    expect(globMatch("/blog/post-1", "/blog/**")).toBe(true);
  });

  it("pattern with extension", () => {
    expect(globMatch("/public/index.html", "/public/*.html")).toBe(true);
    expect(globMatch("/public/style.css", "/public/*.html")).toBe(false);
  });

  it("complex pattern", () => {
    expect(globMatch("/api/v2/users/123", "/api/*/users/*")).toBe(true);
    expect(globMatch("/api/v2/deep/users/123", "/api/*/users/*")).toBe(false);
  });

  it("** in middle of pattern", () => {
    expect(globMatch("/a/b/c/d/e", "/a/**/e")).toBe(true);
    expect(globMatch("/a/e", "/a/**/e")).toBe(true);
  });

  it("escapes regex special characters", () => {
    expect(globMatch("/file.txt", "/file.txt")).toBe(true);
    expect(globMatch("/filextxt", "/file.txt")).toBe(false);  // . is literal, not regex any
  });
});

// ── matchPath ──

describe("matchPath", () => {
  it("allows path matching allow pattern", () => {
    const result = matchPath("/blog/post-1", ["/blog/*"], []);
    expect(result.allowed).toBe(true);
  });

  it("denies path matching deny pattern", () => {
    const result = matchPath("/private/data", [], ["/private/*"]);
    expect(result.allowed).toBe(false);
  });

  it("deny takes precedence over allow", () => {
    const result = matchPath("/blog/premium/post", ["/blog/**"], ["/blog/premium/**"]);
    expect(result.allowed).toBe(false);
  });

  it("denies unmatched path", () => {
    const result = matchPath("/unknown/path", ["/blog/*"], ["/private/*"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("does not match");
  });
});
