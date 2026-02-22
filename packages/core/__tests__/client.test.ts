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
    if (!resp) return { ok: false, status: 404, text: async () => "", headers: new Headers() };
    return {
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
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
          text: async () => VALID_JSON,
          headers: new Headers({ ETag: '"abc123"' }),
        };
      }

      // Second request — return 304 Not Modified
      return {
        ok: false,
        status: 304,
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
});
