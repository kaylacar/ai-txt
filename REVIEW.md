# Code Review: ai.txt / ai.json Implementation

**Reviewer:** Claude
**Date:** 2026-03-09
**Scope:** Full review of `@ai-txt/core` and `@ai-txt/express` packages
**Status:** All 113 tests pass. Build succeeds.

## Summary

The codebase is well-structured with clear separation of concerns: parser, generator, validator, resolver, client, and Express middleware. The text and JSON format implementations are functionally correct and handle edge cases well. However, there are several spec/code inconsistencies and minor issues worth addressing.

## Issues

### 1. Spec vs Code: `optional` accepted for `Attribution`/`AI-Disclosure` but not in spec

- **Files:** `SPEC.md:194-196`, `packages/core/src/types.ts:108`, `packages/core/src/parser.ts:16`
- **Severity:** Medium
- **Details:** The spec lists `Attribution` and `AI-Disclosure` values as `required | recommended | none`. The code defines `RequirementLevel = "required" | "recommended" | "optional" | "none"` which includes `optional`. The spec only uses `optional` for the `Audit` field. Either update the spec to include `optional` for all requirement fields, or restrict the code.

### 2. Spec vs Code: `conditional` accepted for Scraping/Indexing/Caching

- **Files:** `SPEC.md:131`, `packages/core/src/schema.ts:3`, `packages/core/src/parser.ts:86-111`
- **Severity:** Medium
- **Details:** The spec says Scraping, Indexing, and Caching only accept `allow | deny`. The code uses a shared `PolicyValueSchema = z.enum(["allow", "deny", "conditional"])` for all four fields. The validator warns about `conditional` at the agent level but does NOT warn about it at the site-wide level for non-training fields.

### 3. Generator does not normalize agent names to lowercase

- **Files:** `packages/core/src/generator.ts:67`
- **Severity:** Low
- **Details:** The parser normalizes agent names to lowercase (per spec: case-insensitive matching), but the generator outputs agent name keys as-is. If a document is constructed programmatically with mixed-case keys like `"ClaudeBot"`, the generated text will preserve that casing. This creates an asymmetry — generate then parse produces different agent key casing than the input.

### 4. CLI `generate` command omits `generatedAt` timestamp

- **Files:** `packages/core/src/cli.ts:90-95`
- **Severity:** Low
- **Details:** The CLI `generate` command builds a document without `generatedAt`. The Express middleware sets it (`new Date().toISOString()`), so the CLI should do the same for consistency.

### 5. No validator warning for `conditional` on non-training site-wide fields

- **Files:** `packages/core/src/validator.ts`
- **Severity:** Medium
- **Details:** The validator warns when an agent block uses `conditional` (code `AGENT_CONDITIONAL_POLICY`), but does not warn when site-wide `scraping`, `indexing`, or `caching` are set to `conditional` — which the spec does not support. The resolver already treats `conditional` on non-training fields as `deny` (`resolver.ts:106-108`), but no warning is emitted during validation.

### 6. `sanitizeValue` truncates URLs silently

- **Files:** `packages/core/src/utils.ts:5-12`
- **Severity:** Low
- **Details:** `sanitizeValue` truncates to 500 characters with no warning. Applied to `feeUrl`, `policyUrl`, and `site.url` via the generator, this could silently produce broken URLs. Consider either increasing the limit for URL fields or emitting a warning.

### 7. Missing test coverage for JSON parser agent name normalization

- **Files:** `packages/core/__tests__/` (no test for `parser-json.ts` agent normalization)
- **Severity:** Low
- **Details:** The JSON parser normalizes agent names to lowercase (`parser-json.ts:34-40`), but no test explicitly verifies this behavior. The text parser has dedicated tests for case normalization.

### 8. Client ETag cache key extraction is fragile

- **Files:** `packages/core/src/client.ts:173`
- **Severity:** Low
- **Details:** `fetchAndParse` extracts the base URL for caching via regex: `url.replace(/\/.well-known\/ai\.(txt|json)$/, "")`. This works correctly for the current code paths but would break if the URL format ever changes. Consider passing the base URL explicitly instead of re-deriving it.

### 9. Express middleware generates content once at init

- **Files:** `packages/express/src/middleware.ts:39-40`
- **Severity:** Informational
- **Details:** `generate(doc)` and `generateJSON(doc)` are called once at middleware initialization. This is efficient for static policies but means `generatedAt` is frozen at server start time, and policy updates require server restart. This is likely intentional but worth documenting.

### 10. `globMatch` potential edge case with `/**/` at pattern end

- **Files:** `packages/core/src/resolver.ts:170-179`
- **Severity:** Low
- **Details:** The glob matcher handles `/**/` (mid-pattern) and `**` (standalone) separately. A pattern ending in `/**/` (trailing slash after `**`) would be replaced as `(?:/.+)?/` which requires a trailing `/` — this may not match as expected. Patterns like `/blog/**/` would only match paths ending with `/`.

## What's Working Well

- Clean module separation: parser, generator, validator, resolver, client
- Comprehensive test coverage (113 tests across 7 test files)
- Proper case-insensitive key parsing and agent name normalization
- ETag and Cache-Control support in the HTTP client
- Security headers (nosniff, DENY framing) in Express middleware
- CORS support with configurable origins
- Input sanitization preventing newline injection

## Not In Scope

The following file types referenced in issues #75-#85 are not part of this repo — they belong to separate repos in the ecosystem stack:

| File | Repo |
|------|------|
| `agent.txt` / `agent.json` | [kaylacar/agents-txt](https://github.com/kaylacar/agents-txt) |
| `connect.txt` / `connect.json` | [kaylacar/connect-txt](https://github.com/kaylacar/connect-txt) |
| `verify.txt` / `verify.json` | [kaylacar/verify-txt](https://github.com/kaylacar/verify-txt) |
| `connect-ledger.json` | [kaylacar/connect-txt](https://github.com/kaylacar/connect-txt) |
| `open-contributions.json` | Separate contribution tracking |
