# Changelog

## 1.0.0 (2026-02-28)

Promoted to 1.0.0 to align package versions with the ai.txt spec version (1.0).

### @ai-txt/core

- **Security:** Client enforces response body size limit (default 1 MB)
- **Security:** Client limits cache size (default 1000 entries) with oldest-first eviction
- Updated default User-Agent to `ai-txt-client/1.0`
- New `maxResponseSize` and `maxCacheSize` client options

### @ai-txt/express

- **Security:** Middleware applies safe defaults for omitted policy fields (training→deny, scraping/indexing/caching→allow)
- **Fix:** `peerDependenciesMeta` marks express as required (not optional)
- Added vitest config so tests resolve `@ai-txt/core` from source (no build step needed)

### Examples

- **Security:** Escaped `req.params.slug` to prevent reflected XSS
- Added missing `scraping`, `indexing`, `caching` fields to policies

### CI

- Added GitHub Actions workflow (test + typecheck + build on Node 18/20/22)

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
