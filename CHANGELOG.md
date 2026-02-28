# Changelog

## 1.0.0 (2026-02-28)

Stable release — spec and implementation aligned at v1.0.

### @ai-txt/core

- Promoted to v1.0.0 stable (no API changes from 0.1.0)

### @ai-txt/express

- Promoted to v1.0.0 stable (no API changes from 0.1.0)

---

## 0.1.0 (2026-02-22)

Initial release of the ai.txt standard and reference implementation.

### @ai-txt/core

- Text format parser and generator for `ai.txt`
- JSON format parser and generator for `ai.json`
- Zod-based schema validation
- Semantic validator with warnings for common misconfigurations
- Policy resolver: merge agent-specific, wildcard, and site-wide policies
- `canAccess()` for single-call permission checks with glob path matching
- HTTP discovery client with in-memory caching and ETag revalidation
- Client respects `Cache-Control max-age` from server responses
- `discover()` tries JSON first, falls back to text (per spec)
- CLI: `npx @ai-txt/core generate` and `npx @ai-txt/core check`
- Full TypeScript types for the complete ai.txt document structure

### @ai-txt/express

- Express middleware for serving `/.well-known/ai.txt` and `/.well-known/ai.json`
- CORS support with configurable origins
- ETag caching and security headers
- One-line setup: `app.use(aiTxt({ site, policies }))`
