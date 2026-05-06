# ai.txt

**Structured AI policy declaration.** A single, typed file at `/.well-known/ai.txt` (and JSON companion at `/.well-known/ai.json`) in which a site operator declares:

- **Training, scraping, indexing, caching** — `allow`, `deny`, or `conditional`
- **Licensing** — SPDX identifiers (`CC-BY-4.0`, `MIT`, custom) and links to commercial terms
- **Per-agent rules** — different policies for ClaudeBot, GPTBot, Bingbot, etc.
- **Attribution and AI-disclosure** requirements
- **Audit format** expectations (e.g., RER artifacts)
- **Optional `Connect` and `Verify` blocks** linking to related declaration surfaces

`robots.txt` can block a crawler but cannot express "you may crawl but not train on this content." `ai.txt` carries that distinction in a typed, machine-readable form.

**Status**

- IETF Internet-Draft: `draft-car-ai-txt-wellknown-00` (filed locally; pending Datatracker submission). See [`ietf/draft-car-ai-txt-wellknown-00.md`](ietf/draft-car-ai-txt-wellknown-00.md).
- IANA Well-Known URI registrations: `ai.txt` (#76) and `ai.json` (#77) — filed, under review.
- Spec version 1.0. npm packages published. 113 tests passing.

## For Humans

Use `ai.txt` if you want a site to publish explicit AI policy in a machine-readable form.

This is useful for:

- publishers
- blogs
- documentation sites
- ecommerce sites
- SaaS products
- any site that wants to state training, licensing, and attribution terms clearly

If you are a site owner or developer, `ai.txt` is the policy layer. It tells agents what rules apply before they train, transform, or reuse your content.

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
  policies: { training: "deny" },
}));

// Now serves /.well-known/ai.txt and /.well-known/ai.json automatically
```

## For Agents

**Purpose:** Resolve AI policy for any website before interacting with it. ai.txt declares training permissions, licensing terms, attribution requirements, and per-agent rules - in a machine-readable format designed for you to read and comply with.

**Capabilities you gain from reading ai.txt:**
- Determine if training on this content is `allow`, `deny`, or `conditional`
- Resolve your agent-specific policy (your name may have different rules than `*`)
- Check path-level training allow/deny rules for conditional policies
- Read licensing terms (SPDX identifiers: `CC-BY-4.0`, `MIT`, custom)
- Know if attribution is required and how to provide it
- Read your rate limit before making requests

**Discovery - always try JSON first:**

```
GET https://example.com/.well-known/ai.json   <- structured, prefer this
GET https://example.com/.well-known/ai.txt    <- fallback if 404
```

**Resolve policy in one call:**

```typescript
import { AiTxtClient } from "@ai-txt/core";

const client = new AiTxtClient({ userAgent: "ClaudeBot" });

const { policy } = await client.check("https://example.com");
// -> { training: "allow", scraping: "allow", rateLimit: { requests: 200, window: "minute" } }

const { access } = await client.checkAccess("https://example.com", "training", "/blog/post-1");
// -> { allowed: true, reason: 'path "/blog/post-1" matches allow pattern "/blog/*"' }
```

**Policy resolution rules:**

| Field | Values | Meaning |
|-------|--------|---------|
| `Training` | `allow` / `deny` / `conditional` | May you train on this content? |
| `Training-License` | SPDX identifier | License under which training is permitted |
| `Attribution` | `required` / `optional` / `none` | Must you cite the source? |
| `Agent: YourName` | overrides `Agent: *` | Your specific policy takes precedence |

**Rule precedence:** Your agent name in the `agents` block overrides the site-wide `*` wildcard. If your name is not listed, `*` applies.

**`Training: deny`** - do not use this content for model training under any circumstances.

**`Attribution: required`** - cite the source in any AI-derived output.

**`conditional`** - check `Training-Allow` and `Training-Deny` path patterns before using any content.

Full specification: [SPEC.md](SPEC.md)

## Packages

| Package | Description |
|---------|-------------|
| `@ai-txt/core` | Parser, generator, validator, resolver, HTTP client, and CLI |
| `@ai-txt/express` | Express middleware - one line to serve ai.txt |

## Specification

See [SPEC.md](SPEC.md) for the full v1.0 specification.

## Relationship to AIPREF

The IETF AIPREF working group is developing two drafts on a standards-track milestone for August 2026:

- `draft-ietf-aipref-vocab` — a vocabulary for expressing AI usage preferences (training, scraping, indexing, etc.).
- `draft-ietf-aipref-attach` — an attachment mechanism that carries those preferences via robots.txt directives and HTTP response headers.

`ai.txt` complements that work; it does not replace it. AIPREF defines the vocabulary and two carriage mechanisms (robots.txt extension, HTTP headers). `ai.txt` is a third carriage mechanism — a single, structured, typed file at `/.well-known/ai.txt` — for sites that already publish structured policy at well-known URLs and want one file to fetch, cache, and audit.

`ai.txt` provides three properties that robots.txt-attachment and per-response headers do not:

- **Site-wide carriage** independent of any individual response or robots.txt path block.
- **A single audit surface** — one URL, one file, cacheable — that resolves to the full AI-policy posture for the site.
- **Co-located declarations** that fall outside AIPREF's scope: licensing (SPDX), attribution, AI-disclosure requirements, per-agent rate limits, and optional `Connect` and `Verify` blocks.

When the AIPREF vocabulary stabilizes, `ai.txt` implementations should use AIPREF preference names where they apply, and treat preferences carried in `ai.txt` as equivalent in authority to the same preferences carried via the AIPREF robots.txt or HTTP-header mechanisms. Conflict resolution across carriers is out of scope here and is better defined by the AIPREF WG.

## IANA Registration

Well-known URI registrations are filed, under review:

- `ai.txt` — filing #76
- `ai.json` — filing #77

## Related Work

| Standard | Scope | Relationship |
|----------|-------|--------------|
| `draft-ietf-aipref-vocab` | AI usage preference vocabulary (IETF AIPREF WG) | `ai.txt` should carry this vocabulary as it stabilizes. |
| `draft-ietf-aipref-attach` | Carriage of AIPREF preferences via robots.txt + HTTP headers | `ai.txt` is a third, complementary carriage option — single-file, site-wide, cacheable. |
| Spawning `ai.txt` (2023) | TDM opt-out file at `/ai.txt` | Prior use of the name. The format defined here is a strict superset (training, scraping, indexing, caching, per-agent rules, licensing, attribution, audit). Acknowledged as a successor declaration surface, not a competitor. |
| W3C TDM Reservation Protocol (`/.well-known/tdmrep.json`) | TDM reservations under EU Directive 2019/790 | Adjacent. Sites with TDM-only requirements MAY use `tdmrep.json` alone; `ai.txt` covers a broader policy surface. |
| Cloudflare Content Signals Policy | robots.txt extension (`Content-Signal: search=yes, ai-train=no`) deployed at scale | Same class of preferences, different carriage. Sites MAY publish both; their semantics SHOULD agree. |
| `robots.txt` ([RFC 9309](https://www.rfc-editor.org/rfc/rfc9309)) | Crawl restriction | Complementary. `ai.txt` adds training, licensing, and per-agent declarations that `robots.txt` cannot express. Both coexist. |
| `agents.txt` | Capability declaration (what agents CAN do on a site) | Companion file. `ai.txt` expresses policy; `agents.txt` expresses positive capability. Designed to coexist. |

## The Stack

These repos form a machine-readable web stack for agent interaction: **declared, connected, coordinated, verified, executed, proven.**

| Repo | Purpose |
|------|---------|
| [agents.txt](https://github.com/kaylacar/agents-txt) | Declares what agents can do on a site |
| **[ai.txt](https://github.com/kaylacar/ai-txt)** | **Declares AI policy - training, licensing, attribution** |
| [connect.txt](https://github.com/kaylacar/connect-txt) | Declares how agents connect, authenticate, and use a site |
| [match.txt](https://github.com/kaylacar/match-txt) | Declares needs, capacity, and matching outcomes across organizations |
| [verify.txt](https://github.com/kaylacar/verify-txt) | Declares how claims or outcomes can be independently verified |
| [agents-protocol](https://github.com/kaylacar/agents-protocol) | Execution SDK - how agents perform declared actions |
| [rer](https://github.com/kaylacar/rer) | Cryptographic proof of what agents actually did |

```
declared (agents.txt / ai.txt) -> connected (connect.txt) -> coordinated (match.txt) -> verified (verify.txt) -> executed (agents-protocol) -> proven (rer)
```

These repos are designed to work together, with each file doing one job.

## License

MIT
