message for Claude. Code is tensnails

# Handoff: ai-txt Code Review — 10 Issues to Fix

## What This Repo Is

`ai-txt` implements the `ai.txt` / `ai.json` spec — a `.well-known` file format for websites to declare AI usage policies (training, scraping, indexing, caching, attribution). Two packages:

- **`@ai-txt/core`** (`packages/core/`) — parser, generator, validator, resolver, client, CLI
- **`@ai-txt/express`** (`packages/express/`) — Express middleware serving `ai.txt` and `ai.json`

All 113 tests pass. Build succeeds.

## What Needs To Be Done

A full code review was completed and documented in `REVIEW.md`. It found **10 issues** — mostly spec/code inconsistencies and minor bugs. None of them are fixed yet. All 10 need to be implemented.

## The 10 Issues (Summary)

### Medium Severity

1. **`optional` accepted for Attribution/AI-Disclosure but spec doesn't allow it** — `types.ts:108` defines `RequirementLevel` with `"optional"` but the spec only allows `optional` for the `Audit` field. Fix: either update the spec or restrict the type/parser to match.
   - Files: `SPEC.md:194-196`, `packages/core/src/types.ts:108`, `packages/core/src/parser.ts:16`

2. **`conditional` accepted for Scraping/Indexing/Caching but spec only allows allow|deny** — `schema.ts:3` uses a shared `PolicyValueSchema` with `conditional` for all four fields, but spec only allows `conditional` for Training.
   - Files: `SPEC.md:131`, `packages/core/src/schema.ts:3`, `packages/core/src/parser.ts:86-111`

5. **No validator warning for `conditional` on non-training site-wide fields** — The validator warns for agent-level `conditional` but not site-wide. The resolver silently treats it as `deny`.
   - Files: `packages/core/src/validator.ts`

### Low Severity

3. **Generator doesn't normalize agent names to lowercase** — Parser lowercases agent names, but generator outputs them as-is. Generate-then-parse round trip produces different casing.
   - Files: `packages/core/src/generator.ts:67`

4. **CLI `generate` omits `generatedAt` timestamp** — Express middleware sets it, CLI doesn't. Should be consistent.
   - Files: `packages/core/src/cli.ts:90-95`

6. **`sanitizeValue` silently truncates URLs at 500 chars** — Could produce broken `feeUrl`/`policyUrl`/`site.url` with no warning.
   - Files: `packages/core/src/utils.ts:5-12`

7. **No test for JSON parser agent name normalization** — Text parser has tests for case normalization, JSON parser doesn't.
   - Files: `packages/core/__tests__/`

8. **Client ETag cache key extraction uses fragile regex** — Re-derives base URL from the full URL via regex instead of passing it explicitly.
   - Files: `packages/core/src/client.ts:173`

10. **`globMatch` edge case with trailing `/**/`** — Pattern `/blog/**/` would require a trailing `/` to match, which may not be intended.
    - Files: `packages/core/src/resolver.ts:170-179`

### Informational

9. **Express middleware generates content once at init** — `generatedAt` is frozen at server start. Policy updates require restart. Intentional, but should be documented.
    - Files: `packages/express/src/middleware.ts:39-40`

## Key Files

| File | Purpose |
|------|---------|
| `SPEC.md` | The ai.txt specification |
| `REVIEW.md` | Full code review with all 10 issues detailed |
| `packages/core/src/types.ts` | TypeScript types and interfaces |
| `packages/core/src/schema.ts` | Zod schemas for validation |
| `packages/core/src/parser.ts` | Text format parser |
| `packages/core/src/parser-json.ts` | JSON format parser |
| `packages/core/src/generator.ts` | Text format generator |
| `packages/core/src/validator.ts` | Document validator (warnings/errors) |
| `packages/core/src/resolver.ts` | Policy resolver + glob matching |
| `packages/core/src/client.ts` | HTTP client with ETag caching |
| `packages/core/src/cli.ts` | CLI tool |
| `packages/core/src/utils.ts` | Utility functions (sanitizeValue) |
| `packages/express/src/middleware.ts` | Express middleware |
| `packages/core/__tests__/` | Test files |

## Branch

Working branch: `claude/review-json-text-files-PqLEb`

## Goal

Fix all 10 issues. Keep existing tests passing. Add tests where needed (especially issue 7). The goal is spec-conformant, defensively coded output — no new features, just closing the gap between spec and code.
