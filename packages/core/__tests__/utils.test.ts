import { describe, it, expect } from "vitest";
import { sanitizeValue, parseRateLimit, formatRateLimit } from "../src/utils.js";

describe("sanitizeValue", () => {
  it("returns string as-is for clean input", () => {
    expect(sanitizeValue("hello world")).toBe("hello world");
  });

  it("replaces newlines with spaces", () => {
    expect(sanitizeValue("line1\nline2")).toBe("line1 line2");
    expect(sanitizeValue("line1\rline2")).toBe("line1 line2");
    expect(sanitizeValue("line1\r\nline2")).toBe("line1  line2");
  });

  it("strips control characters", () => {
    expect(sanitizeValue("hello\x00world")).toBe("helloworld");
    expect(sanitizeValue("hello\x1fworld")).toBe("helloworld");
    expect(sanitizeValue("\x01\x02\x03test")).toBe("test");
  });

  it("trims whitespace", () => {
    expect(sanitizeValue("  spaced  ")).toBe("spaced");
  });

  it("truncates to maxLength", () => {
    expect(sanitizeValue("abcdefgh", 5)).toBe("abcde");
  });

  it("uses default maxLength of 500", () => {
    const long = "a".repeat(600);
    expect(sanitizeValue(long).length).toBe(500);
  });

  it("converts non-string values", () => {
    expect(sanitizeValue(42)).toBe("42");
    expect(sanitizeValue(null)).toBe("");
    expect(sanitizeValue(undefined)).toBe("");
    expect(sanitizeValue(true)).toBe("true");
  });

  it("handles empty string", () => {
    expect(sanitizeValue("")).toBe("");
  });

  it("strips Unicode C1 control characters (U+0080–U+009F)", () => {
    expect(sanitizeValue("hello\x80world")).toBe("helloworld");
    expect(sanitizeValue("test\x9Fvalue")).toBe("testvalue");
  });

  it("strips bidirectional override characters", () => {
    expect(sanitizeValue("hello\u202Aworld")).toBe("helloworld");
    expect(sanitizeValue("test\u202Evalue")).toBe("testvalue");
  });

  it("strips zero-width characters", () => {
    expect(sanitizeValue("hello\u200Bworld")).toBe("helloworld");
    expect(sanitizeValue("test\uFEFFvalue")).toBe("testvalue");
    expect(sanitizeValue("a\u200Fb")).toBe("ab");
  });
});

describe("parseRateLimit", () => {
  it("parses valid rate limits", () => {
    expect(parseRateLimit("60/minute")).toEqual({ requests: 60, window: "minute" });
    expect(parseRateLimit("1/second")).toEqual({ requests: 1, window: "second" });
    expect(parseRateLimit("1000/hour")).toEqual({ requests: 1000, window: "hour" });
    expect(parseRateLimit("10/day")).toEqual({ requests: 10, window: "day" });
  });

  it("returns null for zero requests", () => {
    expect(parseRateLimit("0/minute")).toBeNull();
  });

  it("returns null for invalid formats", () => {
    expect(parseRateLimit("abc/minute")).toBeNull();
    expect(parseRateLimit("60/weekly")).toBeNull();
    expect(parseRateLimit("noslash")).toBeNull();
    expect(parseRateLimit("/minute")).toBeNull();
    expect(parseRateLimit("60/")).toBeNull();
    expect(parseRateLimit("")).toBeNull();
    expect(parseRateLimit("60 / minute")).toBeNull();
    expect(parseRateLimit("-1/minute")).toBeNull();
  });
});

describe("formatRateLimit", () => {
  it("formats rate limit correctly", () => {
    expect(formatRateLimit(60, "minute")).toBe("60/minute");
    expect(formatRateLimit(1, "second")).toBe("1/second");
    expect(formatRateLimit(1000, "hour")).toBe("1000/hour");
    expect(formatRateLimit(10, "day")).toBe("10/day");
  });
});
