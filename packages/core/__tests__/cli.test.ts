import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { resolve } from "node:path";

const CLI = resolve(import.meta.dirname, "../src/cli.ts");

function run(args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((res) => {
    execFile("npx", ["tsx", CLI, ...args], { timeout: 10_000 }, (err, stdout, stderr) => {
      res({ stdout, stderr, code: err ? (err as any).code ?? 1 : 0 });
    });
  });
}

describe("CLI", () => {
  // ── help ──

  it("shows help when no command given", async () => {
    const { stdout } = await run([]);
    expect(stdout).toContain("ai-txt");
    expect(stdout).toContain("check");
    expect(stdout).toContain("generate");
  });

  it("shows help for unknown commands", async () => {
    const { stdout } = await run(["unknown"]);
    expect(stdout).toContain("ai-txt");
  });

  // ── generate ──

  it("generates ai.txt with required flags", async () => {
    const { stdout, code } = await run([
      "generate", "--name", "My Blog", "--url", "https://myblog.com",
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("Site-Name: My Blog");
    expect(stdout).toContain("Site-URL: https://myblog.com");
    expect(stdout).toContain("Training: deny"); // default
    expect(stdout).toContain("Scraping: allow"); // default
  });

  it("generates ai.txt with custom policy flags", async () => {
    const { stdout, code } = await run([
      "generate", "--name", "Wiki", "--url", "https://wiki.org",
      "--training", "allow", "--scraping", "deny",
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("Training: allow");
    expect(stdout).toContain("Scraping: deny");
  });

  it("generates ai.txt with license and contact", async () => {
    const { stdout, code } = await run([
      "generate", "--name", "Open", "--url", "https://open.org",
      "--training", "allow", "--license", "CC-BY-4.0", "--contact", "ai@open.org",
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("Training-License: CC-BY-4.0");
    expect(stdout).toContain("Contact: ai@open.org");
  });

  it("rejects invalid policy values", async () => {
    const { stderr, code } = await run([
      "generate", "--name", "Test", "--url", "https://test.com",
      "--training", "banana",
    ]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("Invalid value");
    expect(stderr).toContain("banana");
  });

  it("exits with error when --name is missing", async () => {
    const { stderr, code } = await run([
      "generate", "--url", "https://test.com",
    ]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("Usage");
  });

  it("exits with error when --url is missing", async () => {
    const { stderr, code } = await run([
      "generate", "--name", "Test",
    ]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("Usage");
  });
});
