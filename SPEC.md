# ai.txt Specification

**Version:** 1.0
**Status:** Stable
**Last Updated:** 2026-02-21

## Abstract

`ai.txt` is an open standard that defines a machine-readable file format for websites to declare their AI policy. Any website — blogs, newspapers, e-commerce stores, portfolios, forums, SaaS platforms — can place an `ai.txt` file at a well-known location to communicate:

- Whether AI systems may use the site's content for training
- Whether AI agents may scrape, index, or cache the site's content
- Which AI agents are welcome and under what terms
- Content licensing for AI use
- Attribution and disclosure requirements
- Compliance and audit expectations

`ai.txt` is complementary to existing standards:

- **robots.txt** controls crawling ("don't crawl this path")
- **agents.txt** declares API capabilities ("here's what agents can DO")
- **ai.txt** declares AI policy ("here's what's ALLOWED and on what terms")

`robots.txt` can block a crawler, but it cannot express "you may crawl but not train on this content." `ai.txt` fills that gap.

## Overview

### Design Principles

1. **Universal** — Works for any website, not just those with APIs
2. **Simple** — A blog owner can write an `ai.txt` file by hand in 30 seconds
3. **Machine-readable** — AI agents and crawlers can parse it programmatically
4. **Granular** — Per-agent and per-path policies for fine-grained control
5. **Declarative** — States policy; never contains secrets or enforcement logic
6. **Complementary** — Works alongside robots.txt, agents.txt, and llms.txt

### Relationship to Other Standards

| Standard | Purpose | Relationship |
|----------|---------|-------------|
| `robots.txt` (RFC 9309) | Crawling restrictions | `ai.txt` adds training/licensing policy that robots.txt cannot express |
| `agents.txt` | AI agent capability declaration | `ai.txt` declares policy; `agents.txt` declares capabilities. Both may coexist |
| `llms.txt` | Human-readable content for LLMs | `ai.txt` declares machine-readable policy; `llms.txt` provides content |
| `security.txt` (RFC 9116) | Security vulnerability disclosure | Similar well-known file pattern; different domain |

## File Location

### Primary Location

The `ai.txt` file MUST be served at:

```
https://example.com/.well-known/ai.txt
```

### JSON Companion

The JSON companion file MUST be served at:

```
https://example.com/.well-known/ai.json
```

### Content Types

| File | Content-Type |
|------|-------------|
| `ai.txt` | `text/plain; charset=utf-8` |
| `ai.json` | `application/json; charset=utf-8` |

### Cross-Referencing

The text file MAY reference the JSON companion:

```
AI-JSON: https://example.com/.well-known/ai.json
```

The text file MAY reference an `agents.txt` capability declaration:

```
Agents-TXT: https://example.com/.well-known/agents.txt
```

## Text Format Specification

### General Syntax

- Each line contains a key, a colon, and a value: `Key: value`
- Lines beginning with `#` are comments
- Empty lines are ignored
- Indented lines (two or more spaces, or tabs) belong to the preceding block
- Line order does not matter except within blocks
- Keys are case-insensitive
- Values are trimmed of leading/trailing whitespace

### Header Section

| Field | Required | Description |
|-------|----------|-------------|
| `Spec-Version` | Yes | Must be `1.0` |
| `Generated-At` | No | ISO 8601 timestamp of when the file was generated |

Example:

```
# ai.txt — AI Policy Declaration
Spec-Version: 1.0
Generated-At: 2026-02-21T00:00:00.000Z
```

### Site Section

| Field | Required | Description |
|-------|----------|-------------|
| `Site-Name` | Yes | Human-readable site name |
| `Site-URL` | Yes | Canonical HTTPS URL |
| `Description` | No | Brief description of the site |
| `Contact` | No | Email for AI policy inquiries |
| `Policy-URL` | No | URL to human-readable AI policy page |

### Content Policy Fields

These are the core policy declarations.

| Field | Default | Valid values | Description |
|-------|---------|-------------|-------------|
| `Training` | `deny` | `allow`, `deny`, `conditional` | Whether AI systems may use content for model training |
| `Scraping` | `allow` | `allow`, `deny` | Whether AI agents may scrape/read content |
| `Indexing` | `allow` | `allow`, `deny` | Whether AI systems may index content for retrieval |
| `Caching` | `allow` | `allow`, `deny` | Whether AI systems may cache content |

**Policy values:**

- `allow` — Permitted without restriction
- `deny` — Not permitted
- `conditional` — Permitted under specific conditions; only valid for `Training` (see Training Paths and Licensing)

### Training Path Fields

When `Training` is `conditional`, these fields specify which paths are included or excluded:

| Field | Description |
|-------|-------------|
| `Training-Allow` | Glob pattern for paths where training is permitted |
| `Training-Deny` | Glob pattern for paths where training is denied |

Multiple `Training-Allow` and `Training-Deny` lines may appear. More specific patterns take precedence.

### Licensing Fields

| Field | Description |
|-------|-------------|
| `Training-License` | SPDX license identifier for AI training use (e.g., `CC-BY-4.0`, `CC-BY-SA-4.0`, `LicenseRef-Custom`) |
| `Training-Fee` | URL to commercial licensing/pricing page |

When `Training-License` is `LicenseRef-Custom`, `Training-Fee` SHOULD be provided so agents have a path to understand the terms.

### Agent Blocks

Agent blocks declare per-agent policy overrides. The wildcard `*` sets the default for all agents. Agent names are matched case-insensitively against the first token of the User-Agent header.

```
Agent: *
  Rate-Limit: 60/minute

Agent: ClaudeBot
  Training: allow
  Rate-Limit: 200/minute

Agent: GPTBot
  Training: deny
  Scraping: deny
```

**Fields within Agent blocks:**

| Field | Description |
|-------|-------------|
| `Training` | Override site-wide training policy for this agent |
| `Scraping` | Override site-wide scraping policy for this agent |
| `Indexing` | Override site-wide indexing policy for this agent |
| `Caching` | Override site-wide caching policy for this agent |
| `Rate-Limit` | Advisory rate limit in `N/window` format |

**Rate-Limit windows:** `second`, `minute`, `hour`, `day`

If a site serves both `ai.txt` and `agents.txt` and declares rate limits in both, the more restrictive limit applies.

### Content Requirement Fields

| Field | Values | Description |
|-------|--------|-------------|
| `Attribution` | `required`, `recommended`, `none` | Whether AI outputs using this content must attribute the source |
| `AI-Disclosure` | `required`, `recommended`, `none` | Whether AI-generated content derived from this site must be disclosed as AI-generated |

### Compliance Fields

| Field | Values | Description |
|-------|--------|-------------|
| `Audit` | `required`, `optional`, `none` | Whether AI agents must provide audit receipts |
| `Audit-Format` | String | Expected audit format identifier (e.g., `rer-artifact/0.1`) |

### Cross-Reference Fields

| Field | Description |
|-------|-------------|
| `AI-JSON` | URL to the JSON companion file |
| `Agents-TXT` | URL to the site's agents.txt capability declaration |

### Metadata

Any unrecognized top-level `Key: Value` pair is stored as metadata.

## JSON Format Specification

The `ai.json` file contains equivalent information in a typed JSON structure:

```json
{
  "specVersion": "1.0",
  "generatedAt": "2026-02-21T00:00:00.000Z",
  "site": {
    "name": "Example Blog",
    "url": "https://example.com",
    "description": "A blog about technology",
    "contact": "ai-policy@example.com",
    "policyUrl": "https://example.com/ai-policy"
  },
  "policies": {
    "training": "deny",
    "scraping": "allow",
    "indexing": "allow",
    "caching": "allow"
  },
  "trainingPaths": {
    "allow": ["/blog/public/*"],
    "deny": ["/blog/premium/*"]
  },
  "licensing": {
    "license": "CC-BY-4.0",
    "feeUrl": "https://example.com/ai-licensing"
  },
  "agents": {
    "*": {
      "rateLimit": { "requests": 60, "window": "minute" }
    },
    "ClaudeBot": {
      "training": "allow",
      "rateLimit": { "requests": 200, "window": "minute" }
    },
    "GPTBot": {
      "training": "deny",
      "scraping": "deny"
    }
  },
  "content": {
    "attribution": "required",
    "aiDisclosure": "required"
  },
  "compliance": {
    "audit": "optional",
    "auditFormat": "rer-artifact/0.1"
  },
  "metadata": {}
}
```

### JSON Schema

Field semantics are identical to the text format defined above. The JSON format is preferred by programmatic clients as it is unambiguous and precisely typed.

## Agent Behavior

### Discovery

Agents SHOULD fetch `/.well-known/ai.txt` and/or `/.well-known/ai.json` before interacting with an unfamiliar site.

Agents SHOULD prefer the JSON format when both are available.

Agents SHOULD cache the policy for the duration declared by the HTTP `Cache-Control` header, with a minimum TTL of 60 seconds.

Agents SHOULD use `ETag` and `If-None-Match` headers for cache revalidation to avoid re-downloading unchanged policies.

### Absence of ai.txt

The absence of `ai.txt` does NOT imply any default policy. If a site does not serve `/.well-known/ai.txt` or `/.well-known/ai.json`, existing norms apply — including `robots.txt`, the site's terms of service, and applicable law. `ai.txt` provides additional granularity; it does not replace the baseline.

### Policy Enforcement

`ai.txt` is **advisory**. It declares the site owner's policy. Compliance is expected but not enforced by the file itself.

- Agents SHOULD respect `Training: deny` by not using content for model training
- Agents SHOULD respect `Scraping: deny` by not fetching content
- Agents SHOULD respect declared rate limits
- Agents SHOULD provide attribution when `Attribution: required`
- Agents SHOULD disclose AI-generated content when `AI-Disclosure: required`

Servers MUST enforce rate limits and access control independently.

### Identification

Agents SHOULD identify themselves via the `User-Agent` HTTP header. The agent name is matched case-insensitively against Agent blocks.

## Server Behavior

### Caching

Servers SHOULD serve `ai.txt` and `ai.json` with appropriate `Cache-Control` headers. A `max-age` of 300 seconds (5 minutes) is RECOMMENDED.

### CORS

Servers SHOULD include:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

## Security Considerations

- `ai.txt` MUST NOT contain secrets, tokens, or credentials
- `ai.txt` is advisory; servers MUST enforce policies independently
- Site owners SHOULD review their `ai.txt` periodically
- Agents MUST validate that referenced URLs use HTTPS before following them

## Implementation Guidelines

### For Site Owners

**Minimal ai.txt (deny all training):**

```
# ai.txt
Spec-Version: 1.0
Site-Name: My Blog
Site-URL: https://myblog.com
Training: deny
```

**Permissive ai.txt (allow everything with attribution):**

```
# ai.txt
Spec-Version: 1.0
Site-Name: Open Knowledge Base
Site-URL: https://openknowledge.org
Training: allow
Training-License: CC-BY-4.0
Attribution: required
```

**Conditional ai.txt (per-agent, per-path):**

```
# ai.txt
Spec-Version: 1.0
Site-Name: News Daily
Site-URL: https://newsdaily.com
Contact: ai@newsdaily.com
Policy-URL: https://newsdaily.com/ai-policy

Training: conditional
Training-Allow: /articles/free/*
Training-Deny: /articles/premium/*
Training-License: LicenseRef-NewsDaily
Training-Fee: https://newsdaily.com/ai-licensing

Agent: *
  Rate-Limit: 30/minute
Agent: ClaudeBot
  Training: allow
  Rate-Limit: 120/minute
Agent: GPTBot
  Training: deny

Attribution: required
AI-Disclosure: required
```

### For AI Agent Developers

1. Check `/.well-known/ai.txt` (or `ai.json`) before interacting with any site
2. Respect `Training: deny` — do not use content for model training
3. Identify your agent via `User-Agent` header to receive per-agent policies
4. Respect declared rate limits
5. Provide attribution when required

### For Tooling Developers

Use the `@ai-txt/core` npm package for parsing, generating, and validating `ai.txt` files:

```typescript
import { parse, generate, validate, AiTxtClient } from "@ai-txt/core";

// Discover a site's AI policy
const client = new AiTxtClient();
const result = await client.discover("https://example.com");
if (result.success) {
  console.log(result.document.policies.training); // "deny"
}
```

## References

- RFC 8615 — Well-Known URIs
- RFC 9309 — Robots Exclusion Protocol
- RFC 9116 — security.txt
- SPDX License List — https://spdx.org/licenses/
