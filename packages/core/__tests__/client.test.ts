import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AiTxtClient } from "../src/client.js";

const VALID_JSON = JSON.stringify({
  specVersion: "1.0",
  site: { name: "Test", url: "https://test.com" },
  policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
  agents: { "*": {} },
});

const VALID_TEXT = `Spec-Version: 1.0
Site-Name: Test
Site-URL: https://test.com
Training: deny
`;

function mockFetch(responses: Record<string, { status: number; body: string; headers?: Record<string, string> }>) {
  return vi.fn(async (url: string) => {
    const resp = responses[url];
    if (!resp) return { ok: false, status: 404, url, text: async () => "", headers: new Headers() };
    return {
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      url,
      text: async () => resp.body,
      headers: new Headers(resp.headers ?? {}),
    };
  });
}

describe("AiTxtClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("discovers ai.json first, falls back to ai.txt", async () => {
    globalThis.fetch = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 404, body: "" },
      "https://test.com/.well-known/ai.txt": { status: 200, body: VALID_TEXT },
    }) as any;

    const client = new AiTxtClient();
    const result = await client.discover("https://test.com");
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("Test");
  });

  it("prefers ai.json when available", async () => {
    globalThis.fetch = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: VALID_JSON },
    }) as any;

    const client = new AiTxtClient();
    const result = await client.discover("https://test.com");
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("Test");
    // Should only have fetched JSON, not text
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns success: false when no ai.txt found", async () => {
    globalThis.fetch = mockFetch({}) as any;

    const client = new AiTxtClient();
    const result = await client.discover("https://noaitxt.com");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("No ai.txt found");
  });

  it("caches results and avoids re-fetching", async () => {
    const fetchMock = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: VALID_JSON },
    }) as any;
    globalThis.fetch = fetchMock;

    const client = new AiTxtClient({ cacheTtl: 60_000 });

    const result1 = await client.discover("https://test.com");
    const result2 = await client.discover("https://test.com");

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    // Only one fetch — second call served from cache
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after cache expires", async () => {
    const fetchMock = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: VALID_JSON },
    }) as any;
    globalThis.fetch = fetchMock;

    const client = new AiTxtClient({ cacheTtl: 1 }); // 1ms TTL

    await client.discover("https://test.com");
    await new Promise((r) => setTimeout(r, 10)); // wait for expiry
    await client.discover("https://test.com");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("disables cache when cacheTtl is 0", async () => {
    const fetchMock = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: VALID_JSON },
    }) as any;
    globalThis.fetch = fetchMock;

    const client = new AiTxtClient({ cacheTtl: 0 });

    await client.discover("https://test.com");
    await client.discover("https://test.com");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clearCache forces re-fetch", async () => {
    const fetchMock = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: VALID_JSON },
    }) as any;
    globalThis.fetch = fetchMock;

    const client = new AiTxtClient();

    await client.discover("https://test.com");
    client.clearCache();
    await client.discover("https://test.com");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends ETag with If-None-Match on revalidation", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];

    globalThis.fetch = vi.fn(async (url: string, init: any) => {
      calls.push({ url, headers: init?.headers ?? {} });

      if (calls.length === 1) {
        // First request — return 200 with ETag
        return {
          ok: true,
          status: 200,
          url,
          text: async () => VALID_JSON,
          headers: new Headers({ ETag: '"abc123"' }),
        };
      }

      // Second request — return 304 Not Modified
      return {
        ok: false,
        status: 304,
        url,
        text: async () => "",
        headers: new Headers(),
      };
    }) as any;

    const client = new AiTxtClient({ cacheTtl: 1 }); // 1ms so cache expires quickly

    await client.discover("https://test.com");
    await new Promise((r) => setTimeout(r, 10)); // expire cache
    const result = await client.discover("https://test.com");

    expect(result.success).toBe(true);
    // Second fetch should include If-None-Match
    expect(calls[1].headers["If-None-Match"]).toBe('"abc123"');
  });

  it("respects Cache-Control max-age from server", async () => {
    const fetchMock = mockFetch({
      "https://test.com/.well-known/ai.json": {
        status: 200,
        body: VALID_JSON,
        headers: { "Cache-Control": "max-age=600" },
      },
    }) as any;
    globalThis.fetch = fetchMock;

    const client = new AiTxtClient({ cacheTtl: 1 }); // client says 1ms, server says 600s

    await client.discover("https://test.com");
    await new Promise((r) => setTimeout(r, 10)); // would expire client TTL
    await client.discover("https://test.com");

    // Server max-age overrides client TTL — still cached
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("check() resolves policy for the agent", async () => {
    const json = JSON.stringify({
      specVersion: "1.0",
      site: { name: "Test", url: "https://test.com" },
      policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
      agents: { "*": {}, ClaudeBot: { training: "allow" } },
    });

    globalThis.fetch = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: json },
    }) as any;

    const client = new AiTxtClient({ userAgent: "ClaudeBot" });
    const { success, policy } = await client.check("https://test.com");

    expect(success).toBe(true);
    expect(policy?.training).toBe("allow"); // agent override
    expect(policy?.scraping).toBe("allow"); // site-wide
  });

  it("checkAccess() returns access result", async () => {
    globalThis.fetch = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: VALID_JSON },
    }) as any;

    const client = new AiTxtClient({ userAgent: "SomeBot" });
    const { success, access } = await client.checkAccess("https://test.com", "training");

    expect(success).toBe(true);
    expect(access?.allowed).toBe(false); // training: deny
  });

  it("strips trailing slashes from base URL", async () => {
    globalThis.fetch = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: VALID_JSON },
    }) as any;

    const client = new AiTxtClient();
    const result = await client.discover("https://test.com///");
    expect(result.success).toBe(true);
  });

  it("rejects non-HTTPS URLs", async () => {
    const client = new AiTxtClient();
    const result = await client.discover("http://insecure.com");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("HTTPS");
  });

  it("allows localhost over HTTP (for development)", async () => {
    globalThis.fetch = mockFetch({
      "http://localhost:3000/.well-known/ai.json": { status: 200, body: VALID_JSON },
    }) as any;

    const client = new AiTxtClient();
    const result = await client.discover("http://localhost:3000");
    expect(result.success).toBe(true);
  });

  // ── Network & error handling ──

  it("handles network errors gracefully", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Network error");
    }) as any;

    const client = new AiTxtClient();
    const result = await client.discover("https://test.com");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("No ai.txt found");
  });

  it("handles fetch timeout via AbortController", async () => {
    globalThis.fetch = vi.fn(async (_url: string, init: any) => {
      // Simulate a slow response that gets aborted
      return new Promise((_resolve, reject) => {
        const abortHandler = () => reject(new DOMException("Aborted", "AbortError"));
        if (init?.signal?.aborted) {
          abortHandler();
          return;
        }
        init?.signal?.addEventListener("abort", abortHandler);
      });
    }) as any;

    const client = new AiTxtClient({ timeout: 50 });
    const result = await client.discover("https://slow.com");
    expect(result.success).toBe(false);
  });

  // ── discoverJSON ──

  it("discoverJSON returns JSON document when available", async () => {
    globalThis.fetch = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: VALID_JSON },
    }) as any;

    const client = new AiTxtClient();
    const result = await client.discoverJSON("https://test.com");
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("Test");
  });

  it("discoverJSON returns failure when not found", async () => {
    globalThis.fetch = mockFetch({}) as any;

    const client = new AiTxtClient();
    const result = await client.discoverJSON("https://test.com");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("No ai.json found");
  });

  it("discoverJSON rejects non-HTTPS URLs", async () => {
    const client = new AiTxtClient();
    const result = await client.discoverJSON("http://insecure.com");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("HTTPS");
  });

  // ── Malformed responses ──

  it("falls back to ai.txt when ai.json has invalid JSON", async () => {
    globalThis.fetch = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: "not json at all" },
      "https://test.com/.well-known/ai.txt": { status: 200, body: VALID_TEXT },
    }) as any;

    const client = new AiTxtClient();
    const result = await client.discover("https://test.com");
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("Test");
  });

  it("returns failure when both formats are malformed", async () => {
    globalThis.fetch = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: "not json" },
      "https://test.com/.well-known/ai.txt": { status: 200, body: "no valid fields" },
    }) as any;

    const client = new AiTxtClient();
    const result = await client.discover("https://test.com");
    expect(result.success).toBe(false);
  });

  // ── check/checkAccess error paths ──

  it("check() returns failure when discovery fails", async () => {
    globalThis.fetch = mockFetch({}) as any;

    const client = new AiTxtClient();
    const { success, policy, errors } = await client.check("https://test.com");
    expect(success).toBe(false);
    expect(policy).toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
  });

  it("checkAccess() returns failure when discovery fails", async () => {
    globalThis.fetch = mockFetch({}) as any;

    const client = new AiTxtClient();
    const { success, access, errors } = await client.checkAccess("https://test.com", "training");
    expect(success).toBe(false);
    expect(access).toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
  });

  it("checkAccess() with conditional training and path", async () => {
    const json = JSON.stringify({
      specVersion: "1.0",
      site: { name: "Test", url: "https://test.com" },
      policies: { training: "conditional", scraping: "allow", indexing: "allow", caching: "allow" },
      agents: { "*": {} },
      trainingPaths: { allow: ["/public/*"], deny: ["/private/*"] },
    });

    globalThis.fetch = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: json },
    }) as any;

    const client = new AiTxtClient({ userAgent: "TestBot" });

    const allowed = await client.checkAccess("https://test.com", "training", "/public/post");
    expect(allowed.access?.allowed).toBe(true);

    const denied = await client.checkAccess("https://test.com", "training", "/private/secret");
    expect(denied.access?.allowed).toBe(false);
  });

  // ── User-Agent header ──

  it("sends User-Agent header on requests", async () => {
    const calls: any[] = [];
    globalThis.fetch = vi.fn(async (reqUrl: string, init: any) => {
      calls.push({ url: reqUrl, headers: init?.headers });
      return { ok: true, status: 200, url: reqUrl, text: async () => VALID_JSON, headers: new Headers() };
    }) as any;

    const client = new AiTxtClient({ userAgent: "MyCustomBot/1.0" });
    await client.discover("https://test.com");

    expect(calls[0].headers["User-Agent"]).toBe("MyCustomBot/1.0");
  });

  // ── Cache eviction ──

  it("evicts oldest cache entry when max size exceeded", async () => {
    const fetchMock = vi.fn(async (reqUrl: string) => ({
      ok: true,
      status: 200,
      url: reqUrl,
      text: async () => VALID_JSON,
      headers: new Headers(),
    })) as any;
    globalThis.fetch = fetchMock;

    const client = new AiTxtClient({ maxCacheSize: 2 });

    await client.discover("https://a.com");
    await client.discover("https://b.com");
    await client.discover("https://c.com"); // should evict "a.com"

    fetchMock.mockClear();

    // "a.com" should have been evicted, triggering a re-fetch
    await client.discover("https://a.com");
    expect(fetchMock).toHaveBeenCalled();
  });

  // ── Redirect safety ──

  it("rejects redirects to non-HTTPS URLs", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "http://evil.com/malicious",  // redirected to HTTP
      text: async () => VALID_JSON,
      headers: new Headers(),
    })) as any;

    const client = new AiTxtClient();
    const result = await client.discover("https://test.com");
    expect(result.success).toBe(false);
  });

  it("rejects responses with empty/missing response.url (fail closed)", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "",  // empty — could mean redirect URL unknown
      text: async () => VALID_JSON,
      headers: new Headers(),
    })) as any;

    const client = new AiTxtClient();
    const result = await client.discover("https://test.com");
    expect(result.success).toBe(false);
  });

  // ── Cache-Control directives ──

  it("does not cache when Cache-Control: no-store is present", async () => {
    const fetchMock = mockFetch({
      "https://test.com/.well-known/ai.json": {
        status: 200,
        body: VALID_JSON,
        headers: { "Cache-Control": "no-store" },
      },
    }) as any;
    globalThis.fetch = fetchMock;

    const client = new AiTxtClient({ cacheTtl: 60_000 });

    await client.discover("https://test.com");
    await client.discover("https://test.com");

    // Should fetch twice — no-store means don't cache
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache when Cache-Control: no-cache is present", async () => {
    const fetchMock = mockFetch({
      "https://test.com/.well-known/ai.json": {
        status: 200,
        body: VALID_JSON,
        headers: { "Cache-Control": "no-cache" },
      },
    }) as any;
    globalThis.fetch = fetchMock;

    const client = new AiTxtClient({ cacheTtl: 60_000 });

    await client.discover("https://test.com");
    await client.discover("https://test.com");

    // Should fetch twice — no-cache means don't use cached version
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // ── SSRF: localhost domain confusion ──

  it("rejects http://localhost.attacker.com (domain confusion)", async () => {
    const client = new AiTxtClient();
    const result = await client.discover("http://localhost.attacker.com");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("HTTPS");
  });

  it("allows http://127.0.0.1 for development", async () => {
    globalThis.fetch = mockFetch({
      "http://127.0.0.1:3000/.well-known/ai.json": { status: 200, body: VALID_JSON },
    }) as any;

    const client = new AiTxtClient();
    const result = await client.discover("http://127.0.0.1:3000");
    expect(result.success).toBe(true);
  });

  // ── check() with explicit agentName ──

  it("check() uses explicit agentName over userAgent", async () => {
    const json = JSON.stringify({
      specVersion: "1.0",
      site: { name: "Test", url: "https://test.com" },
      policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
      agents: { "*": {}, claudebot: { training: "allow" } },
    });

    globalThis.fetch = mockFetch({
      "https://test.com/.well-known/ai.json": { status: 200, body: json },
    }) as any;

    const client = new AiTxtClient({ userAgent: "generic-client" });
    const { policy } = await client.check("https://test.com", "ClaudeBot");

    expect(policy?.training).toBe("allow"); // resolved for ClaudeBot, not generic-client
  });
});
