# ai.txt

**An open standard for AI policy declaration.**

`robots.txt` controls crawling. `agents.txt` declares capabilities. **`ai.txt` declares AI policy.**

Any website can drop an `ai.txt` file to tell AI systems:
- **Training**: Can AI train on this content? Allow / Deny / Conditional
- **Licensing**: Under what license? (SPDX identifiers like CC-BY-4.0)
- **Per-agent rules**: Different policies for different AI agents
- **Requirements**: Attribution, AI disclosure, audit compliance

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

## Why ai.txt?

`robots.txt` can block a crawler but cannot express "you may crawl but not train on this content." There is no existing machine-readable standard for a website to declare:

- Training permitted under CC-BY-4.0
- Claude may train, GPT may not
- Free content is open, premium content is not
- Attribution is required for all AI-derived content

`ai.txt` fills that gap.

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
