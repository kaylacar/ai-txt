import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { aiTxt } from "../src/middleware.js";
import { parse, parseJSON } from "@ai-txt/core";
import type { Server } from "http";

let app: ReturnType<typeof express>;
let server: Server;
let port: number;

beforeAll(async () => {
  app = express();
  app.use(
    aiTxt({
      site: {
        name: "Test Blog",
        url: "https://testblog.com",
        contact: "ai@testblog.com",
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
      },
      agents: {
        "*": { rateLimit: { requests: 60, window: "minute" } },
        "ClaudeBot": { training: "allow" },
      },
      content: {
        attribution: "required",
      },
    }),
  );

  app.get("/", (_req, res) => res.send("ok"));

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      port = addr.port;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

describe("aiTxt middleware", () => {
  it("serves ai.txt at /.well-known/ai.txt", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("Site-Name: Test Blog");
    expect(text).toContain("Training: conditional");
  });

  it("serves ai.json at /.well-known/ai.json", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const json = await res.json();
    expect(json.site.name).toBe("Test Blog");
    expect(json.policies.training).toBe("conditional");
  });

  it("text output parses correctly", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    const text = await res.text();
    const result = parse(text);
    expect(result.success).toBe(true);
    expect(result.document?.site.name).toBe("Test Blog");
    expect(result.document?.policies.training).toBe("conditional");
    expect(result.document?.licensing?.license).toBe("CC-BY-4.0");
  });

  it("JSON output parses correctly", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.json`);
    const text = await res.text();
    const result = parseJSON(text);
    expect(result.success).toBe(true);
    expect(result.document?.agents["claudebot"]?.training).toBe("allow");
  });

  it("sets CORS headers", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("sets security headers", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("sets cache headers", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    expect(res.headers.get("cache-control")).toContain("max-age=300");
  });

  it("handles OPTIONS preflight", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
  });

  it("passes through non-ai.txt routes", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("includes training paths", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    const text = await res.text();
    expect(text).toContain("Training-Allow: /blog/public/*");
    expect(text).toContain("Training-Deny: /blog/premium/*");
  });

  it("includes content requirements", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    const text = await res.text();
    expect(text).toContain("Attribution: required");
  });

  it("sets Vary header", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    expect(res.headers.get("vary")).toContain("Origin");
  });

  it("sets Access-Control-Allow-Methods header", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
    expect(res.headers.get("access-control-allow-methods")).toContain("HEAD");
    expect(res.headers.get("access-control-allow-methods")).toContain("OPTIONS");
  });

  it("handles HEAD requests with correct headers and no body", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`, { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("content-length")).toBeTruthy();
    const body = await res.text();
    expect(body).toBe("");
  });

  it("handles HEAD requests for JSON endpoint", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.json`, { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.text();
    expect(body).toBe("");
  });
});

// ── Custom paths and CORS ──

describe("aiTxt middleware with custom config", () => {
  let customApp: ReturnType<typeof express>;
  let customServer: Server;
  let customPort: number;

  beforeAll(async () => {
    customApp = express();
    customApp.use(
      aiTxt({
        site: {
          name: "Custom Site",
          url: "https://custom.com",
        },
        policies: {
          training: "deny",
          scraping: "allow",
          indexing: "allow",
          caching: "allow",
        },
        paths: {
          txt: "/custom/ai.txt",
          json: "/custom/ai.json",
        },
        corsOrigins: ["https://allowed.com", "https://also-allowed.com"],
      }),
    );

    customApp.get("/", (_req, res) => res.send("ok"));

    await new Promise<void>((resolve) => {
      customServer = customApp.listen(0, () => {
        const addr = customServer.address() as { port: number };
        customPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(() => {
    customServer?.close();
  });

  it("serves at custom txt path", async () => {
    const res = await fetch(`http://127.0.0.1:${customPort}/custom/ai.txt`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Site-Name: Custom Site");
  });

  it("serves at custom json path", async () => {
    const res = await fetch(`http://127.0.0.1:${customPort}/custom/ai.json`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.site.name).toBe("Custom Site");
  });

  it("does not serve at default paths when custom paths are set", async () => {
    const res = await fetch(`http://127.0.0.1:${customPort}/.well-known/ai.txt`);
    // Should fall through to 404 since no route handles it
    expect(res.status).not.toBe(200);
  });

  it("sets CORS for allowed origin", async () => {
    const res = await fetch(`http://127.0.0.1:${customPort}/custom/ai.txt`, {
      headers: { Origin: "https://allowed.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://allowed.com");
  });

  it("does not set CORS for disallowed origin", async () => {
    const res = await fetch(`http://127.0.0.1:${customPort}/custom/ai.txt`, {
      headers: { Origin: "https://evil.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
