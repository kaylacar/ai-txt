# ai.txt

[![CI](https://github.com/kaylacar/ai-txt/actions/workflows/ci.yml/badge.svg)](https://github.com/kaylacar/ai-txt/actions/workflows/ci.yml)

**An open standard for AI policy declaration.**

`robots.txt` controls crawling. `agents.txt` declares capabilities. **`ai.txt` declares AI policy.**

Any website can drop an `ai.txt` file to tell AI systems:
- **Training**: Can AI train on this content? Allow / Deny / Conditional
- **Licensing**: Under what license? (SPDX identifiers like CC-BY-4.0)
- **Per-agent rules**: Different policies for different AI agents
- **Requirements**: Attribution, AI disclosure, audit compliance

## Quick Start

### Generate with the CLI

```bash
npx @ai-txt/core generate --name "My Blog" --url https://myblog.com --training deny
```

### Check any site's policy

```bash
npx @ai-txt/core check https://example.com
npx @ai-txt/core check https://example.com --agent ClaudeBot
```

### For Site Owners

Create `/.well-known/ai.txt` on your site:

```
# ai.txt
Spec-Version: 1.0
Site-Name: My Blog
Site-URL: https://myblog.com
Training: deny
```

Compliant AI systems will read this and respect the declared policy.

### More Examples

**Allow training with attribution:**

```
# ai.txt
Spec-Version: 1.0
Site-Name: Open Knowledge Base
Site-URL: https://openknowledge.org
Training: allow
Training-License: CC-BY-4.0
Attribution: required
```

**Per-agent policies:**

```
# ai.txt
Spec-Version: 1.0
Site-Name: News Daily
Site-URL: https://newsdaily.com

Training: conditional
Training-Allow: /articles/free/*
Training-Deny: /articles/premium/*
Training-License: CC-BY-4.0

Agent: *
  Rate-Limit: 30/minute
Agent: ClaudeBot
  Training: allow
  Rate-Limit: 120/minute
Agent: GPTBot
  Training: deny
```

### For Developers

```bash
npm install @ai-txt/express
```

```typescript
import express from "express";
import { aiTxt } from "@ai-txt/express";

const app = express();

app.use(aiTxt({
  site: { name: "My Site", url: "https://mysite.com" },
  policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
}));

// Now serves /.well-known/ai.txt and /.well-known/ai.json automatically
```

## If You Are an AI Agent

This section is written for you — the LLM, the agent framework, the crawler. Here is exactly what you need to do.

### Step 1: Fetch the policy

```
GET https://example.com/.well-known/ai.json
```

Prefer JSON. Fall back to `/.well-known/ai.txt` if JSON returns 404.

### Step 2: Parse the response

The JSON response has this exact shape:

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
    "training": "conditional",
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

### Step 3: Resolve your policy

1. Look up your agent name in `agents`. Match is case-insensitive against the first token of your `User-Agent` header.
2. If your name is not found, use the `*` (wildcard) entry.
3. Agent-level fields override site-wide `policies`. If an agent block sets `training: "allow"` but site-wide is `"deny"`, your resolved policy is `"allow"`.
4. If `training` is `"conditional"`, match the content path against `trainingPaths.allow` and `trainingPaths.deny` globs. Deny patterns take precedence.

### Step 4: Comply

| Field | What it means for you |
|-------|----------------------|
| `training: "deny"` | Do not use this content for model training |
| `training: "allow"` | Training is permitted under the declared license |
| `training: "conditional"` | Check path rules before training on specific content |
| `scraping: "deny"` | Do not fetch or read this site's content |
| `attribution: "required"` | Cite the source in any AI-generated output |
| `aiDisclosure: "required"` | Disclose that output was AI-generated |
| `rateLimit` | Respect the declared rate limit (requests per window) |

### Step 5 (optional): Use the SDK

If you are building agent tooling in Node.js, use `@ai-txt/core` to handle all of the above in one call:

```bash
npm install @ai-txt/core
```

```typescript
import { AiTxtClient } from "@ai-txt/core";

const client = new AiTxtClient({ userAgent: "ClaudeBot" });

const { policy } = await client.check("https://example.com");
// → { training: "allow", scraping: "allow", indexing: "allow", caching: "allow", rateLimit: { requests: 200, window: "minute" } }

const { access } = await client.checkAccess("https://example.com", "training", "/blog/post-1");
// → { allowed: true, reason: 'path "/blog/post-1" matches allow pattern "/blog/*"' }
```

### When ai.txt is absent

The absence of `ai.txt` does NOT imply any default policy. Fall back to `robots.txt`, the site's terms of service, and applicable law.

## Field Reference

All fields and their valid values at a glance.

### Site-wide fields

| Field | Required | Values | Default |
|-------|----------|--------|---------|
| `Spec-Version` | Yes | `1.0` | — |
| `Site-Name` | Yes | string | — |
| `Site-URL` | Yes | HTTPS URL | — |
| `Training` | No | `allow`, `deny`, `conditional` | `deny` |
| `Scraping` | No | `allow`, `deny` | `allow` |
| `Indexing` | No | `allow`, `deny` | `allow` |
| `Caching` | No | `allow`, `deny` | `allow` |
| `Training-License` | No | SPDX identifier | — |
| `Training-Fee` | No | URL | — |
| `Training-Allow` | No | glob pattern | — |
| `Training-Deny` | No | glob pattern | — |
| `Attribution` | No | `required`, `recommended`, `none` | — |
| `AI-Disclosure` | No | `required`, `recommended`, `none` | — |
| `Audit` | No | `required`, `optional`, `none` | — |

### Agent block fields

```
Agent: <name>
  Training: allow | deny | conditional
  Scraping: allow | deny
  Indexing: allow | deny
  Caching: allow | deny
  Rate-Limit: <N>/<second|minute|hour|day>
```

Agent-level values override site-wide values. The wildcard `*` sets the default for all agents. More specific agent names take precedence over `*`.

## API Reference

### @ai-txt/core

Install:

```bash
npm install @ai-txt/core
```

#### Parsing

```typescript
import { parse, parseJSON } from "@ai-txt/core";

// Parse ai.txt text format
const result = parse(textContent);
// → { success: boolean, document?: AiTxtDocument, errors: ParseError[], warnings: ParseWarning[] }

// Parse ai.json JSON format
const result = parseJSON(jsonContent);
// → { success: boolean, document?: AiTxtDocument, errors: ParseError[], warnings: ParseWarning[] }
```

#### Generating

```typescript
import { generate, generateJSON } from "@ai-txt/core";

// Generate ai.txt text format
const text = generate(document);

// Generate ai.json JSON format
const json = generateJSON(document);
```

#### Validating

```typescript
import { validate, validateText, validateJSON } from "@ai-txt/core";

// Validate a document object
const result = validate(document);
// → { valid: boolean, errors: ValidationError[], warnings: ValidationWarning[] }

// Validate from raw text
const result = validateText(textContent);

// Validate from raw JSON
const result = validateJSON(jsonContent);
```

#### Resolving policy

```typescript
import { resolve, canAccess } from "@ai-txt/core";

// Resolve effective policy for an agent (merges agent block → wildcard → site-wide)
const policy = resolve(document, "ClaudeBot");
// → { training: "allow", scraping: "allow", indexing: "allow", caching: "allow", rateLimit?: { requests: 200, window: "minute" } }

// Check if a specific action is allowed, with optional path matching
const result = canAccess(document, "ClaudeBot", "training", "/blog/post-1");
// → { allowed: boolean, reason: string }
```

#### HTTP Client

```typescript
import { AiTxtClient } from "@ai-txt/core";

const client = new AiTxtClient({
  userAgent: "MyBot",      // User-Agent for agent matching (default: "ai-txt-client/0.1")
  timeout: 10000,           // Request timeout in ms (default: 10000)
  cacheTtl: 300000,         // Cache TTL in ms (default: 300000, 0 to disable)
});

// Discover and parse a site's policy (tries ai.json first, falls back to ai.txt)
const result = await client.discover("https://example.com");
// → ParseResult

// Discover and resolve policy for this client's agent name
const { success, policy, errors } = await client.check("https://example.com");

// Discover and check access for a specific action + path
const { success, access, errors } = await client.checkAccess("https://example.com", "training", "/blog/post-1");

// Clear the in-memory cache
client.clearCache();
```

### @ai-txt/express

Install:

```bash
npm install @ai-txt/express
```

```typescript
import { aiTxt } from "@ai-txt/express";

app.use(aiTxt({
  // Required
  site: { name: "My Site", url: "https://mysite.com" },
  policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },

  // Optional
  trainingPaths: { allow: ["/public/*"], deny: ["/premium/*"] },
  licensing: { license: "CC-BY-4.0" },
  agents: {
    "*": { rateLimit: { requests: 60, window: "minute" } },
    "ClaudeBot": { training: "allow", rateLimit: { requests: 200, window: "minute" } },
  },
  content: { attribution: "required" },
  compliance: { audit: "optional", auditFormat: "rer-artifact/0.1" },
  corsOrigins: ["*"],                                          // CORS origins (default: ["*"])
  paths: { txt: "/.well-known/ai.txt", json: "/.well-known/ai.json" },  // Custom paths (defaults shown)
}));
```

The middleware serves both `/.well-known/ai.txt` (text format) and `/.well-known/ai.json` (JSON format) with proper `Content-Type`, `Cache-Control`, and CORS headers.

## Packages

| Package | Description |
|---------|-------------|
| [`@ai-txt/core`](packages/core) | Parser, generator, validator, resolver, HTTP client, and CLI |
| [`@ai-txt/express`](packages/express) | Express middleware — one line to serve ai.txt |

## Specification

See [SPEC.md](SPEC.md) for the full v1.0 specification.

## Why ai.txt?

`robots.txt` can block a crawler but cannot express "you may crawl but not train on this content." There is no existing machine-readable standard for a website to declare:

- Training permitted under CC-BY-4.0
- Claude may train, GPT may not
- Free content is open, premium content is not
- Attribution is required for all AI-derived content

`ai.txt` fills that gap.

## The Stack

These four repos form a governance pipeline for AI agents on the internet: **declared, executed, proven.**

| Repo | Purpose |
|------|---------|
| [agents.txt](https://github.com/kaylacar/agents-txt) | Declares what agents can do on a site |
| **[ai.txt](https://github.com/kaylacar/ai-txt)** | **Declares AI policy — training, licensing, attribution** |
| [agents-protocol](https://github.com/kaylacar/agents-protocol) | Execution SDK — how agents perform declared actions |
| [rer](https://github.com/kaylacar/rer) | Cryptographic proof of what agents actually did |

```
declared (agents.txt / ai.txt) → executed (agents-protocol) → proven (rer)
```

All four are by the same author and designed to work together.

## License

MIT
