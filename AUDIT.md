# Code Audit Report — ai-txt

**Date:** 2026-02-27
**Scope:** Full codebase audit — security, correctness, spec compliance, test coverage
**Status:** All findings resolved

---

## Executive Summary

A comprehensive audit identified 3 security issues, 5 correctness bugs, 4 spec compliance gaps, and several code quality improvements. All issues have been resolved. Test count increased from 179 to 215.

---

## 1. Security Issues (Resolved)

### 1.1 XSS in Example Application — FIXED

`examples/basic-express/index.js` directly interpolated `req.params.slug` into HTML. Added `escapeHtml()` to sanitize user input before rendering.

### 1.2 SSRF via localhost Domain Confusion — FIXED

`client.ts` used string prefix matching (`startsWith("http://localhost")`), allowing URLs like `http://localhost.attacker.com`. Replaced with `new URL()` parsing that validates `hostname` is exactly `localhost` or `127.0.0.1`.

### 1.3 SSRF Redirect Check — FIXED

`client.ts` fell back to the original URL when `response.url` was empty, bypassing the redirect safety check. Changed to fail closed: requests with missing or non-HTTPS `response.url` are rejected.

---

## 2. Correctness Fixes (Resolved)

| Issue | Fix |
|-------|-----|
| CLI accepted invalid policy values via unsafe `as` casts | Added `parsePolicyFlag()` with validation against allowed values |
| `check()`/`checkAccess()` used HTTP User-Agent for policy resolution | Added optional `agentName` parameter, defaults to `userAgent` |
| Client ignored `Cache-Control: no-cache` and `no-store` | Added directive parsing; `no-store` prevents caching, `no-cache` skips cached responses |
| Duplicate `Agent:` blocks silently overwrote | Parser emits a warning when a duplicate agent name is encountered |
| `resolve()` leaked a mutable reference to `doc.content` | Changed to shallow copy: `{ ...doc.content }` |
| `sanitizeValue` only stripped ASCII controls | Extended regex to strip Unicode C1 controls, bidi overrides, and zero-width characters |
| `generateJSON` performed no validation | Added Zod schema validation before serialization; throws on invalid documents |
| Parser error messages said "bytes" for `input.length` | Changed to "characters" (`.length` counts UTF-16 code units, not bytes) |

---

## 3. Spec Compliance Fixes (Resolved)

| Issue | Fix |
|-------|-----|
| `conditional` accepted for scraping/indexing/caching | Elevated from warning to **validation error** |
| `Spec-Version` not enforced as `1.0` | Validator warns on unrecognized versions |
| `Audit` field accepted `recommended` (not in spec) | Validator warns when `recommended` is used for Audit |
| Parser silently parsed comment-style headers | Parser now emits warnings for `# Spec-Version:` and `# Generated-At:` in comments |

---

## 4. Infrastructure Improvements

- Added 1 MB input size limit to both `parse()` and `parseJSON()`
- Exported 5 missing Zod schemas from public API: `TrainingPathsSchema`, `LicensingInfoSchema`, `ContentRequirementsSchema`, `ComplianceConfigSchema`, `RateLimitWindowSchema`

---

## 5. Test Coverage

| Suite | Tests | Status |
|-------|-------|--------|
| parser.test.ts | 43 | Pass |
| parser-json.test.ts (new) | 11 | Pass |
| cli.test.ts (new) | 8 | Pass |
| generator.test.ts | 10 | Pass |
| validator.test.ts | 26 | Pass |
| resolver.test.ts | 41 | Pass |
| client.test.ts | 33 | Pass |
| roundtrip.test.ts | 8 | Pass |
| utils.test.ts | 15 | Pass |
| middleware.test.ts | 20 | Pass |
| **Total** | **215** | **All passing** |

New tests cover: duplicate agent warnings, input size limits, comment-style header warnings, Cache-Control no-store/no-cache, SSRF redirect with empty URL, localhost domain confusion, 127.0.0.1 support, explicit agentName in check(), JSON parser edge cases, CLI flag validation, Unicode control character stripping, spec-version warnings, and audit field validation.

---

## 6. Known Limitations (Not Bugs)

- **IPv6 localhost not supported**: `http://[::1]` is rejected. Only `localhost` and `127.0.0.1` are allowed for HTTP. This is a deliberate security-conservative choice.
- **`PolicyValue` type still includes `conditional` for all fields**: The TypeScript union type allows `conditional` on scraping/indexing/caching, but the validator rejects it at runtime. Narrowing the type would be a breaking API change.
- **`generatedAt` in middleware is set once at init**: This is by design — the timestamp reflects when the policy was configured, not when it was served. The middleware serves pre-computed content for performance.
