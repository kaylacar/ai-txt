import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { aiTxt } from "../src/middleware.js";
import { parse, parseJSON, validate } from "@ai-txt/core";
import type { Server } from "http";

/**
 * Integration test: verifies that the example app's config produces
 * valid, spec-compliant ai.txt and ai.json output.
 */

let server: Server;
let port: number;

beforeAll(async () => {
  const app = express();
  app.use(
    aiTxt({
      site: {
        name: "News Daily",
        url: "https://newsdaily.example.com",
        description: "A news site demonstrating ai.txt policy declaration",
        contact: "ai-policy@newsdaily.example.com",
        policyUrl: "https://newsdaily.example.com/ai-policy",
      },
      policies: {
        training: "conditional",
        scraping: "allow",
        indexing: "allow",
        caching: "allow",
      },
      trainingPaths: {
        allow: ["/articles/free/*"],
        deny: ["/articles/premium/*"],
      },
      licensing: {
        license: "CC-BY-4.0",
        feeUrl: "https://newsdaily.example.com/ai-licensing",
      },
      agents: {
        "*": { rateLimit: { requests: 30, window: "minute" } },
        ClaudeBot: { training: "allow", rateLimit: { requests: 120, window: "minute" } },
        GPTBot: { training: "deny" },
      },
      content: {
        attribution: "required",
        aiDisclosure: "required",
      },
      compliance: {
        audit: "optional",
      },
    })
  );

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

describe("example app integration", () => {
  it("ai.txt parses without errors", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    const text = await res.text();
    const result = parse(text);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("ai.txt passes validation", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    const text = await res.text();
    const result = parse(text);
    expect(result.success).toBe(true);
    const validation = validate(result.document!);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("ai.json passes validation", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.json`);
    const text = await res.text();
    const result = parseJSON(text);
    expect(result.success).toBe(true);
    const validation = validate(result.document!);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("all four policy fields are present in ai.txt", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.txt`);
    const text = await res.text();
    expect(text).toContain("Training: conditional");
    expect(text).toContain("Scraping: allow");
    expect(text).toContain("Indexing: allow");
    expect(text).toContain("Caching: allow");
  });

  it("all four policy fields are present in ai.json", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.json`);
    const json = await res.json();
    expect(json.policies).toEqual({
      training: "conditional",
      scraping: "allow",
      indexing: "allow",
      caching: "allow",
    });
  });

  it("training paths are included", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.json`);
    const json = await res.json();
    expect(json.trainingPaths.allow).toContain("/articles/free/*");
    expect(json.trainingPaths.deny).toContain("/articles/premium/*");
  });

  it("agent overrides are included", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/ai.json`);
    const json = await res.json();
    // Agent names are normalized to lowercase in the parser
    expect(json.agents).toHaveProperty("ClaudeBot");
    expect(json.agents).toHaveProperty("GPTBot");
    expect(json.agents.ClaudeBot.training).toBe("allow");
    expect(json.agents.GPTBot.training).toBe("deny");
  });
});
