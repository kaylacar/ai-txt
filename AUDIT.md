# Code Audit Report — ai-txt

**Date:** 2026-02-27
**Scope:** Full codebase audit — security, correctness, spec compliance, test coverage
**Test Suite:** 179 tests passing (159 core + 20 express), 8 test files

---

## Executive Summary

The ai-txt codebase is well-structured, with clean separation of concerns, comprehensive TypeScript types, and solid test coverage. The code quality is generally high. This audit identified **3 security issues** (1 high, 2 medium), **5 bugs/correctness issues**, **4 spec compliance gaps**, and several minor code quality observations.

---

## 1. Security Issues

### 1.1 [HIGH] XSS in Example Application

**File:** `examples/basic-express/index.js:78, 93`

The example directly interpolates user-controlled `req.params.slug` into HTML without escaping:

```js
<h1>${req.params.slug}</h1>
```

A request to `/articles/free/<script>alert(1)</script>` would execute arbitrary JavaScript. While this is an example, published examples are often copied verbatim by users.

**Recommendation:** Escape HTML entities before interpolation, or add a comment warning this is a simplified demo.

---

### 1.2 [MEDIUM] SSRF via `localhost` Domain Confusion

**File:** `packages/core/src/client.ts:56, 86`

```ts
if (!baseUrl.startsWith("https://") && !baseUrl.startsWith("http://localhost")) {
```

This check allows `http://localhost.attacker.com`, `http://localhost:3000@attacker.com`, and similar URLs that _start with_ `http://localhost` but resolve to external hosts. An attacker controlling the `baseUrl` parameter could use this to reach internal services.

**Recommendation:** Parse the URL and validate the hostname is exactly `localhost` or `127.0.0.1`:

```ts
const url = new URL(baseUrl);
const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
if (url.protocol !== "https:" && !isLocalhost) { ... }
```

---

### 1.3 [MEDIUM] SSRF Redirect Check May Be Bypassed

**File:** `packages/core/src/client.ts:197-199`

```ts
const finalUrl = response.url || url;
if (!finalUrl.startsWith("https://") && !finalUrl.startsWith("http://localhost")) {
  return null;
}
```

When `response.url` is empty (possible in some Node.js environments or polyfills), this falls back to `url` — the original, already-validated URL. This means a redirect to an internal HTTP service would go undetected. Additionally, this inherits the same `localhost` domain confusion issue from 1.2.

**Recommendation:** Treat missing `response.url` as a failure rather than falling back, and apply proper hostname validation.

---

## 2. Bugs & Correctness Issues

### 2.1 CLI Accepts Invalid Policy Values Without Validation

**File:** `packages/core/src/cli.ts:68-71`

```ts
const training = (flag("training") ?? "deny") as PolicyValue;
```

The `as PolicyValue` cast bypasses type safety. Running `ai-txt generate --name X --url https://x.com --training banana` produces `Training: banana` — an invalid ai.txt file. The same applies to `--scraping`, `--indexing`, and `--caching`.

**Recommendation:** Validate the flag value against allowed values before casting.

---

### 2.2 Client `check()` Uses Its Own User-Agent for Policy Resolution

**File:** `packages/core/src/client.ts:112`

```ts
const policy = resolve(result.document, this.userAgent);
```

The `check()` method resolves policies using the HTTP User-Agent string (e.g., `"ai-txt-client/0.1"`), which is typically not the same as the actual agent name. This can return incorrect policies when the client is used as a library by a different AI agent.

**Recommendation:** Accept an explicit `agentName` parameter in `check()` and `checkAccess()`, defaulting to `this.userAgent` for backward compatibility.

---

### 2.3 Client Ignores `Cache-Control: no-cache` and `no-store`

**File:** `packages/core/src/client.ts:217-227`

The client respects `max-age` but completely ignores `no-cache` and `no-store` directives. A server that sends `Cache-Control: no-store` expects clients not to cache the response at all, but this client will cache it with the default TTL.

**Recommendation:** Check for `no-store` and `no-cache` before caching.

---

### 2.4 Duplicate Agent Blocks Silently Overwrite

**File:** `packages/core/src/parser.ts:43-49`

If an ai.txt file contains two `Agent: ClaudeBot` blocks, the second silently replaces the first with no warning. This could cause site owners to unknowingly lose their intended policy for an agent.

**Recommendation:** Emit a warning when a duplicate agent name is encountered.

---

### 2.5 `resolve()` Leaks a Reference to Source Document

**File:** `packages/core/src/resolver.ts:71`

```ts
if (doc.content) resolved.content = doc.content;
```

The returned `ResolvedPolicy` shares a reference to `doc.content`. Mutations to the resolved policy's `content` field would modify the original document. While unlikely to cause issues in practice, it violates the principle of least surprise.

**Recommendation:** Shallow-copy: `resolved.content = { ...doc.content }`.

---

## 3. Spec Compliance Issues

### 3.1 `conditional` Accepted for Non-Training Policies at Parse Time

**File:** `packages/core/src/parser.ts:15`, `packages/core/src/types.ts:51`

The spec states `conditional` is only valid for `Training`, but `PolicyValue = "allow" | "deny" | "conditional"` is used for all four policies. The parser accepts `Scraping: conditional` without error. The validator catches it, but only as a **warning**, not an error.

**Recommendation:** Either restrict the type or elevate this to a validation error.

---

### 3.2 `Spec-Version` Not Enforced as `1.0`

**File:** `packages/core/src/parser.ts:143`, `packages/core/src/schema.ts:58`

The spec says `Spec-Version` "Must be `1.0`", but the parser accepts any value and the schema only validates `\d+\.\d+` format. `Spec-Version: 99.9` would parse without error.

**Recommendation:** Emit a warning when `specVersion` is not `1.0`.

---

### 3.3 `Audit` Field Accepts `recommended` but Spec Only Lists Three Values

**File:** `SPEC.md:201`, `packages/core/src/parser.ts:209-215`

The spec defines `Audit` values as `required`, `optional`, `none` (3 values). But the code accepts all four `RequirementLevel` values including `recommended`, which is not listed in the spec for this field.

**Recommendation:** Either update the spec to include `recommended` or restrict validation for the `Audit` field.

---

### 3.4 Parser Accepts Legacy Comment-Style Headers Not in Spec

**File:** `packages/core/src/parser.ts:58-61`

```ts
const specMatch = trimmed.match(/^#\s*Spec-Version:\s*(.+)/i);
const genMatch = trimmed.match(/^#\s*Generated(?:-At)?:\s*(.+)/i);
```

The parser silently extracts `Spec-Version` and `Generated-At` from comments (`# Spec-Version: 1.0`). This is not documented in the spec. While backward-compatible, it means fields that look like comments are parsed as data, which could surprise users.

**Recommendation:** Document this behavior or emit a warning when comment-style headers are detected.

---

## 4. Code Quality Observations

### 4.1 No Input Size Limit in Parser

**Files:** `packages/core/src/parser.ts`, `packages/core/src/parser-json.ts`

Neither parser limits input size. A multi-gigabyte malicious ai.txt file would be fully loaded and processed, causing excessive memory usage. The glob matcher has size limits (pattern: 1000 chars, path: 2000 chars) but the parsers don't.

**Recommendation:** Add an input size check (e.g., reject inputs > 1MB).

---

### 4.2 `sanitizeValue` Doesn't Strip Non-ASCII Control Characters

**File:** `packages/core/src/utils.ts:5-12`

The function strips ASCII control characters (`\x00-\x1f`) but not Unicode control characters (U+0080–U+009F), bidirectional override characters (U+202A–U+202E), or zero-width characters (U+200B–U+200F). These could be used for text direction attacks or invisible content injection.

**Recommendation:** Extend the regex to strip Unicode control/formatting characters.

---

### 4.3 `generateJSON` Performs No Validation

**File:** `packages/core/src/generator-json.ts`

The entire function is `JSON.stringify(doc, null, 2)`. It does not validate the document before serialization. Any extra or invalid properties will be included in the output.

---

### 4.4 `middleware.ts` Timestamp Is Set Once at Init

**File:** `packages/express/src/middleware.ts:29`

```ts
generatedAt: new Date().toISOString(),
```

The `generatedAt` timestamp and the serialized `txtContent`/`jsonContent` are computed once when the middleware is created. If the server runs for days/weeks, the timestamp becomes stale. If `options` values change at runtime, the served content won't reflect changes.

**Recommendation:** Document this behavior, or regenerate content periodically / on-demand.

---

## 5. Test Coverage Gaps

### 5.1 Missing Test Coverage

| Area | Gap |
|------|-----|
| `cli.ts` | **No test file at all.** The entire CLI is untested — flag parsing, `check`, `generate`, `help`, error handling. |
| `parser-json.ts` | **No dedicated test file.** JSON parsing is only tested indirectly through roundtrip and client tests. |
| Parser — large input | No test for excessively large inputs or deeply nested agent blocks. |
| Parser — duplicate agents | No test verifying behavior when the same agent appears twice. |
| Client — `no-cache`/`no-store` | No tests for these Cache-Control directives. |
| Client — SSRF redirect | No test for redirect to HTTP or internal URLs. |
| `globMatch` — adversarial patterns | No tests for pathological regex patterns or the length limits. |
| Generator — round-trip fidelity for metadata | Metadata key casing through parse → generate round-trip is not thoroughly tested. |
| Middleware — concurrent requests | No concurrency or performance tests. |

### 5.2 Test Quality Notes

- All 179 tests pass cleanly.
- Core resolver tests are thorough (41 tests) with good edge case coverage.
- Parser tests are comprehensive (39 tests) but lean toward happy-path scenarios.
- Client tests (27 tests) mock `fetch` well and cover caching behavior, but miss some edge cases (see above).
- Middleware tests (20 tests) cover CORS, HEAD, OPTIONS, caching, and path matching thoroughly.

---

## 6. Positive Findings

- **Clean architecture:** Parser, generator, validator, resolver, and client are cleanly separated.
- **Dual format support:** Both text and JSON formats are fully supported.
- **Good TypeScript practices:** Strict mode, no unused variables, comprehensive type definitions.
- **Zod validation:** Runtime schema validation at parse boundaries.
- **Glob security:** Length limits on patterns/paths to prevent ReDoS.
- **SSRF prevention:** HTTPS enforcement and redirect checking (with caveats noted above).
- **ETag caching:** Proper cache revalidation with ETags.
- **Sanitization:** Output sanitization to prevent newline injection.
- **Test coverage:** 179 tests across 8 test files covering core functionality well.

---

## Summary of Findings by Severity

| Severity | Count | Key Items |
|----------|-------|-----------|
| **High** | 1 | XSS in example app |
| **Medium** | 2 | SSRF via localhost confusion, SSRF redirect bypass |
| **Low (Bugs)** | 5 | CLI validation, client agent resolution, cache directives, duplicate agents, reference leak |
| **Spec Compliance** | 4 | `conditional` scope, version enforcement, audit values, comment headers |
| **Code Quality** | 4 | Input size limits, Unicode sanitization, JSON generator validation, stale timestamps |
| **Test Gaps** | 9+ | No CLI tests, no JSON parser tests, missing edge cases |
